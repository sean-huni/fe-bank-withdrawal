import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScreenFrame } from '../components/ScreenFrame'
import { Money } from '../components/Money'
import { useBalance } from '../hooks/useBalance'
import { useSessionStore } from '../stores/sessionStore'
import { atmMetrics } from '../telemetry'
import { useT } from '../i18n/strings'

export function Balance() {
  const t = useT()
  const navigate = useNavigate()
  const account = useSessionStore((s) => s.account)
  const cardNumber = useSessionStore((s) => s.cardNumber)
  const { data, isLoading } = useBalance(cardNumber)

  useEffect(() => {
    atmMetrics.balanceInquiry()
  }, [])

  const snapshot = data ?? account

  return (
    <ScreenFrame title={`💰 ${t('balance')}`}>
      {isLoading && !snapshot ? (
        <p className="text-slate-400">Loading…</p>
      ) : snapshot ? (
        <div className="text-center py-4">
          <p className="text-slate-400">{snapshot.holderName}</p>
          <p className="font-mono text-slate-500 text-sm mb-4">{snapshot.maskedCardNumber}</p>
          <p className="font-display text-4xl text-accent-cyan">
            <Money amount={snapshot.balance} currency={snapshot.currency} />
          </p>
        </div>
      ) : null}
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
