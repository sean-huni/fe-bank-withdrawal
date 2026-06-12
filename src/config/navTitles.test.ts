import { describe, it, expect } from 'vitest'
import { NAV_DESTINATIONS, navTitle } from './navTitles'

describe('navTitle', () => {
  it('maps each authenticated route to an emoji + i18n key + noBack flag', () => {
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

  it('exposes the four cross-screen destinations in display order', () => {
    expect(NAV_DESTINATIONS).toEqual(['/balance', '/withdraw', '/deposit', '/statement'])
    for (const to of NAV_DESTINATIONS) {
      expect(navTitle(to).key).not.toBe('menu') // every destination has its own mapped title
    }
  })
})
