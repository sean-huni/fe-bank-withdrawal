import { describe, it, expect } from 'vitest'
import { mapError } from './errorMap'

describe('mapError', () => {
  it('maps insufficient funds (422)', () => {
    const r = mapError(422, { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient funds for withdrawal' })
    expect(r.emoji).toBe('💸')
    expect(r.title).toMatch(/not enough/i)
    expect(r.detail).toBe('Insufficient funds for withdrawal')
    expect(r.recoverable).toBe(true)
  })
  it('maps unknown card (404)', () => {
    expect(mapError(404, { code: 'CARD_NOT_FOUND', message: 'Card not recognised' }).emoji).toBe('💳')
  })
  it('falls back for unknown codes', () => {
    expect(mapError(500, { code: 'INTERNAL_ERROR', message: 'x' }).emoji).toBe('⚠️')
  })
  it('handles a network error (no response)', () => {
    expect(mapError(0, null).emoji).toBe('📡')
  })
})
