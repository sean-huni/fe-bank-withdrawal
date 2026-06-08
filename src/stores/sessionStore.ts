import { create } from 'zustand'
import type { AccountSnapshot } from '../api/types'

interface SessionState {
  account: AccountSnapshot | null
  cardNumber: string | null
  startedAt: number | null
  signIn: (account: AccountSnapshot, cardNumber: string) => void
  signOut: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  account: null, cardNumber: null, startedAt: null,
  signIn: (account, cardNumber) => set({ account, cardNumber, startedAt: Date.now() }),
  signOut: () => set({ account: null, cardNumber: null, startedAt: null }),
}))
