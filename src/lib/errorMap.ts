import type { ApiError } from '../api/types'

export interface AtmError { emoji: string; title: string; detail: string; recoverable: boolean }

const BY_CODE: Record<string, Omit<AtmError, 'detail'>> = {
  CARD_NOT_FOUND: { emoji: '💳', title: 'Card not recognised', recoverable: true },
  ACCOUNT_NOT_FOUND: { emoji: '💳', title: 'Account unavailable', recoverable: true },
  INSUFFICIENT_FUNDS: { emoji: '💸', title: 'Not enough funds', recoverable: true },
  VALIDATION_FAILED: { emoji: '✋', title: 'Check the amount', recoverable: true },
  IDEMPOTENCY_CONFLICT: { emoji: '⏳', title: 'Already processing', recoverable: true },
}

export function mapError(status: number, error: ApiError | null): AtmError {
  if (status === 0 || error === null) {
    return { emoji: '📡', title: "Can't reach the bank", detail: 'Please try again.', recoverable: true }
  }
  const base = BY_CODE[error.code] ?? { emoji: '⚠️', title: 'Something went wrong', recoverable: false }
  return { ...base, detail: error.message }
}

/** Pull the {status, ApiError} out of an axios error for mapError. */
export function fromAxios(err: unknown): { status: number; error: ApiError | null } {
  const e = err as { response?: { status: number; data?: { error?: ApiError } } }
  if (!e.response) return { status: 0, error: null }
  return { status: e.response.status, error: e.response.data?.error ?? null }
}
