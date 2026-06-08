import { describe, it, expect } from 'vitest'
import { isValidCardNumber, normalizeCard } from './luhn'

describe('luhn', () => {
  it('accepts a valid seeded card', () => {
    expect(isValidCardNumber('4539148803436467')).toBe(true)
  })
  it('strips spaces before validating', () => {
    expect(isValidCardNumber('4539 1488 0343 6467')).toBe(true)
  })
  it('rejects wrong length', () => {
    expect(isValidCardNumber('12345')).toBe(false)
  })
  it('rejects a bad checksum', () => {
    expect(isValidCardNumber('4539148803436460')).toBe(false)
  })
  it('normalizes to digits only', () => {
    expect(normalizeCard('4539 1488 0343 6467')).toBe('4539148803436467')
  })
})
