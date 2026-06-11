import { useNavigate } from 'react-router-dom'
import { ScreenFrame } from '../components/ScreenFrame'
import { useSessionStore } from '../stores/sessionStore'
import { useT } from '../i18n/strings'

export function Menu() {
  const t = useT()
  const navigate = useNavigate()
  const account = useSessionStore((s) => s.account)

  const actions: { emoji: string; label: string; to: string }[] = [
    { emoji: '💰', label: t('balance'), to: '/balance' },
    { emoji: '💸', label: t('withdraw'), to: '/withdraw' },
    { emoji: '🏧', label: t('deposit'), to: '/deposit' },
    { emoji: '🧾', label: t('statement'), to: '/statement' },
  ]

  return (
    <ScreenFrame>
      <h2 className="font-display text-2xl sm:text-3xl mb-5">👋 {account?.holderName ?? ''}</h2>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((a) => (
          <button
            key={a.to}
            type="button"
            onClick={() => navigate(a.to)}
            className="glass h-24 font-display text-lg flex flex-col items-center justify-center gap-1 active:scale-95 transition"
          >
            <span className="text-2xl">{a.emoji}</span>
            {a.label}
          </button>
        ))}
      </div>
    </ScreenFrame>
  )
}
