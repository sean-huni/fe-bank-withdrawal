/**
 * Passkey / WebAuthn API calls.
 *
 * All endpoint paths live here — a single place to diff against the BE contract.
 *
 * BE: Spring Security 7 built-in WebAuthn, session-cookie + CSRF (XSRF-TOKEN cookie).
 * The shared Axios client already has withCredentials + xsrf headers configured.
 *
 * ============================================================================
 * ENDPOINT CONSTANTS (BE contract reference)
 * ============================================================================
 *
 *  POST /api/{v}/atm/session
 *       body: { cardNumber, pin }
 *       200: { maskedCard, accountId, passkeyEnrolled }  — establishes HttpSession
 *       401: existing error shape (PIN_INVALID / CARD_NOT_FOUND)
 *
 *  POST /webauthn/register/options  (authenticated session)
 *       → PublicKeyCredentialCreationOptionsJSON
 *
 *  POST /webauthn/register          (authenticated session)
 *       body: { publicKey: <startRegistration() output>, label: string }
 *       NOTE: Spring Security 7's WebAuthn endpoint wraps the credential under
 *       a "publicKey" key and accepts an optional "label" — adapt if the live
 *       server shape differs (leave this comment as a TODO marker).
 *       → 200 (no body) on success
 *
 *  POST /webauthn/authenticate/options
 *       → PublicKeyCredentialRequestOptionsJSON
 *
 *  POST /login/webauthn
 *       body: <startAuthentication() output>
 *       → 200 { redirectUrl, authenticated: true } + session cookie
 *
 * ============================================================================
 */

import { api } from './client'
import { env } from '../config/env'
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/browser'

// ── Endpoint paths ──────────────────────────────────────────────────────────
// All paths relative to axios baseURL (which is already /api/v1).
// WebAuthn endpoints from Spring Security 7 are at the root context path
// (not under /api/v1), so we use absolute paths with env.apiBaseUrl.
const EP = {
  // Card+PIN session — sits under the versioned API namespace
  atmSession: `${env.apiBaseUrl}/${env.apiVersion}/atm/session`,

  // Spring Security 7 WebAuthn endpoints — at root context (not versioned)
  registerOptions: '/webauthn/register/options',
  registerFinish: '/webauthn/register',
  authOptions: '/webauthn/authenticate/options',
  authFinish: '/login/webauthn',
} as const

// ── Response types ──────────────────────────────────────────────────────────

export interface AtmSessionRequest {
  cardNumber: string
  pin: string
}

export interface AtmSessionResponse {
  maskedCard: string
  accountId: string
  passkeyEnrolled: boolean
}

export interface PasskeyAuthResponse {
  redirectUrl: string
  authenticated: boolean
}

// ── API calls ────────────────────────────────────────────────────────────────

/**
 * Establish ATM session via card + PIN.
 * On success the BE sets an HttpSession cookie.
 * Returns whether this account already has a passkey enrolled.
 */
export async function atmSession(req: AtmSessionRequest): Promise<AtmSessionResponse> {
  const { data } = await api.post<AtmSessionResponse>(EP.atmSession, req)
  return data
}

/**
 * Step 1 of registration ceremony — fetch creation options from the server.
 * Requires an active authenticated session (card+PIN must have been verified).
 */
export async function getRegistrationOptions(): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const { data } = await api.post<PublicKeyCredentialCreationOptionsJSON>(EP.registerOptions)
  return data
}

/**
 * Step 3 of registration ceremony — send the authenticator's response to the server.
 *
 * Spring Security 7 WebAuthn registration endpoint expects:
 *   { publicKey: <RegistrationResponseJSON>, label: string }
 *
 * TODO(live-BE-integration): verify the exact wrapper shape against the running server
 * and adjust EP.registerFinish + the body shape here if Spring's actual request format differs.
 */
export async function finishRegistration(
  credential: RegistrationResponseJSON,
  label = 'ATM passkey',
): Promise<void> {
  await api.post(EP.registerFinish, { publicKey: credential, label })
}

/**
 * Step 1 of authentication ceremony — fetch request options (username-less / discoverable).
 */
export async function getAuthOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const { data } = await api.post<PublicKeyCredentialRequestOptionsJSON>(EP.authOptions)
  return data
}

/**
 * Step 3 of authentication ceremony — send the authenticator's assertion to the server.
 * On success the BE sets a new authenticated HttpSession cookie.
 */
export async function finishAuthentication(
  credential: AuthenticationResponseJSON,
): Promise<PasskeyAuthResponse> {
  const { data } = await api.post<PasskeyAuthResponse>(EP.authFinish, credential)
  return data
}
