/**
 * Detects whether the platform authenticator (biometric / device PIN) is
 * available on this device/browser.
 *
 * Sets `passkeyAvailable` in the passkeyStore once per mount.
 * The PasskeyAuth screen and Welcome passkey button both read from the store.
 *
 * Pattern mirrors the-drop PasskeyLoginPage availability check.
 */

import { useEffect } from 'react'
import { usePasskeyStore } from '../stores/passkeyStore'

export function usePasskeyAvailability() {
  const setPasskeyAvailable = usePasskeyStore((s) => s.setPasskeyAvailable)

  useEffect(() => {
    let cancelled = false

    async function check() {
      if (!window.PublicKeyCredential) {
        if (!cancelled) setPasskeyAvailable(false)
        return
      }
      try {
        const available =
          await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        if (!cancelled) setPasskeyAvailable(available)
      } catch {
        if (!cancelled) setPasskeyAvailable(false)
      }
    }

    void check()
    return () => {
      cancelled = true
    }
  // setPasskeyAvailable is a stable store action; exhaustive dep not needed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
