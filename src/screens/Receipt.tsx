import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Money } from '../components/Money'
import { useSessionStore } from '../stores/sessionStore'
import type { Transaction } from '../api/types'
import { useT } from '../i18n/strings'

type ReceiptState = { tx: Transaction; kind: 'withdraw' | 'deposit' }

const timeFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function Receipt() {
  const t = useT()
  const navigate = useNavigate()
  const account = useSessionStore((s) => s.account)
  const state = useLocation().state as ReceiptState | null

  // Direct navigation without a transaction — bounce to the menu.
  if (!state?.tx) return <Navigate to="/menu" replace />

  const { tx, kind } = state
  const currency = account?.currency ?? 'EUR'
  const verb = kind === 'withdraw' ? t('withdraw') : t('deposit')

  return (
    <>
      <h2 className="font-display text-2xl text-center mb-2">✅ {verb}</h2>
      <div className="text-center py-2">
        <p className="font-display text-4xl text-accent-cyan mb-2">
          <Money amount={tx.amount} currency={currency} />
        </p>
        <p className="text-slate-400">
          {t('balance')}: <Money amount={tx.balanceAfter} currency={currency} />
        </p>
      </div>
      <dl className="glass p-4 mt-4 text-sm space-y-1 font-mono">
        <div className="flex justify-between">
          <dt className="text-slate-500">Txn</dt>
          <dd>{tx.transactionId}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Time</dt>
          <dd>{timeFmt.format(new Date(tx.occurredAt))}</dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={() => navigate('/menu')}
        className="glass w-full p-4 mt-6 text-accent-cyan font-display active:scale-95 transition"
      >
        🔁 {t('another')}
      </button>
    </>
  )
}
