import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useSessionStore } from '../stores/sessionStore'
import { useSessionTimeout } from '../hooks/useSessionTimeout'
import { AppBar } from './AppBar'
import { SessionTimeoutDialog } from './SessionTimeoutDialog'
import { useT } from '../i18n/strings'

/** Guards all authenticated routes, owns the ATM card shell, and runs the idle-timeout. */
export function AuthenticatedLayout() {
  const t = useT()
  const account = useSessionStore((s) => s.account)
  const { secondsLeft, keepAlive } = useSessionTimeout()
  const { pathname } = useLocation()
  if (!account) return <Navigate to="/" replace />
  return (
    <>
      <motion.section
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="glass w-full max-w-md shadow-2xl"
        aria-label={t('atm')}
      >
        <AppBar />
        <div className="p-6 sm:p-8">
          <Outlet />
        </div>
      </motion.section>
      {/* Sibling of the animated card: a transformed ancestor would become the containing
          block for this fixed overlay and clip it. */}
      <SessionTimeoutDialog secondsLeft={secondsLeft} onContinue={keepAlive} />
    </>
  )
}
