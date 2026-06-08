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

  const meter = metrics.getMeter('atm')
  const vitals = meter.createHistogram('atm_web_vitals')
  const report = (name: string) => (m: { value: number }) => vitals.record(m.value, { metric: name })
  onCLS(report('CLS')); onINP(report('INP')); onLCP(report('LCP')); onTTFB(report('TTFB')); onFCP(report('FCP'))
}

const meter = () => metrics.getMeter('atm')
export const atmMetrics = {
  sessionStarted: () => meter().createCounter('atm_session_started_total').add(1),
  cardLookup: (result: 'success' | 'not_found' | 'error') =>
    meter().createCounter('atm_card_lookup_total').add(1, { result }),
  balanceInquiry: () => meter().createCounter('atm_balance_inquiry_total').add(1),
  withdrawal: (result: 'success' | 'insufficient_funds' | 'error') =>
    meter().createCounter('atm_withdrawal_total').add(1, { result }),
  deposit: (result: 'success' | 'error') => meter().createCounter('atm_deposit_total').add(1, { result }),
}
