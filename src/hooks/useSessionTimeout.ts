import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../stores/sessionStore'

const IDLE_MS = 60_000

export function useSessionTimeout() {
  const navigate = useNavigate()
  const signOut = useSessionStore((s) => s.signOut)
  useEffect(() => {
    let timer: number
    const reset = () => { window.clearTimeout(timer); timer = window.setTimeout(() => { signOut(); navigate('/') }, IDLE_MS) }
    const events = ['click', 'keydown', 'touchstart'] as const
    events.forEach((e) => window.addEventListener(e, reset))
    reset()
    return () => { window.clearTimeout(timer); events.forEach((e) => window.removeEventListener(e, reset)) }
  }, [navigate, signOut])
}
