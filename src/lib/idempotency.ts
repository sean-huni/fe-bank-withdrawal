let lastKey: string | null = null

/** A fresh key for a NEW operation. Reuse the SAME key for retries of that operation. */
export const newIdempotencyKey = (): string => {
  lastKey = crypto.randomUUID()
  return lastKey
}

/** The most recently issued idempotency key, for dev-only display. */
export const lastIdempotencyKey = (): string | null => lastKey
