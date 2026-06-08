export interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: ApiError | null
  timestamp: string
  traceId: string
}
export interface ApiError {
  code: string
  message: string
  violations?: { field: string; code: string | null; message: string; rejectedValue?: string }[]
}
export interface AccountSnapshot {
  accountId: string
  holderName: string
  maskedCardNumber: string
  balance: string
  currency: string
}
export type TransactionType = 'DEBIT' | 'CREDIT'
export interface Transaction {
  transactionId: string
  accountId: string
  type: TransactionType
  amount: string
  balanceAfter: string
  occurredAt: string
}
export interface Page<T> { content: T[]; page: { size: number; number: number; totalElements: number; totalPages: number } }
