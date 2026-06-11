/**
 * Passkey / WebAuthn client state.
 *
 * Follows the-drop-fe authStore shape:
 *   options call → lazy-import ceremony → verify call → state update
 *
 * State machine: idle | authenticating | success | error
 *
 * passkeyAvailable — platform authenticator availability (set once on mount by
 *   usePasskeyAvailability hook).
 * passkeyEnrolled  — whether the current session's account has a passkey registered
 *   (set from the atm/session response or after successful enrollment).
 * authState        — ceremony progress for the passkey-auth flow.
 * enrollState      — ceremony progress for the passkey-register flow.
 */

import { create } from 'zustand'
import {
  getAuthOptions,
  finishAuthentication,
  getRegistrationOptions,
  finishRegistration,
  whoami,
} from '../api/passkey'
import { useSessionStore } from './sessionStore'

// ── Types ────────────────────────────────────────────────────────────────────

export type CeremonyState = 'idle' | 'authenticating' | 'success' | 'error'

export interface PasskeyState {
  passkeyAvailable: boolean
  passkeyEnrolled: boolean
  authState: CeremonyState
  authError: string | null
  enrollState: CeremonyState
  enrollError: string | null
}

export interface PasskeyActions {
  setPasskeyAvailable: (available: boolean) => void
  setPasskeyEnrolled: (enrolled: boolean) => void

  /** Run the discoverable-credential authentication ceremony. Throws on failure. */
  loginWithPasskey: () => Promise<void>

  /** Run the registration ceremony. Requires an active card+PIN session. Throws on failure. */
  enrollPasskey: () => Promise<void>

  resetAuthState: () => void
  resetEnrollState: () => void
}

export type PasskeyStore = PasskeyState & PasskeyActions

// ── Error classification (matches the-drop PasskeyLoginPage style) ───────────

function classifyError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'NotAllowedError') {
      // User dismissed the browser prompt — not a server failure
      return 'cancelled'
    }
    return err.message
  }
  return 'Unknown error'
}

// ── Store ────────────────────────────────────────────────────────────────────

export const usePasskeyStore = create<PasskeyStore>((set) => ({
  // Initial state
  passkeyAvailable: false,
  passkeyEnrolled: false,
  authState: 'idle',
  authError: null,
  enrollState: 'idle',
  enrollError: null,

  setPasskeyAvailable: (available) => set({ passkeyAvailable: available }),
  setPasskeyEnrolled: (enrolled) => set({ passkeyEnrolled: enrolled }),

  resetAuthState: () => set({ authState: 'idle', authError: null }),
  resetEnrollState: () => set({ enrollState: 'idle', enrollError: null }),

  // --------------------------------------------------------------------------
  // PASSKEY AUTHENTICATION
  // Step 1: get options → Step 2: startAuthentication (lazy import) → Step 3: finishAuthentication
  // --------------------------------------------------------------------------

  loginWithPasskey: async () => {
    set({ authState: 'authenticating', authError: null })
    try {
      // Step 1: fetch challenge / options from server
      const optionsJSON = await getAuthOptions()

      // Step 2: run browser WebAuthn ceremony (lazy — not eagerly bundled)
      const { startAuthentication } = await import('@simplewebauthn/browser')
      const credential = await startAuthentication({ optionsJSON })

      // Step 3: send assertion to server → sets authenticated HttpSession cookie
      await finishAuthentication(credential)

      // Step 4: hydrate the kiosk session — passkey login never saw card data.
      const snapshot = await whoami()
      useSessionStore.getState().signIn(
        {
          accountId: snapshot.accountId,
          holderName: snapshot.holderName,
          maskedCardNumber: snapshot.maskedCardNumber,
          balance: snapshot.balance,
          currency: snapshot.currency,
        },
        snapshot.maskedCardNumber,
      )

      set({ authState: 'success', authError: null, passkeyEnrolled: snapshot.passkeyEnrolled })
    } catch (err) {
      const msg = classifyError(err)
      set({ authState: 'error', authError: msg })
      throw err
    }
  },

  // --------------------------------------------------------------------------
  // PASSKEY ENROLLMENT
  // Step 1: get registration options → Step 2: startRegistration → Step 3: finishRegistration
  // Requires an active card+PIN authenticated session.
  // --------------------------------------------------------------------------

  enrollPasskey: async () => {
    set({ enrollState: 'authenticating', enrollError: null })
    try {
      // Step 1: fetch creation options from server
      const optionsJSON = await getRegistrationOptions()

      // Step 2: run browser WebAuthn registration ceremony (lazy import)
      const { startRegistration } = await import('@simplewebauthn/browser')
      const credential = await startRegistration({ optionsJSON })

      // Step 3: send registration response to server
      await finishRegistration(credential)

      set({ enrollState: 'success', enrollError: null, passkeyEnrolled: true })
    } catch (err) {
      const msg = classifyError(err)
      set({ enrollState: 'error', enrollError: msg })
      throw err
    }
  },
}))

// ── Selectors ────────────────────────────────────────────────────────────────

export const selectPasskeyAvailable = (s: PasskeyStore) => s.passkeyAvailable
export const selectPasskeyEnrolled = (s: PasskeyStore) => s.passkeyEnrolled
export const selectAuthState = (s: PasskeyStore) => s.authState
export const selectAuthError = (s: PasskeyStore) => s.authError
export const selectEnrollState = (s: PasskeyStore) => s.enrollState
export const selectEnrollError = (s: PasskeyStore) => s.enrollError
