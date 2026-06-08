import { useLocaleStore } from '../stores/localeStore'
import type { Locale } from '../stores/localeStore'

const OPTIONS: { value: Locale; label: string }[] = [
  { value: 'en', label: '🇬🇧 EN' },
  { value: 'sn', label: '🇿🇼 SN' },
]

export function LanguageToggle() {
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)
  return (
    <div className="glass flex p-1 text-sm font-display" role="group" aria-label="Language">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={locale === o.value}
          onClick={() => setLocale(o.value)}
          className={`px-3 py-1 rounded-xl transition ${
            locale === o.value ? 'bg-surface-700 text-accent-cyan' : 'text-slate-400'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
