import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AmountPad } from '../components/AmountPad'
import { BalanceCard } from '../components/BalanceCard'
import { useWithdraw } from '../hooks/useWithdraw'
import { useSessionStore } from '../stores/sessionStore'
import { fromAxios, mapError } from '../lib/errorMap'
import { useLocaleStore } from '../stores/localeStore'
import { getBeMessage } from '../i18n/generated/beMessages'
import { parseAmount } from '../lib/validation'
import { atmMetrics } from '../telemetry'
import { useT } from '../i18n/strings'

export function Withdraw() {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const navigate = useNavigate()
  const account = useSessionStore((s) => s.account)!
  const [amount, setAmount] = useState<string>('')
  const withdraw = useWithdraw() // creates one idempotency key for this screen instance

  async function confirm() {
    const parsed = parseAmount(amount)
    if (!parsed.success) {
      toast.error(`✋ ${parsed.error.issues[0].message}`)
      return
    }
    // client-side pre-check for a friendly message; the server stays the source of truth.
    if (Number(amount) > Number(account.balance)) {
      toast.error(`💸 ${getBeMessage('INSUFFICIENT_FUNDS', locale)}`)
      return
    }
    const startedAt = performance.now()
    try {
      const tx = await withdraw.mutateAsync({ accountId: account.accountId, amount })
      atmMetrics.withdrawal('success')
      atmMetrics.txnDuration('withdraw', performance.now() - startedAt)
      navigate('/receipt', { state: { tx, kind: 'withdraw' } })
    } catch (err) {
      atmMetrics.txnDuration('withdraw', performance.now() - startedAt)
      const { status, error } = fromAxios(err)
      atmMetrics.withdrawal(status === 422 ? 'insufficient_funds' : 'error')
      const m = mapError(status, error, locale)
      toast.error(`${m.emoji} ${m.title} — ${m.detail}`)
    }
  }

  return (
    <>
      <BalanceCard amount={account.balance} currency={account.currency} />
      <AmountPad
        value={amount}
        onChange={setAmount}
        currency={account.currency}
        max={Number(account.balance)}
      />
      <button
        type="button"
        className="glass w-full p-4 mt-4 text-accent-cyan font-display active:scale-95 transition disabled:opacity-50"
        disabled={withdraw.isPending}
        onClick={confirm}
      >
        {t('confirm')}
      </button>
    </>
  )
}
