import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ScreenFrame } from '../components/ScreenFrame'
import { AmountPad } from '../components/AmountPad'
import { useDeposit } from '../hooks/useDeposit'
import { useSessionStore } from '../stores/sessionStore'
import { fromAxios, mapError } from '../lib/errorMap'
import { parseAmount } from '../lib/validation'
import { atmMetrics } from '../telemetry'
import { useT } from '../i18n/strings'

export function Deposit() {
  const t = useT()
  const navigate = useNavigate()
  const account = useSessionStore((s) => s.account)!
  const [amount, setAmount] = useState<string>('')
  const deposit = useDeposit() // creates one idempotency key for this screen instance

  async function confirm() {
    const parsed = parseAmount(amount)
    if (!parsed.success) {
      toast.error(`✋ ${parsed.error.issues[0].message}`)
      return
    }
    const startedAt = performance.now()
    try {
      const tx = await deposit.mutateAsync({ accountId: account.accountId, amount })
      atmMetrics.deposit('success')
      atmMetrics.txnDuration('deposit', performance.now() - startedAt)
      navigate('/receipt', { state: { tx, kind: 'deposit' } })
    } catch (err) {
      atmMetrics.txnDuration('deposit', performance.now() - startedAt)
      const { status, error } = fromAxios(err)
      atmMetrics.deposit('error')
      const m = mapError(status, error)
      toast.error(`${m.emoji} ${m.title} — ${m.detail}`)
    }
  }

  return (
    <ScreenFrame title={`🏧 ${t('deposit')}`}>
      <AmountPad value={amount} onChange={setAmount} currency={account.currency} />
      <button
        type="button"
        className="glass w-full p-4 mt-4 text-accent-cyan font-display active:scale-95 transition disabled:opacity-50"
        disabled={deposit.isPending}
        onClick={confirm}
      >
        {t('confirm')}
      </button>
      <button type="button" className="w-full p-3 mt-2 text-slate-400" onClick={() => navigate('/menu')}>
        {t('cancel')}
      </button>
    </ScreenFrame>
  )
}
