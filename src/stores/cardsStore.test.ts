import { describe, it, expect, beforeEach } from 'vitest'
import { useCardsStore } from './cardsStore'

beforeEach(() => { localStorage.clear(); useCardsStore.setState({ cards: [] }) })

describe('cardsStore', () => {
  it('saves a card with a label, de-duplicating by number', () => {
    useCardsStore.getState().save('4539148803436467', 'Alice')
    useCardsStore.getState().save('4539148803436467', 'Alice 2')
    expect(useCardsStore.getState().cards).toHaveLength(1)
    expect(useCardsStore.getState().cards[0].label).toBe('Alice 2')
  })
  it('forgets a card', () => {
    useCardsStore.getState().save('4539148803436467', 'Alice')
    useCardsStore.getState().forget('4539148803436467')
    expect(useCardsStore.getState().cards).toHaveLength(0)
  })
})
