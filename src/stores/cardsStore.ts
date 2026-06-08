import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SavedCard { cardNumber: string; label: string }
interface CardsState {
  cards: SavedCard[]
  save: (cardNumber: string, label: string) => void
  forget: (cardNumber: string) => void
}

export const useCardsStore = create<CardsState>()(
  persist((set) => ({
    cards: [],
    save: (cardNumber, label) => set((s) => ({
      cards: [...s.cards.filter((c) => c.cardNumber !== cardNumber), { cardNumber, label }],
    })),
    forget: (cardNumber) => set((s) => ({ cards: s.cards.filter((c) => c.cardNumber !== cardNumber) })),
  }), { name: 'atm-cards' }))
