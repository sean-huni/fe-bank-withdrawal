import { useNavigate } from 'react-router-dom'
import { ScreenFrame } from '../components/ScreenFrame'
import { useSessionStore } from '../stores/sessionStore'
import { useSessionTimeout } from '../hooks/useSessionTimeout'
import { useT } from '../i18n/strings'

export function Menu() {
  useSessionTimeout()
  const t = useT()
  const navigate = useNavigate()
  const account = useSessionStore((s) => s.account)
  const signOut = useSessionStore((s) => s.signOut)

  const actions: { emoji: string; label: string; to: string }[] = [
    { emoji: '💰', label: t('balance'), to: '/balance' },
    { emoji: '💸', label: t('withdraw'), to: '/withdraw' },
    { emoji: '🏧', label: t('deposit'), to: '/deposit' },
    { emoji: '🧾', label: t('statement'), to: '/statement' },
  ]

  return (
    <ScreenFrame title={`👋 ${account?.holderName ?? ''}`}>
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
      <button
        type="button"
        onClick={() => {
          signOut()
          navigate('/')
        }}
        className="w-full p-4 mt-4 text-slate-400 hover:text-slate-200 transition"
      >
        🚪 {t('exit')}
      </button>
    </ScreenFrame>
  )
}
