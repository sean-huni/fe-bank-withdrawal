import { useMutation } from '@tanstack/react-query'
import { verifyPin } from '../api/atm'

export const useVerifyPin = () =>
  useMutation({ mutationFn: (vars: { cardNumber: string; pin: string }) => verifyPin(vars.cardNumber, vars.pin) })
