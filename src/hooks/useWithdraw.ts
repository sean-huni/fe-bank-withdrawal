import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { withdraw } from '../api/atm'
import { newIdempotencyKey } from '../lib/idempotency'
import { usePatchBalance } from './useBalance'
import { useSessionStore } from '../stores/sessionStore'

export function useWithdraw() {
  const patch = usePatchBalance()
  const cardNumber = useSessionStore.getState().cardNumber as string
  const [idempotencyKey] = useState(newIdempotencyKey) // created once, stable across renders & retries
  return useMutation({
    mutationFn: (vars: { accountId: string; amount: string }) =>
      withdraw(vars.accountId, vars.amount, idempotencyKey),
    onSuccess: (tx) => patch(cardNumber, tx.balanceAfter),
  })
}
