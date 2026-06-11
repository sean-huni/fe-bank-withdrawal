import { describe, it, expect } from 'vitest'
import { navTitle } from './navTitles'

describe('navTitle', () => {
  it('maps each authenticated route to an emoji + i18n key', () => {
    expect(navTitle('/menu')).toEqual({ emoji: '🏦', key: 'menu', noBack: true })
    expect(navTitle('/balance')).toEqual({ emoji: '💰', key: 'balance' })
    expect(navTitle('/withdraw')).toEqual({ emoji: '💸', key: 'withdraw' })
    expect(navTitle('/deposit')).toEqual({ emoji: '🏧', key: 'deposit' })
    expect(navTitle('/statement')).toEqual({ emoji: '🧾', key: 'statement' })
    expect(navTitle('/receipt')).toEqual({ emoji: '✅', key: 'receipt', noBack: true })
  })

  it('falls back to the menu title for unknown paths', () => {
    expect(navTitle('/nope')).toEqual({ emoji: '🏦', key: 'menu', noBack: true })
  })
})
