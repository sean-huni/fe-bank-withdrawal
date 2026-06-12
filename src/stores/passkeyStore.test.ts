/**
 * passkeyStore — unit tests
 *
 * All HTTP calls are mocked via vi.mock so no network needed.
 * Tests cover:
 *  - loginWithPasskey: success, user-cancel (NotAllowedError), server error
 *  - enrollPasskey: success, user-cancel, server error
 *  - availability flag setters
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { usePasskeyStore } from './passkeyStore'

// ── Mock the passkey API module ───────────────────────────────────────────────
vi.mock('../api/passkey', () => ({
  getAuthOptions: vi.fn(),
  finishAuthentication: vi.fn(),
  getRegistrationOptions: vi.fn(),
  finishRegistration: vi.fn(),
  whoami: vi.fn(),
}))

// Mock @simplewebauthn/browser (lazy import in store)
vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication: vi.fn(),
  startRegistration: vi.fn(),
}))

import * as passkeyApi from '../api/passkey'
import * as simplewebauthn from '@simplewebauthn/browser'
import { useSessionStore } from './sessionStore'

const mockAuthOptions = { challenge: 'abc', rpId: 'localhost', allowCredentials: [] } as unknown as import('@simplewebauthn/browser').PublicKeyCredentialRequestOptionsJSON
const mockRegOptions = { challenge: 'def', rp: { name: 'ATM' } } as unknown as import('@simplewebauthn/browser').PublicKeyCredentialCreationOptionsJSON
const mockAuthCredential = { id: 'cred-1', type: 'public-key' } as unknown as import('@simplewebauthn/browser').AuthenticationResponseJSON
const mockRegCredential = { id: 'reg-1', type: 'public-key' } as unknown as import('@simplewebauthn/browser').RegistrationResponseJSON

function resetStore() {
  usePasskeyStore.setState({
    passkeyAvailable: false,
    passkeyEnrolled: false,
    authState: 'idle',
    authError: null,
    enrollState: 'idle',
    enrollError: null,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  resetStore()
  useSessionStore.getState().signOut()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── loginWithPasskey ──────────────────────────────────────────────────────────

describe('passkeyStore › loginWithPasskey', () => {
  it('transitions idle → authenticating → success on happy path', async () => {
    vi.mocked(passkeyApi.getAuthOptions).mockResolvedValue(mockAuthOptions)
    vi.mocked(simplewebauthn.startAuthentication).mockResolvedValue(mockAuthCredential)
    vi.mocked(passkeyApi.finishAuthentication).mockResolvedValue({
      authenticated: true,
      redirectUrl: '/menu',
    })
    vi.mocked(passkeyApi.whoami).mockResolvedValue({
      accountId: 'acc-0',
      holderName: 'Test',
      maskedCardNumber: '•••• •••• •••• 0000',
      balance: '0.00',
      currency: 'USD',
      passkeyEnrolled: false,
    })

    const storeStates: string[] = []
    const unsub = usePasskeyStore.subscribe((s) => storeStates.push(s.authState))

    await usePasskeyStore.getState().loginWithPasskey()
    unsub()

    expect(storeStates).toContain('authenticating')
    expect(usePasskeyStore.getState().authState).toBe('success')
    expect(usePasskeyStore.getState().authError).toBeNull()
    expect(passkeyApi.getAuthOptions).toHaveBeenCalledTimes(1)
    expect(simplewebauthn.startAuthentication).toHaveBeenCalledWith({ optionsJSON: mockAuthOptions })
    expect(passkeyApi.finishAuthentication).toHaveBeenCalledWith(mockAuthCredential)
  })

  it('sets authState=error and authError="cancelled" on NotAllowedError (user dismissed)', async () => {
    vi.mocked(passkeyApi.getAuthOptions).mockResolvedValue(mockAuthOptions)
    const notAllowed = Object.assign(new Error('Not allowed'), { name: 'NotAllowedError' })
    vi.mocked(simplewebauthn.startAuthentication).mockRejectedValue(notAllowed)

    await expect(usePasskeyStore.getState().loginWithPasskey()).rejects.toThrow()

    expect(usePasskeyStore.getState().authState).toBe('error')
    expect(usePasskeyStore.getState().authError).toBe('cancelled')
  })

  it('sets authState=error and propagates server error message', async () => {
    vi.mocked(passkeyApi.getAuthOptions).mockResolvedValue(mockAuthOptions)
    vi.mocked(simplewebauthn.startAuthentication).mockResolvedValue(mockAuthCredential)
    vi.mocked(passkeyApi.finishAuthentication).mockRejectedValue(new Error('Credential not found'))

    await expect(usePasskeyStore.getState().loginWithPasskey()).rejects.toThrow()

    expect(usePasskeyStore.getState().authState).toBe('error')
    expect(usePasskeyStore.getState().authError).toBe('Credential not found')
  })

  it('re-arms after resetAuthState is called', async () => {
    vi.mocked(passkeyApi.getAuthOptions).mockResolvedValue(mockAuthOptions)
    vi.mocked(simplewebauthn.startAuthentication).mockRejectedValue(
      Object.assign(new Error('Not allowed'), { name: 'NotAllowedError' }),
    )
    await expect(usePasskeyStore.getState().loginWithPasskey()).rejects.toThrow()

    usePasskeyStore.getState().resetAuthState()
    expect(usePasskeyStore.getState().authState).toBe('idle')
    expect(usePasskeyStore.getState().authError).toBeNull()
  })

  it('hydrates the session store from whoami after a successful ceremony', async () => {
    vi.mocked(passkeyApi.getAuthOptions).mockResolvedValue(mockAuthOptions)
    vi.mocked(simplewebauthn.startAuthentication).mockResolvedValue(mockAuthCredential)
    vi.mocked(passkeyApi.finishAuthentication).mockResolvedValue({ redirectUrl: '/', authenticated: true })
    vi.mocked(passkeyApi.whoami).mockResolvedValue({
      accountId: 'acc-1',
      holderName: 'Bob',
      maskedCardNumber: '•••• •••• •••• 9424',
      balance: '500.00',
      currency: 'EUR',
      passkeyEnrolled: true,
    })

    await usePasskeyStore.getState().loginWithPasskey()

    const session = useSessionStore.getState()
    expect(session.account).toEqual({
      accountId: 'acc-1',
      holderName: 'Bob',
      maskedCardNumber: '•••• •••• •••• 9424',
      balance: '500.00',
      currency: 'EUR',
    })
    expect(usePasskeyStore.getState().passkeyEnrolled).toBe(true)
    expect(session.cardNumber).toBe('•••• •••• •••• 9424')
  })

  it('leaves the session signed out and reports error when whoami fails after the ceremony', async () => {
    vi.mocked(passkeyApi.getAuthOptions).mockResolvedValue(mockAuthOptions)
    vi.mocked(simplewebauthn.startAuthentication).mockResolvedValue(mockAuthCredential)
    vi.mocked(passkeyApi.finishAuthentication).mockResolvedValue({ redirectUrl: '/', authenticated: true })
    vi.mocked(passkeyApi.whoami).mockRejectedValue(new Error('network down'))

    await expect(usePasskeyStore.getState().loginWithPasskey()).rejects.toThrow('network down')

    expect(usePasskeyStore.getState().authState).toBe('error')
    expect(useSessionStore.getState().account).toBeNull()
  })
})

// ── enrollPasskey ─────────────────────────────────────────────────────────────

describe('passkeyStore › enrollPasskey', () => {
  it('transitions idle → authenticating → success and sets passkeyEnrolled=true', async () => {
    vi.mocked(passkeyApi.getRegistrationOptions).mockResolvedValue(mockRegOptions)
    vi.mocked(simplewebauthn.startRegistration).mockResolvedValue(mockRegCredential)
    vi.mocked(passkeyApi.finishRegistration).mockResolvedValue(undefined)

    await usePasskeyStore.getState().enrollPasskey()

    expect(usePasskeyStore.getState().enrollState).toBe('success')
    expect(usePasskeyStore.getState().passkeyEnrolled).toBe(true)
    // store calls finishRegistration(credential) — label defaults to 'ATM passkey' inside the api fn
    expect(passkeyApi.finishRegistration).toHaveBeenCalledWith(mockRegCredential)
  })

  it('sets enrollState=error and enrollError="cancelled" on NotAllowedError', async () => {
    vi.mocked(passkeyApi.getRegistrationOptions).mockResolvedValue(mockRegOptions)
    const notAllowed = Object.assign(new Error('Not allowed'), { name: 'NotAllowedError' })
    vi.mocked(simplewebauthn.startRegistration).mockRejectedValue(notAllowed)

    await expect(usePasskeyStore.getState().enrollPasskey()).rejects.toThrow()

    expect(usePasskeyStore.getState().enrollState).toBe('error')
    expect(usePasskeyStore.getState().enrollError).toBe('cancelled')
    expect(usePasskeyStore.getState().passkeyEnrolled).toBe(false)
  })

  it('sets enrollState=error on server registration failure', async () => {
    vi.mocked(passkeyApi.getRegistrationOptions).mockResolvedValue(mockRegOptions)
    vi.mocked(simplewebauthn.startRegistration).mockResolvedValue(mockRegCredential)
    vi.mocked(passkeyApi.finishRegistration).mockRejectedValue(new Error('Registration rejected'))

    await expect(usePasskeyStore.getState().enrollPasskey()).rejects.toThrow()

    expect(usePasskeyStore.getState().enrollState).toBe('error')
    expect(usePasskeyStore.getState().enrollError).toBe('Registration rejected')
  })
})

// ── availability ──────────────────────────────────────────────────────────────

describe('passkeyStore › availability flags', () => {
  it('setPasskeyAvailable sets the flag', () => {
    usePasskeyStore.getState().setPasskeyAvailable(true)
    expect(usePasskeyStore.getState().passkeyAvailable).toBe(true)
  })

  it('setPasskeyEnrolled sets the flag', () => {
    usePasskeyStore.getState().setPasskeyEnrolled(true)
    expect(usePasskeyStore.getState().passkeyEnrolled).toBe(true)
  })
})
