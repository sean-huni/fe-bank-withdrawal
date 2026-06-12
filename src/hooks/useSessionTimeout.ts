import { useCallback, useEffect, useRef, useState } from 'react'
import { useSessionStore } from '../stores/sessionStore'

const IDLE_MS = 60_000
const WARN_MS = 15_000
const TICK_MS = 250

/**
 * Client-side idle timeout. `secondsLeft` is the warning countdown in whole
 * seconds (null while no warning is active). Any user interaction resets the
 * window; `keepAlive` resets it explicitly (e.g. the dialog's Continue button).
 */
export function useSessionTimeout(): { secondsLeft: number | null; keepAlive: () => void } {
  const signOut = useSessionStore((s) => s.signOut)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const resetRef = useRef<() => void>(() => {})

  useEffect(() => {
    let warnTimer: number
    let tick: number
    let deadline = 0

    const clearTimers = () => {
      window.clearTimeout(warnTimer)
      window.clearInterval(tick)
    }

    const reset = () => {
      clearTimers()
      setSecondsLeft(null)
      deadline = Date.now() + IDLE_MS
      warnTimer = window.setTimeout(() => {
        setSecondsLeft(WARN_MS / 1000)
        tick = window.setInterval(() => {
          const left = Math.ceil((deadline - Date.now()) / 1000)
          if (left <= 0) {
            clearTimers()
            signOut()
            // AuthenticatedLayout's <Navigate> guard redirects once the account clears.
          } else {
            setSecondsLeft(left)
          }
        }, TICK_MS)
      }, IDLE_MS - WARN_MS)
    }
    resetRef.current = reset

    const events = ['click', 'keydown', 'touchstart'] as const
    events.forEach((e) => window.addEventListener(e, reset))
    reset()
    return () => {
      clearTimers()
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [signOut])

  const keepAlive = useCallback(() => resetRef.current(), [])
  return { secondsLeft, keepAlive }
}
