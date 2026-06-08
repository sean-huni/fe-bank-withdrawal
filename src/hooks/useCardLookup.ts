import { useMutation } from '@tanstack/react-query'
import { lookupCard } from '../api/atm'

export const useCardLookup = () => useMutation({ mutationFn: (card: string) => lookupCard(card) })
