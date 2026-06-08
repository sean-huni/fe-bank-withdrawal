export function formatMoney(amount: string | number, currency = 'EUR', locale = 'en-IE'): string {
  const value = typeof amount === 'string' ? Number(amount) : amount
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value)
}
