import { describe, it, expect } from 'vitest'
import { mapError } from './errorMap'

describe('mapError', () => {
  it('maps insufficient funds (422) — title from BE catalogue (en), not raw server text', () => {
    // message is deliberately distinct from the catalogue value to prove the catalogue is consulted
    const r = mapError(422, { code: 'INSUFFICIENT_FUNDS', message: 'raw-server-text' }, 'en')
    expect(r.emoji).toBe('💸')
    // title must equal the CATALOGUE value, not the raw server message
    expect(r.title).toBe('Insufficient funds for withdrawal')
    // detail is the raw server message, not the catalogue
    expect(r.detail).toBe('raw-server-text')
    expect(r.recoverable).toBe(true)
  })

  it('maps insufficient funds (422) — title localised to sn via catalogue', () => {
    // message is deliberately distinct to prove the catalogue, not the raw text, drives title
    const r = mapError(422, { code: 'INSUFFICIENT_FUNDS', message: 'raw-server-text' }, 'sn')
    expect(r.emoji).toBe('💸')
    expect(r.title).toBe('Mari haikwane kubvisa')
    expect(r.detail).toBe('raw-server-text')
    expect(r.recoverable).toBe(true)
  })

  it('maps unknown card (404) — emoji correct', () => {
    expect(mapError(404, { code: 'CARD_NOT_FOUND', message: 'raw-server-text' }, 'en').emoji).toBe('💳')
  })

  it('maps unknown card (404) — title from BE catalogue, not raw server text', () => {
    // raw message is distinct; title must come from catalogue
    expect(mapError(404, { code: 'CARD_NOT_FOUND', message: 'raw-server-text' }, 'en').title)
      .toBe('Card not recognised')
  })

  it('falls back to error.message as title for unknown codes', () => {
    const r = mapError(500, { code: 'INTERNAL_ERROR', message: 'x' }, 'en')
    expect(r.emoji).toBe('⚠️')
    // INTERNAL_ERROR is in the catalogue
    expect(r.title).toBe('An unexpected error occurred')
  })

  it('falls back for truly unknown codes not in catalogue', () => {
    const r = mapError(500, { code: 'TOTALLY_UNKNOWN_CODE', message: 'server exploded' }, 'en')
    expect(r.emoji).toBe('⚠️')
    expect(r.title).toBe('server exploded') // falls back to error.message
    expect(r.recoverable).toBe(false)
  })

  it('handles a network error (no response)', () => {
    expect(mapError(0, null, 'en').emoji).toBe('📡')
  })
})
