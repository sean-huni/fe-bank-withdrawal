import { useT } from '../i18n/strings'

export function Pager({
  page,
  totalPages,
  onPage,
  disabled,
}: {
  page: number
  totalPages: number
  onPage: (page: number) => void
  disabled?: boolean
}) {
  const t = useT()
  const label = t('pageOf')
    .replace('{x}', String(page + 1))
    .replace('{y}', String(totalPages))
  return (
    <nav aria-label={t('pagination')} className="flex items-center justify-between gap-3 mt-4">
      <button
        type="button"
        disabled={disabled || page === 0}
        onClick={() => onPage(page - 1)}
        className="glass p-4 font-display active:scale-95 transition disabled:opacity-40"
      >
        ◀ {t('prev')}
      </button>
      <span className="text-slate-400 text-sm whitespace-nowrap">{label}</span>
      <button
        type="button"
        disabled={disabled || page + 1 >= totalPages}
        onClick={() => onPage(page + 1)}
        className="glass p-4 font-display active:scale-95 transition disabled:opacity-40"
      >
        {t('next')} ▶
      </button>
    </nav>
  )
}
