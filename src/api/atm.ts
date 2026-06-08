import { api } from './client'
import type { AccountSnapshot, ApiResponse, Page, Transaction } from './types'

export async function lookupCard(cardNumber: string): Promise<AccountSnapshot> {
  const { data } = await api.get<ApiResponse<AccountSnapshot>>(`/cards/${cardNumber}`)
  return data.data as AccountSnapshot
}

export async function withdraw(accountId: string, amount: string, idempotencyKey: string): Promise<Transaction> {
  const { data } = await api.post<ApiResponse<Transaction>>(
    `/accounts/${accountId}/withdrawals`, { amount }, { headers: { 'Idempotency-Key': idempotencyKey } })
  return data.data as Transaction
}

export async function deposit(accountId: string, amount: string, idempotencyKey: string): Promise<Transaction> {
  const { data } = await api.post<ApiResponse<Transaction>>(
    `/accounts/${accountId}/deposits`, { amount }, { headers: { 'Idempotency-Key': idempotencyKey } })
  return data.data as Transaction
}

export async function statement(accountId: string, page = 0, size = 10): Promise<Page<Transaction>> {
  const { data } = await api.get<ApiResponse<Page<Transaction>>>(
    `/accounts/${accountId}/transactions`, { params: { page, size, sort: 'createdAt,desc' } })
  return data.data as Page<Transaction>
}
