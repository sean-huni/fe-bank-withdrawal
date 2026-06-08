import { useMutation } from '@tanstack/react-query'
import { withdraw } from '../api/atm'
import { newIdempotencyKey } from '../lib/idempotency'
import { usePatchBalance } from './useBalance'
import { useSessionStore } from '../stores/sessionStore'

export function useWithdraw() {
  const patch = usePatchBalance()
  const cardNumber = useSessionStore.getState().cardNumber as string
  // one key per hook instance == one logical operation; React Query retries reuse it
  const idempotencyKey = newIdempotencyKey()
  return useMutation({
    mutationFn: (vars: { accountId: string; amount: string }) =>
      withdraw(vars.accountId, vars.amount, idempotencyKey),
    onSuccess: (tx) => patch(cardNumber, tx.balanceAfter),
  })
}
