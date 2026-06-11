/**
 * Regression tests — /webauthn/register request body shape (the enrollment-400 bug).
 *
 * The original implementation sent { publicKey: <credential>, label } — Spring
 * Security 7's WebAuthnRegistrationFilter could not deserialize that wrapper and
 * answered a bare 400, so every passkey enrollment failed against the live BE.
 *
 * Verified against the running server (2026-06-11):
 *   { publicKey: <cred>, label }                → 400 (request never parsed)
 *   { publicKey: { credential: <cred>, label }} → reaches webauthn4j verification
 *
 * Spring Security 7 contract (WebAuthnRegistrationFilter → RelyingPartyRegistrationRequest):
 *   { "publicKey": { "credential": <RegistrationResponseJSON>, "label": "..." } }
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { ceremonyApi } from './client'
import { finishRegistration } from './passkey'
import type { RegistrationResponseJSON } from '@simplewebauthn/browser'

const credential = {
  id: 'reg-1',
  rawId: 'reg-1',
  type: 'public-key',
  clientExtensionResults: {},
  response: { attestationObject: 'att', clientDataJSON: 'cdj', transports: ['internal'] },
} as unknown as RegistrationResponseJSON

afterEach(() => {
  vi.restoreAllMocks()
})

describe('finishRegistration request body (Spring Security 7 contract)', () => {
  it('nests credential + label under publicKey: { publicKey: { credential, label } }', async () => {
    const post = vi.spyOn(ceremonyApi, 'post').mockResolvedValue({ data: undefined })

    await finishRegistration(credential, 'ATM passkey')

    expect(post).toHaveBeenCalledWith('/webauthn/register', {
      publicKey: { credential, label: 'ATM passkey' },
    })
  })

  it('defaults the label to "ATM passkey"', async () => {
    const post = vi.spyOn(ceremonyApi, 'post').mockResolvedValue({ data: undefined })

    await finishRegistration(credential)

    expect(post).toHaveBeenCalledWith('/webauthn/register', {
      publicKey: { credential, label: 'ATM passkey' },
    })
  })
})
