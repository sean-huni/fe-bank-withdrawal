import { z } from 'zod'

// matches backend @Digits(integer=15, fraction=4) but ATM money is 2dp; positive
export const amountSchema = z.string()
  .refine((v) => /^\d{1,15}(\.\d{1,2})?$/.test(v), 'Enter a valid amount (max 2 decimals)')
  .refine((v) => Number(v) > 0, 'Amount must be greater than zero')

export const cardSchema = z.string().refine((v) => /^\d{16}$/.test(v.replace(/\D/g, '')), 'Card must be 16 digits')

export const parseAmount = (v: string) => amountSchema.safeParse(v)
