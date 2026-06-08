import { describe, it, expect } from 'vitest'
import { formatMoney } from './currency'

describe('formatMoney', () => {
  it('formats EUR with grouping and two decimals', () => {
    expect(formatMoney('1000', 'EUR')).toBe('€1,000.00')
  })
  it('accepts numbers', () => {
    expect(formatMoney(250.5, 'EUR')).toBe('€250.50')
  })
})
