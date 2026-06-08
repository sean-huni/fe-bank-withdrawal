/** A fresh key for a NEW operation. Reuse the SAME key for retries of that operation. */
export const newIdempotencyKey = (): string => crypto.randomUUID()
