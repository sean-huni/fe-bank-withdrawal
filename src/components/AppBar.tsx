import { useLocation, useNavigate } from 'react-router-dom'
import { navTitle } from '../config/navTitles'
import { useT } from '../i18n/strings'
import { useExitSession } from '../hooks/useExitSession'

export function AppBar() {
  const t = useT()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const exitSession = useExitSession()
  const title = navTitle(pathname)

  return (
    <header className="glass w-full grid grid-cols-[1fr_auto_1fr] items-center px-3 py-2 mb-3">
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
      <h1 className="font-display text-center text-lg">
        {title.emoji} {t(title.key)}
      </h1>
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
