import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-web'
import { ZoneContextManager } from '@opentelemetry/context-zone'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch'
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request'
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load'
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'
import { metrics } from '@opentelemetry/api'
import { onCLS, onINP, onLCP, onTTFB, onFCP } from 'web-vitals'
import { env } from '../config/env'

const resource = resourceFromAttributes({ [ATTR_SERVICE_NAME]: 'fe-bank-withdrawal' })

// OTel returns a ProxyMeter; instruments created here bind to the real provider once
// setGlobalMeterProvider runs in initTelemetry. Create each instrument once and reuse it.
const meter = metrics.getMeter('atm')
const sessionStartedCounter = meter.createCounter('atm_session_started_total')
const cardLookupCounter = meter.createCounter('atm_card_lookup_total')
const pinVerifyCounter = meter.createCounter('atm_pin_verify_total')
const balanceInquiryCounter = meter.createCounter('atm_balance_inquiry_total')
const withdrawalCounter = meter.createCounter('atm_withdrawal_total')
const depositCounter = meter.createCounter('atm_deposit_total')
const txnDurationHistogram = meter.createHistogram('atm_txn_duration')

export const atmMetrics = {
  sessionStarted: () => sessionStartedCounter.add(1),
  cardLookup: (result: 'success' | 'not_found' | 'error') => cardLookupCounter.add(1, { result }),
  pinVerify: (result: 'success' | 'invalid' | 'error') => pinVerifyCounter.add(1, { result }),
  balanceInquiry: () => balanceInquiryCounter.add(1),
  withdrawal: (result: 'success' | 'insufficient_funds' | 'error') => withdrawalCounter.add(1, { result }),
  deposit: (result: 'success' | 'error') => depositCounter.add(1, { result }),
  txnDuration: (op: 'withdraw' | 'deposit', ms: number) => txnDurationHistogram.record(ms, { op }),
}

export function initTelemetry() {
  const tracerProvider = new WebTracerProvider({
    resource,
    spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: `${env.otlpBaseUrl}/v1/traces` }))],
  })
  tracerProvider.register({ contextManager: new ZoneContextManager() })

  const meterProvider = new MeterProvider({
    resource,
    readers: [new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${env.otlpBaseUrl}/v1/metrics` }), exportIntervalMillis: 10_000,
    })],
  })
  metrics.setGlobalMeterProvider(meterProvider)

  registerInstrumentations({
    instrumentations: [new DocumentLoadInstrumentation(), new FetchInstrumentation(), new XMLHttpRequestInstrumentation()],
  })

  const vitals = meter.createHistogram('atm_web_vitals')
  const report = (name: string) => (m: { value: number }) => vitals.record(m.value, { metric: name })
  onCLS(report('CLS')); onINP(report('INP')); onLCP(report('LCP')); onTTFB(report('TTFB')); onFCP(report('FCP'))
}
