import { useLocation, useNavigate } from 'react-router-dom'
import { navTitle } from '../config/navTitles'
import { useT } from '../i18n/strings'
import { useExitSession } from '../hooks/useExitSession'
import { NavMenu } from './NavMenu'

/** Attached header of the ATM card: Back / NavMenu title / Exit. */
export function AppBar() {
  const t = useT()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const exitSession = useExitSession()
  const title = navTitle(pathname)

  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center px-3 py-2 rounded-t-2xl bg-surface-900/40 border-b border-surface-700/50">
      <div className="justify-self-start">
        {!title.noBack && (
          <button
            type="button"
            onClick={() => navigate('/menu')}
            className="text-accent-cyan font-display px-2 py-1 active:scale-95 transition"
          >
            <span aria-hidden="true">◀ </span>
            {t('back')}
          </button>
        )}
      </div>
      <NavMenu />
      <button
        type="button"
        onClick={exitSession}
        className="justify-self-end text-slate-400 hover:text-slate-200 px-2 py-1 transition"
      >
        🚪 {t('exit')}
      </button>
    </header>
  )
}
