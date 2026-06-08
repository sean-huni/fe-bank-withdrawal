import { create } from 'zustand'
import type { AccountSnapshot } from '../api/types'

interface SessionState {
  account: AccountSnapshot | null
  cardNumber: string | null
  pendingCardNumber: string | null
  pendingHolderName: string | null
  startedAt: number | null
  setPending: (cardNumber: string, holderName: string) => void
  signIn: (account: AccountSnapshot, cardNumber: string) => void
  patchBalance: (balanceAfter: string) => void
  signOut: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  account: null, cardNumber: null, pendingCardNumber: null, pendingHolderName: null, startedAt: null,
  setPending: (cardNumber, holderName) => set({ pendingCardNumber: cardNumber, pendingHolderName: holderName }),
  signIn: (account, cardNumber) =>
    set({ account, cardNumber, pendingCardNumber: null, pendingHolderName: null, startedAt: Date.now() }),
  patchBalance: (balanceAfter) =>
    set((s) => (s.account ? { account: { ...s.account, balance: balanceAfter } } : s)),
  signOut: () => set({ account: null, cardNumber: null, pendingCardNumber: null, pendingHolderName: null, startedAt: null }),
}))
