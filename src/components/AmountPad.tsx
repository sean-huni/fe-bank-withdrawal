import { QUICK_CASH } from '../config/quickCash'
import { Money } from './Money'

/** Keep only digits and a single decimal point with at most 2 fraction digits. */
function sanitizeAmount(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot === -1) return cleaned
  const intPart = cleaned.slice(0, firstDot)
  const fracPart = cleaned.slice(firstDot + 1).replace(/\./g, '').slice(0, 2)
  return `${intPart}.${fracPart}`
}

export function AmountPad({
  value,
  onChange,
  currency = 'EUR',
}: {
  value: string
  onChange: (next: string) => void
  currency?: string
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {QUICK_CASH.map((amt) => {
          const selected = value === String(amt)
          return (
            <button
              key={amt}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(String(amt))}
              className={`glass h-16 font-display text-xl active:scale-95 transition ${
                selected ? 'ring-2 ring-accent-cyan text-accent-cyan' : ''
              }`}
            >
              <Money amount={amt} currency={currency} />
            </button>
          )
        })}
      </div>
      <label className="block">
        <span className="text-slate-400 text-sm">Custom amount</span>
        <input
          value={value}
          inputMode="decimal"
          placeholder="0.00"
          onChange={(e) => onChange(sanitizeAmount(e.target.value))}
          className="glass w-full p-4 mt-1 font-mono text-lg tabular-nums"
        />
      </label>
    </div>
  )
}
