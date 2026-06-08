import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ScreenFrame } from '../components/ScreenFrame'
import { AmountPad } from '../components/AmountPad'
import { useWithdraw } from '../hooks/useWithdraw'
import { useSessionStore } from '../stores/sessionStore'
import { fromAxios, mapError } from '../lib/errorMap'
import { atmMetrics } from '../telemetry'
import { useT } from '../i18n/strings'

export function Withdraw() {
  const t = useT()
  const navigate = useNavigate()
  const account = useSessionStore((s) => s.account)!
  const [amount, setAmount] = useState<string>('')
  const withdraw = useWithdraw() // creates one idempotency key for this screen instance

  async function confirm() {
    if (!amount || Number(amount) <= 0) {
      toast.error('✋ Enter an amount')
      return
    }
    try {
      const tx = await withdraw.mutateAsync({ accountId: account.accountId, amount })
      atmMetrics.withdrawal('success')
      navigate('/receipt', { state: { tx, kind: 'withdraw' } })
    } catch (err) {
      const { status, error } = fromAxios(err)
      atmMetrics.withdrawal(status === 422 ? 'insufficient_funds' : 'error')
      const m = mapError(status, error)
      toast.error(`${m.emoji} ${m.title} — ${m.detail}`)
    }
  }

  return (
    <ScreenFrame title={`💰 ${t('withdraw')}`}>
      <AmountPad value={amount} onChange={setAmount} currency={account.currency} />
      <button
        type="button"
        className="glass w-full p-4 mt-4 text-accent-cyan font-display active:scale-95 transition disabled:opacity-50"
        disabled={withdraw.isPending}
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
