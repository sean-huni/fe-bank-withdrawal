export const normalizeCard = (input: string): string => input.replace(/\D/g, '')

export function isValidCardNumber(input: string): boolean {
  const digits = normalizeCard(input)
  if (!/^\d{16}$/.test(digits)) return false
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (double) { d *= 2; if (d > 9) d -= 9 }
    sum += d
    double = !double
  }
  return sum % 10 === 0
}
