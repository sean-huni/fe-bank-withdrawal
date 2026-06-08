import { Navigate, Outlet } from 'react-router-dom'
import { useSessionStore } from '../stores/sessionStore'
import { useSessionTimeout } from '../hooks/useSessionTimeout'

/** Guards all authenticated routes and runs the idle-timeout once for the whole session. */
export function AuthenticatedLayout() {
  const account = useSessionStore((s) => s.account)
  useSessionTimeout()
  return account ? <Outlet /> : <Navigate to="/" replace />
}
