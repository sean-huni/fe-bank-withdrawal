import { useQuery } from '@tanstack/react-query'
import { statement } from '../api/atm'

export function useStatement(accountId: string | null, page = 0, size = 10) {
  return useQuery({
    queryKey: ['statement', accountId, page, size],
    queryFn: () => statement(accountId as string, page, size),
    enabled: !!accountId,
  })
}
