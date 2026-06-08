import { Navigate, Outlet } from 'react-router-dom'
import { useSessionStore } from '../stores/sessionStore'

export function RequireSession() {
  const account = useSessionStore((s) => s.account)
  return account ? <Outlet /> : <Navigate to="/" replace />
}
