import { env } from '../config/env'
import { useSessionStore } from '../stores/sessionStore'
import { lastIdempotencyKey } from '../lib/idempotency'

export function DevBanner() {
  const account = useSessionStore((s) => s.account)
  if (!env.isDev) return null
  // Re-evaluated whenever the banner renders (e.g. after a tx patches the balance).
  const key = lastIdempotencyKey()
  const link = (href: string, label: string) => (
    <a className="underline hover:text-accent-cyan" href={href} target="_blank" rel="noreferrer">
      {label}
    </a>
  )
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-surface-900/90 text-xs px-3 py-1 flex gap-4 font-mono">
      <span>🛠 dev</span>
      {link(env.grafanaUrl, 'Grafana')}
      {link(env.prometheusUrl, 'Prometheus')}
      {link(env.swaggerUrl, 'Swagger')}
      {key && <span title={key}>key {key.slice(0, 8)}…</span>}
      {account && (
        <span className="ml-auto">
          {account.holderName} · {account.maskedCardNumber}
        </span>
      )}
    </div>
  )
}
