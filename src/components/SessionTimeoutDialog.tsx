import { useT } from '../i18n/strings'

/** Idle-session warning. The Continue click bubbles to the window listener, which resets the timer. */
export function SessionTimeoutDialog({ secondsLeft }: { secondsLeft: number | null }) {
  const t = useT()
  if (secondsLeft === null) return null
  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/70 p-4"
    >
      <div className="glass p-6 w-full max-w-xs text-center">
        <p className="font-display text-lg mb-1">⏳ {t('timeoutTitle')}</p>
        <p className="text-slate-400 text-sm mb-4">
          {t('timeoutBody').replace('{secs}', String(secondsLeft))}
        </p>
        <button type="button" className="glass w-full p-3 text-accent-cyan font-display active:scale-95 transition">
          {t('continue')}
        </button>
      </div>
    </div>
  )
}
