/**
 * EnablePasskey — one-time post-PIN prompt screen.
 *
 * Shown once per session after a successful card+PIN authentication if:
 *   1. The device supports platform authenticators
 *   2. The account does NOT already have a passkey enrolled
 *   3. The user has not dismissed it yet this session (tracked via sessionStorage)
 *
 * The user can enroll or skip. Either action proceeds to /menu.
 * On enrollment failure the user is still routed to /menu (non-blocking UX).
 *
 * NOTE: sessionStorage helpers live in src/lib/passkeyPrompt.ts to satisfy
 * react-refresh/only-export-components (mixing non-component exports with a
 * component in the same file breaks fast-refresh).
 */

import { useRef } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { ScreenFrame } from '../components/ScreenFrame'
import { usePasskeyStore } from '../stores/passkeyStore'
import { useSessionStore } from '../stores/sessionStore'
import { useT } from '../i18n/strings'
import { markPasskeyPromptDismissed } from '../lib/passkeyPrompt'

export function EnablePasskey() {
  const t = useT()
  const navigate = useNavigate()
  const account = useSessionStore((s) => s.account)
  const enrollState = usePasskeyStore((s) => s.enrollState)
  const enrollPasskey = usePasskeyStore((s) => s.enrollPasskey)
  const resetEnrollState = usePasskeyStore((s) => s.resetEnrollState)

  // Guard ref: prevent re-launching enrollment on re-renders (patterns.md footgun)
  const enrollingRef = useRef(false)

  // No active session — return null (after ALL hooks, per patterns.md hook-ordering rule)
  const hasAccount = !!account

  function proceed() {
    markPasskeyPromptDismissed()
    navigate('/menu', { replace: true })
  }

  async function handleEnroll() {
    if (enrollingRef.current) return
    enrollingRef.current = true
    try {
      await enrollPasskey()
      toast.success(`🔐 ${t('passkeyReady')}`)
      proceed()
    } catch {
      // Read enrollError from store directly (not from stale render closure).
      const isCancel = usePasskeyStore.getState().enrollError === 'cancelled'
      if (!isCancel) {
        toast.error(t('passkeyEnrollError'))
      }
      // Re-arm so user can try again if they want (don't navigate on cancel)
      enrollingRef.current = false
      resetEnrollState()
    }
  }

  function handleSkip() {
    proceed()
  }

  if (!hasAccount) return <Navigate to="/" replace />

  const isBusy = enrollState === 'authenticating'

  return (
    <ScreenFrame title={`🔐 ${t('enablePasskey')}`}>
      <AnimatePresence mode="wait">
        {enrollState === 'success' ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-2"
          >
            <div className="text-5xl">✅</div>
            <p className="text-accent-cyan font-display">{t('passkeyReady')}</p>
            <p className="text-slate-400 text-sm">{t('passkeyReadyHint')}</p>
          </motion.div>
        ) : (
          <motion.div
            key="prompt"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <p className="text-slate-400 mb-6">{t('enablePasskeyHint')}</p>

            {isBusy && (
              <p className="text-accent-cyan text-sm mb-4 animate-pulse">
                {t('passkeyAuthenticating')} — {t('passkeyAuthenticatingHint')}
              </p>
            )}

            <div className="space-y-3">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void handleEnroll()}
                className="glass w-full p-4 text-accent-cyan font-display active:scale-95 transition disabled:opacity-50"
              >
                {isBusy ? '⏳' : '🔐'} {t('enableNow')}
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={handleSkip}
                className="glass w-full p-4 text-slate-400 font-display active:scale-95 transition disabled:opacity-50"
              >
                {t('skipForNow')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </ScreenFrame>
  )
}
