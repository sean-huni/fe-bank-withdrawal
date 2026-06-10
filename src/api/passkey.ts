/**
 * Passkey / WebAuthn API calls.
 *
 * All endpoint paths live here — a single place to diff against the BE contract.
 *
 * BE: Spring Security 7 built-in WebAuthn, session-cookie + CSRF (XSRF-TOKEN cookie).
 * Both axios instances already have withCredentials + xsrf headers configured (see client.ts).
 *
 * ============================================================================
 * ENDPOINT CONSTANTS (BE contract reference)
 * ============================================================================
 *
 *  POST /api/{v}/atm/session
 *       body: { cardNumber, pin }
 *       200: ApiResponse<{ maskedCardNumber, accountId, passkeyEnrolled }>
 *             — establishes HttpSession
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

import { api, ceremonyApi } from './client'
import type { ApiResponse } from './types'
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/browser'

// ── Endpoint paths ──────────────────────────────────────────────────────────
// atmSession: bare relative path — api client already has /api/v1 as baseURL.
// Ceremony paths: relative paths on ceremonyApi (baseURL = server origin).
const EP = {
  // Card+PIN session — sits under the versioned API namespace (api client)
  atmSession: '/atm/session',

  // Spring Security 7 WebAuthn endpoints — at root context (ceremonyApi)
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
  maskedCardNumber: string
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
 * BE wraps the payload in ApiResponse<AtmSessionResponse>.
 */
export async function atmSession(req: AtmSessionRequest): Promise<AtmSessionResponse> {
  const { data } = await api.post<ApiResponse<AtmSessionResponse>>(EP.atmSession, req)
  return data.data as AtmSessionResponse
}

/**
 * Step 1 of registration ceremony — fetch creation options from the server.
 * Requires an active authenticated session (card+PIN must have been verified).
 */
export async function getRegistrationOptions(): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const { data } = await ceremonyApi.post<PublicKeyCredentialCreationOptionsJSON>(EP.registerOptions)
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
  await ceremonyApi.post(EP.registerFinish, { publicKey: credential, label })
}

/**
 * Step 1 of authentication ceremony — fetch request options (username-less / discoverable).
 */
export async function getAuthOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const { data } = await ceremonyApi.post<PublicKeyCredentialRequestOptionsJSON>(EP.authOptions)
  return data
}

/**
 * Step 3 of authentication ceremony — send the authenticator's assertion to the server.
 * On success the BE sets a new authenticated HttpSession cookie.
 */
export async function finishAuthentication(
  credential: AuthenticationResponseJSON,
): Promise<PasskeyAuthResponse> {
  const { data } = await ceremonyApi.post<PasskeyAuthResponse>(EP.authFinish, credential)
  return data
}
