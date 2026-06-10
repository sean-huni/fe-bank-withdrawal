import type { ApiError } from '../api/types'
import { getBeMessage, type Locale } from '../i18n/generated/beMessages'

export interface AtmError { emoji: string; title: string; detail: string; recoverable: boolean }

/** FE UX metadata per wire code — emoji + recoverability only.
 *  Titles derive from the BE i18n bundle (src/i18n/generated/beMessages.ts). */
const BY_CODE: Record<string, { emoji: string; recoverable: boolean }> = {
  CARD_NOT_FOUND:        { emoji: '💳', recoverable: true },
  PIN_INVALID:           { emoji: '🔒', recoverable: true },
  ACCOUNT_NOT_FOUND:     { emoji: '💳', recoverable: true },
  INSUFFICIENT_FUNDS:    { emoji: '💸', recoverable: true },
  VALIDATION_FAILED:     { emoji: '✋', recoverable: true },
  IDEMPOTENCY_CONFLICT:  { emoji: '⏳', recoverable: true },
}

export function mapError(status: number, error: ApiError | null, locale: Locale): AtmError {
  if (status === 0 || error === null) {
    return { emoji: '📡', title: "Can't reach the bank", detail: 'Please try again.', recoverable: true }
  }
  const meta = BY_CODE[error.code] ?? { emoji: '⚠️', recoverable: false }
  // Title: use the BE-originated localized message from the generated catalogue.
  // For wire codes with multiple variants (e.g. IDEMPOTENCY_CONFLICT), pass error.message
  // so the catalogue can pick the exact variant; falls back to the catalogue's default
  // en/sn when no variant matches. Falls back to error.message when code is unknown.
  const title = getBeMessage(error.code, locale, error.message) ?? error.message
  return { ...meta, title, detail: error.message }
}

/** Pull the {status, ApiError} out of an axios error for mapError. */
export function fromAxios(err: unknown): { status: number; error: ApiError | null } {
  const e = err as { response?: { status: number; data?: { error?: ApiError } } }
  if (!e.response) return { status: 0, error: null }
  return { status: e.response.status, error: e.response.data?.error ?? null }
}
