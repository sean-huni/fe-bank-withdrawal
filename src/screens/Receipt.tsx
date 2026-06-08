import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ScreenFrame } from '../components/ScreenFrame'
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
  const signOut = useSessionStore((s) => s.signOut)
  const state = useLocation().state as ReceiptState | null

  // Direct navigation without a transaction — bounce to the menu.
  if (!state?.tx) return <Navigate to="/menu" replace />

  const { tx, kind } = state
  const currency = account?.currency ?? 'EUR'
  const verb = kind === 'withdraw' ? t('withdraw') : t('deposit')

  return (
    <ScreenFrame title={`✅ ${verb}`}>
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
      <div className="grid grid-cols-2 gap-3 mt-6">
        <button
          type="button"
          onClick={() => navigate('/menu')}
          className="glass p-4 text-accent-cyan font-display active:scale-95 transition"
        >
          🔁 {t('another')}
        </button>
        <button
          type="button"
          onClick={() => {
            signOut()
            toast(`💳 ${t('takeCard')}`)
            navigate('/')
          }}
          className="glass p-4 font-display active:scale-95 transition"
        >
          🚪 {t('exit')}
        </button>
      </div>
    </ScreenFrame>
  )
}
