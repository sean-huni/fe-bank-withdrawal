import { describe, it, expect } from 'vitest'
import { mapError } from './errorMap'

describe('mapError', () => {
  it('maps insufficient funds (422) — title from BE catalogue (en)', () => {
    const r = mapError(422, { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient funds for withdrawal' })
    expect(r.emoji).toBe('💸')
    // Title now derives from the generated BE catalogue, not a hand-maintained FE copy.
    expect(r.title).toBe('Insufficient funds for withdrawal')
    expect(r.detail).toBe('Insufficient funds for withdrawal')
    expect(r.recoverable).toBe(true)
  })

  it('maps insufficient funds (422) — title localised to sn via catalogue', () => {
    const r = mapError(422, { code: 'INSUFFICIENT_FUNDS', message: 'Mari haikwane kubvisa' }, 'sn')
    expect(r.emoji).toBe('💸')
    expect(r.title).toBe('Mari haikwane kubvisa')
    expect(r.recoverable).toBe(true)
  })

  it('maps unknown card (404) — emoji correct', () => {
    expect(mapError(404, { code: 'CARD_NOT_FOUND', message: 'Card not recognised' }).emoji).toBe('💳')
  })

  it('maps unknown card (404) — title from BE catalogue', () => {
    expect(mapError(404, { code: 'CARD_NOT_FOUND', message: 'Card not recognised' }).title)
      .toBe('Card not recognised')
  })

  it('falls back to error.message as title for unknown codes', () => {
    const r = mapError(500, { code: 'INTERNAL_ERROR', message: 'x' })
    expect(r.emoji).toBe('⚠️')
    // INTERNAL_ERROR is in the catalogue
    expect(r.title).toBe('An unexpected error occurred')
  })

  it('falls back for truly unknown codes not in catalogue', () => {
    const r = mapError(500, { code: 'TOTALLY_UNKNOWN_CODE', message: 'server exploded' })
    expect(r.emoji).toBe('⚠️')
    expect(r.title).toBe('server exploded') // falls back to error.message
    expect(r.recoverable).toBe(false)
  })

  it('handles a network error (no response)', () => {
    expect(mapError(0, null).emoji).toBe('📡')
  })
})
