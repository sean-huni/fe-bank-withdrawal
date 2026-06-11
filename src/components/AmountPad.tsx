import { QUICK_CASH } from '../config/quickCash'
import { Money } from './Money'
import { useT } from '../i18n/strings'

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
  max,
}: {
  value: string
  onChange: (next: string) => void
  currency?: string
  /** When set, quick-cash chips above this amount are disabled (error prevention). */
  max?: number
}) {
  const t = useT()
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {QUICK_CASH.map((amt) => {
          const selected = value === String(amt)
          const over = max !== undefined && amt > max
          const hintId = `over-hint-${amt}`
          return (
            <button
              key={amt}
              type="button"
              aria-pressed={selected}
              disabled={over}
              aria-describedby={over ? hintId : undefined}
              onClick={() => onChange(String(amt))}
              className={`glass h-16 font-display text-xl active:scale-95 transition disabled:opacity-40 disabled:active:scale-100 ${
                selected ? 'ring-2 ring-accent-cyan text-accent-cyan' : ''
              }`}
            >
              <Money amount={amt} currency={currency} />
              {over && (
                <span id={hintId} aria-hidden="true" className="block text-xs text-rose-300 font-sans">
                  {t('overBalance')}
                </span>
              )}
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
