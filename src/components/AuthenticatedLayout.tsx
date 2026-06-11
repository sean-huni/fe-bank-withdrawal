import { Navigate, Outlet } from 'react-router-dom'
import { useSessionStore } from '../stores/sessionStore'
import { useSessionTimeout } from '../hooks/useSessionTimeout'
import { AppBar } from './AppBar'

/** Guards all authenticated routes and runs the idle-timeout once for the whole session. */
export function AuthenticatedLayout() {
  const account = useSessionStore((s) => s.account)
  useSessionTimeout()
  if (!account) return <Navigate to="/" replace />
  return (
    <>
      <AppBar />
      <Outlet />
    </>
  )
}
