import { useQuery, useQueryClient } from '@tanstack/react-query'
import { lookupCard } from '../api/atm'
import type { AccountSnapshot } from '../api/types'

export const balanceKey = (card: string) => ['balance', card] as const

export function useBalance(cardNumber: string | null) {
  return useQuery({
    queryKey: balanceKey(cardNumber ?? ''),
    queryFn: () => lookupCard(cardNumber as string),
    enabled: !!cardNumber,
  })
}
/** After a txn, patch the cached snapshot's balance from the txn's balanceAfter — no refetch. */
export function usePatchBalance() {
  const qc = useQueryClient()
  return (cardNumber: string, balanceAfter: string) =>
    qc.setQueryData<AccountSnapshot>(balanceKey(cardNumber), (prev) =>
      prev ? { ...prev, balance: balanceAfter } : prev)
}
