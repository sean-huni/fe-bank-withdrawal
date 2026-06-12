import { useEffect, useId, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { NAV_DESTINATIONS, navTitle } from '../config/navTitles'
import { useT } from '../i18n/strings'

/** App-bar title that doubles as a cross-screen navigation dropdown. */
export function NavMenu() {
  const t = useT()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const title = navTitle(pathname)

  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function go(to: string) {
    setOpen(false)
    if (to !== pathname) navigate(to)
  }

  return (
    <div ref={rootRef} className="relative">
      <h1 className="font-display text-lg">
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen((o) => !o)}
          className="px-2 py-1 active:scale-95 transition"
        >
          {title.emoji} {t(title.key)}{' '}
          <span aria-hidden="true" className="text-xs text-slate-500">
            ▾
          </span>
        </button>
      </h1>
      {open && (
        <>
          {/* Touch-first kiosk, 4 items: APG roving-focus/arrow-key navigation intentionally omitted. */}
          <div
            id={menuId}
            role="menu"
            aria-label={t('menu')}
            className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-40 glass p-1 w-44 shadow-2xl"
          >
            {NAV_DESTINATIONS.map((to) => {
              const item = navTitle(to)
              const current = to === pathname
              return (
                <button
                  key={to}
                  type="button"
                  role="menuitem"
                  aria-current={current ? 'page' : undefined}
                  onClick={() => go(to)}
                  className={`w-full text-left px-3 py-2 rounded-xl transition hover:bg-surface-700/40 ${
                    current ? 'bg-accent-cyan/15 text-accent-cyan' : ''
                  }`}
                >
                  {item.emoji} {t(item.key)}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
