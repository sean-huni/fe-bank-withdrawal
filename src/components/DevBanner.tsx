import { env } from '../config/env'
import { useSessionStore } from '../stores/sessionStore'

export function DevBanner() {
  const account = useSessionStore((s) => s.account)
  if (!env.isDev) return null
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
      {account && (
        <span className="ml-auto">
          {account.holderName} · {account.maskedCardNumber}
        </span>
      )}
    </div>
  )
}
