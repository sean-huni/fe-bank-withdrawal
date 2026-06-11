import { Navigate, Outlet } from 'react-router-dom'
import { useSessionStore } from '../stores/sessionStore'
import { useSessionTimeout } from '../hooks/useSessionTimeout'
import { AppBar } from './AppBar'
import { SessionTimeoutDialog } from './SessionTimeoutDialog'

/** Guards all authenticated routes and runs the idle-timeout once for the whole session. */
export function AuthenticatedLayout() {
  const account = useSessionStore((s) => s.account)
  const secondsLeft = useSessionTimeout()
  if (!account) return <Navigate to="/" replace />
  return (
    <>
      <AppBar />
      <Outlet />
      <SessionTimeoutDialog secondsLeft={secondsLeft} />
    </>
  )
}
