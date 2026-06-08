import { describe, it, expect } from 'vitest'
import { parseAmount, cardSchema } from './validation'

describe('amountSchema / parseAmount', () => {
  it('accepts an integer amount', () => {
    expect(parseAmount('50').success).toBe(true)
  })
  it('accepts a 2-decimal amount', () => {
    expect(parseAmount('50.25').success).toBe(true)
  })
  it('rejects 3 decimals', () => {
    expect(parseAmount('50.255').success).toBe(false)
  })
  it('rejects zero', () => {
    expect(parseAmount('0').success).toBe(false)
  })
  it('rejects negative', () => {
    expect(parseAmount('-5').success).toBe(false)
  })
  it('rejects non-numeric', () => {
    expect(parseAmount('abc').success).toBe(false)
  })
  it('rejects multi-dot', () => {
    expect(parseAmount('1.2.3').success).toBe(false)
  })
  it('surfaces a friendly message on failure', () => {
    const r = parseAmount('50.255')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toMatch(/max 2 decimals/)
  })
})

describe('cardSchema', () => {
  it('accepts a spaced 16-digit card', () => {
    expect(cardSchema.safeParse('4539 1488 0343 6467').success).toBe(true)
  })
  it('accepts a bare 16-digit card', () => {
    expect(cardSchema.safeParse('4539148803436467').success).toBe(true)
  })
  it('rejects the wrong length', () => {
    expect(cardSchema.safeParse('4539 1488').success).toBe(false)
  })
})
