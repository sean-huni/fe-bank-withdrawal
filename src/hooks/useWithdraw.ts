import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { withdraw } from '../api/atm'
import { newIdempotencyKey } from '../lib/idempotency'
import { useSessionStore } from '../stores/sessionStore'

export function useWithdraw() {
  const patchBalance = useSessionStore((s) => s.patchBalance)
  const [idempotencyKey] = useState(newIdempotencyKey) // stable per operation
  return useMutation({
    mutationFn: (vars: { accountId: string; amount: string }) =>
      withdraw(vars.accountId, vars.amount, idempotencyKey),
    onSuccess: (tx) => patchBalance(tx.balanceAfter),
  })
}
