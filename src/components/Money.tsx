import { formatMoney } from '../config/currency'

export function Money({ amount, currency }: { amount: string | number; currency?: string }) {
  return <span className="font-mono tabular-nums">{formatMoney(amount, currency)}</span>
}
