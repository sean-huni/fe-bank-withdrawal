/**
 * PasskeyAuth — standalone screen for username-less passkey authentication.
 *
 * State machine: idle | authenticating | success | error
 * Mirrors the-drop-fe PasskeyLoginPage style:
 *   - isSupported check (PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable)
 *   - framer-motion animated state transitions
 *   - react-hot-toast for success/error
 *   - NotAllowedError vs server error classification (error === 'cancelled')
 *   - once-per-trigger guard ref (patterns.md footgun)
 *
 * Display state derives directly from the store — no local mirror copy — to
 * avoid the react-hooks/set-state-in-effect lint rule.
 */

import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { ScreenFrame } from '../components/ScreenFrame'
import { usePasskeyStore } from '../stores/passkeyStore'
import { useT } from '../i18n/strings'

export function PasskeyAuth() {
  const t = useT()
  const navigate = useNavigate()

  const authState = usePasskeyStore((s) => s.authState)
  const authError = usePasskeyStore((s) => s.authError)
  const loginWithPasskey = usePasskeyStore((s) => s.loginWithPasskey)
  const resetAuthState = usePasskeyStore((s) => s.resetAuthState)
  const passkeyAvailable = usePasskeyStore((s) => s.passkeyAvailable)

  // Prevent double-trigger (patterns.md once-per-value guard ref)
  const triggerRef = useRef(false)

  // Success: navigate + toast (side-effect on store state change — appropriate useEffect use)
  useEffect(() => {
    if (authState === 'success') {
      toast.success('Welcome back!')
      setTimeout(() => navigate('/menu', { replace: true }), 500)
    }
  // navigate is stable; only re-run when authState becomes 'success'
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState])

  // Error: show toast + re-arm guard ref
  useEffect(() => {
    if (authState === 'error') {
      const isCancelled = authError === 'cancelled'
      if (!isCancelled) toast.error(t('passkeyError'))
      triggerRef.current = false // re-arm for retry
    }
  // t is stable (locale-derived); authError changes with authState
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState])

  async function handlePasskeyAuth() {
    if (triggerRef.current) return
    triggerRef.current = true
    resetAuthState()
    try {
      await loginWithPasskey()
    } catch {
      // error state handled via useEffect above
    }
  }

  function handleUseCard() {
    resetAuthState()
    navigate('/', { replace: true })
  }

  // Derive display from store directly
  const isIdle = authState === 'idle'
  const isAuthenticating = authState === 'authenticating'
  const isSuccess = authState === 'success'
  const isError = authState === 'error'
  const isCancelled = authError === 'cancelled'
  const errorMsg = isCancelled ? t('passkeyCancelled') : (authError ?? t('passkeyError'))

  return (
    <ScreenFrame title={`🔐 ${t('tapToAuth')}`}>
      {/* Platform authenticator not available — informational only */}
      {!passkeyAvailable ? (
        <div className="text-center space-y-4">
          <p className="text-slate-400">{t('passkeyNotSupported')}</p>
          <button
            type="button"
            onClick={handleUseCard}
            className="glass w-full p-4 text-accent-cyan font-display active:scale-95 transition"
          >
            💳 {t('insertCard')}
          </button>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {isIdle && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <p className="text-slate-400 mb-4">{t('tapToAuthHint')}</p>
              <button
                type="button"
                onClick={() => void handlePasskeyAuth()}
                className="glass w-full p-4 text-accent-cyan font-display text-lg active:scale-95 transition"
              >
                🔐 {t('tapToAuth')}
              </button>
              <button
                type="button"
                onClick={handleUseCard}
                className="glass w-full p-3 text-slate-400 font-display text-sm active:scale-95 transition"
              >
                💳 {t('insertCard')}
              </button>
            </motion.div>
          )}

          {isAuthenticating && (
            <motion.div
              key="authenticating"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="text-center space-y-4"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="text-5xl"
              >
                🔐
              </motion.div>
              <p className="text-accent-cyan font-display animate-pulse">{t('passkeyAuthenticating')}</p>
              <p className="text-slate-400 text-sm">{t('passkeyAuthenticatingHint')}</p>
              <button
                type="button"
                onClick={() => { resetAuthState(); triggerRef.current = false }}
                className="text-sm text-slate-500 hover:text-slate-300"
              >
                {t('cancel')}
              </button>
            </motion.div>
          )}

          {isSuccess && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-2"
            >
              <div className="text-5xl">✅</div>
              <p className="text-accent-cyan font-display">{t('passkeyReady')}</p>
            </motion.div>
          )}

          {isError && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <p role="alert" className="text-rose-400 text-sm text-center">{errorMsg}</p>
              <button
                type="button"
                onClick={() => { resetAuthState(); triggerRef.current = false }}
                className="glass w-full p-4 text-accent-cyan font-display active:scale-95 transition"
              >
                🔐 {t('tapToAuth')}
              </button>
              <button
                type="button"
                onClick={handleUseCard}
                className="glass w-full p-3 text-slate-400 font-display text-sm active:scale-95 transition"
              >
                💳 {t('insertCard')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </ScreenFrame>
  )
}
