import { useLocation, useNavigate } from 'react-router-dom'
import { useSessionStore } from '../stores/sessionStore'
import { navTitle } from '../config/navTitles'
import { useT } from '../i18n/strings'

/** Screens where Back makes no sense: menu is the root; a receipt is final. */
const NO_BACK = ['/menu', '/receipt']

export function AppBar() {
  const t = useT()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const signOut = useSessionStore((s) => s.signOut)
  const title = navTitle(pathname)
  const showBack = !NO_BACK.includes(pathname)

  return (
    <header className="glass w-full flex items-center px-3 py-2 mb-3">
      {showBack ? (
        <button
          type="button"
          onClick={() => navigate('/menu')}
          className="text-accent-cyan font-display px-2 py-1 active:scale-95 transition"
        >
          ◀ {t('back')}
        </button>
      ) : (
        <span aria-hidden className="px-2 py-1">&emsp;&emsp;</span>
      )}
      <h1 className="font-display flex-1 text-center text-lg">
        {title.emoji} {t(title.key)}
      </h1>
      <button
        type="button"
        onClick={() => {
          signOut()
          navigate('/')
        }}
        className="text-slate-400 hover:text-slate-200 px-2 py-1 transition"
      >
        🚪 {t('exit')}
      </button>
    </header>
  )
}
