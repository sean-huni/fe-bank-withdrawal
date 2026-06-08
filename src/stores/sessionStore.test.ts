import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from './sessionStore'
import type { AccountSnapshot } from '../api/types'

const account: AccountSnapshot = {
  accountId: 'acc-1', holderName: 'Alice', maskedCardNumber: '•••• 6467', balance: '1000.00', currency: 'EUR',
}

beforeEach(() => useSessionStore.getState().signOut())

describe('sessionStore', () => {
  it('holds a pending card before auth, then the full account after signIn', () => {
    useSessionStore.getState().setPending('4539148803436467', 'Alice')
    expect(useSessionStore.getState().pendingCardNumber).toBe('4539148803436467')
    expect(useSessionStore.getState().account).toBeNull()
    useSessionStore.getState().signIn(account, '4539148803436467')
    expect(useSessionStore.getState().account?.balance).toBe('1000.00')
  })
  it('patches the balance from a transaction', () => {
    useSessionStore.getState().signIn(account, '4539148803436467')
    useSessionStore.getState().patchBalance('950.00')
    expect(useSessionStore.getState().account?.balance).toBe('950.00')
  })
  it('signOut clears pending and account', () => {
    useSessionStore.getState().setPending('4539148803436467', 'Alice')
    useSessionStore.getState().signOut()
    expect(useSessionStore.getState().pendingCardNumber).toBeNull()
    expect(useSessionStore.getState().account).toBeNull()
  })
})
