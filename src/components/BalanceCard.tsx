import { Money } from './Money'
import { useT } from '../i18n/strings'

/** Prominent available-balance banner for transaction screens. */
export function BalanceCard({ amount, currency }: { amount: string; currency?: string }) {
  const t = useT()
  return (
    <div className="glass !border-accent-cyan/40 bg-accent-cyan/10 flex items-baseline justify-between px-4 py-3 mb-4">
      <span className="text-accent-cyan text-xs uppercase tracking-widest">{t('available')}</span>
      <span className="font-display text-xl text-accent-cyan">
        <Money amount={amount} currency={currency} />
      </span>
    </div>
  )
}
