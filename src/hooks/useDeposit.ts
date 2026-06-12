import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { deposit } from '../api/atm'
import { newIdempotencyKey } from '../lib/idempotency'
import { useSessionStore } from '../stores/sessionStore'

export function useDeposit() {
  const patchBalance = useSessionStore((s) => s.patchBalance)
  const [idempotencyKey] = useState(newIdempotencyKey)
  return useMutation({
    mutationFn: (vars: { accountId: string; amount: string }) =>
      deposit(vars.accountId, vars.amount, idempotencyKey),
    onSuccess: (tx) => patchBalance(tx.balanceAfter),
  })
}
