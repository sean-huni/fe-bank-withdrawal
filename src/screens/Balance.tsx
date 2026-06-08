import { useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ScreenFrame } from '../components/ScreenFrame'
import { Money } from '../components/Money'
import { useSessionStore } from '../stores/sessionStore'
import { atmMetrics } from '../telemetry'
import { useT } from '../i18n/strings'

export function Balance() {
  const t = useT()
  const navigate = useNavigate()
  const account = useSessionStore((s) => s.account)

  useEffect(() => {
    atmMetrics.balanceInquiry()
  }, [])

  // No authenticated account — bounce to Welcome.
  if (!account) return <Navigate to="/" replace />

  return (
    <ScreenFrame title={`💰 ${t('balance')}`}>
      <div className="text-center py-4">
        <p className="text-slate-400">{account.holderName}</p>
        <p className="font-mono text-slate-500 text-sm mb-4">{account.maskedCardNumber}</p>
        <p className="font-display text-4xl text-accent-cyan">
          <Money amount={account.balance} currency={account.currency} />
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-6">
        <button
          type="button"
          onClick={() => navigate('/menu')}
          className="glass p-4 font-display active:scale-95 transition"
        >
          ◀ {t('cancel')}
        </button>
        <button
          type="button"
          onClick={() => navigate('/withdraw')}
          className="glass p-4 text-accent-cyan font-display active:scale-95 transition"
        >
          💸 {t('withdraw')}
        </button>
      </div>
    </ScreenFrame>
  )
}
