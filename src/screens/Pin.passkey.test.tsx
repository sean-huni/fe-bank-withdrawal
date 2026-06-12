/**
 * Regression tests — Pin flow wires the kiosk session + passkeyEnrolled
 * (the always-nagging-prompt bug).
 *
 * Bug: `passkeyEnrolled` was never set from the server response after PIN
 * verification → `usePasskeyStore.passkeyEnrolled` stayed false → the enrol
 * prompt appeared on every login regardless of whether the user had a passkey.
 *
 * Fix: Pin.tsx calls `atmSession` after `verifyPin`, stores the returned flag
 * via `setPasskeyEnrolled`, and uses the updated store value to decide routing.
 *
 * These tests lock in:
 *  (a) PIN success + atmSession→passkeyEnrolled:true → store flag is true AND
 *      navigation goes to /menu (no enrol prompt).
 *  (b) PIN success + passkeyEnrolled:false + not dismissed + passkeyAvailable
 *      → navigates to /enable-passkey.
 *  (c) atmSession FAILS → flow still proceeds to the classic path (non-fatal),
 *      a warn toast is fired.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Pin } from './Pin'
import { useSessionStore } from '../stores/sessionStore'
import { usePasskeyStore } from '../stores/passkeyStore'
import * as atm from '../api/atm'
import * as passkey from '../api/passkey'

// ── Navigation capture ────────────────────────────────────────────────────────

let navigatedTo: string | null = null

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => (path: string) => { navigatedTo = path },
  }
})

// ── Toast mock ────────────────────────────────────────────────────────────────

vi.mock('react-hot-toast', () => ({
  default: Object.assign(
    vi.fn(), // toast(msg) — the bare call used for the ⚠️ warn
    {
      success: vi.fn(),
      error: vi.fn(),
    },
  ),
}))

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD = '4539148803436467'

const ACCOUNT = {
  accountId: 'acc-1',
  holderName: 'Alice',
  maskedCardNumber: '•••• 6467',
  balance: '1000.00',
  currency: 'EUR',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPin() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Pin />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  navigatedTo = null
  sessionStorage.clear()

  useSessionStore.getState().signOut()
  useSessionStore.getState().setPending(CARD, 'Alice')

  // Reset passkey store to defaults
  usePasskeyStore.setState({
    passkeyAvailable: false,
    passkeyEnrolled: false,
    authState: 'idle',
    authError: null,
    enrollState: 'idle',
    enrollError: null,
  })

  // verifyPin succeeds by default
  vi.spyOn(atm, 'verifyPin').mockResolvedValue(ACCOUNT)
})

// ── (a) passkeyEnrolled:true → navigate to /menu ─────────────────────────────

describe('Pin passkey regression — passkeyEnrolled flag', () => {
  it('(a) stores passkeyEnrolled=true and navigates to /menu when server reports enrolled', async () => {
    vi.spyOn(passkey, 'atmSession').mockResolvedValue({
      maskedCardNumber: '•••• 6467',
      accountId: 'acc-1',
      passkeyEnrolled: true,
    })

    // Even with passkeyAvailable=true, if already enrolled → no enrol prompt
    usePasskeyStore.setState({ passkeyAvailable: true })

    renderPin()
    await userEvent.keyboard('1234')

    // Store must reflect what the server told us
    await waitFor(() =>
      expect(usePasskeyStore.getState().passkeyEnrolled).toBe(true),
    )
    // Navigation goes straight to menu, not to /enable-passkey
    await waitFor(() => expect(navigatedTo).toBe('/menu'))
  })
})

// ── (b) passkeyEnrolled:false + available + not dismissed → /enable-passkey ──

describe('Pin passkey regression — enrol prompt routing', () => {
  it('(b) navigates to /enable-passkey when device supports passkey and account has none enrolled', async () => {
    vi.spyOn(passkey, 'atmSession').mockResolvedValue({
      maskedCardNumber: '•••• 6467',
      accountId: 'acc-1',
      passkeyEnrolled: false,
    })

    // Device supports passkeys, prompt not dismissed
    usePasskeyStore.setState({ passkeyAvailable: true, passkeyEnrolled: false })
    // sessionStorage clear in beforeEach ensures dismissed flag is absent

    renderPin()
    await userEvent.keyboard('1234')

    await waitFor(() => expect(navigatedTo).toBe('/enable-passkey'))
    // Confirm the store flag was correctly set to false (not left stale)
    expect(usePasskeyStore.getState().passkeyEnrolled).toBe(false)
  })

  it('(b) navigates to /menu when passkeyAvailable is false (even if not enrolled)', async () => {
    vi.spyOn(passkey, 'atmSession').mockResolvedValue({
      maskedCardNumber: '•••• 6467',
      accountId: 'acc-1',
      passkeyEnrolled: false,
    })

    // Device does NOT support passkeys → skip enrol flow
    usePasskeyStore.setState({ passkeyAvailable: false })

    renderPin()
    await userEvent.keyboard('1234')

    await waitFor(() => expect(navigatedTo).toBe('/menu'))
  })
})

// ── (c) atmSession failure → non-fatal, warn toast, proceeds to classic path ──

describe('Pin passkey regression — atmSession failure is non-fatal', () => {
  it('(c) warns with a toast but still navigates to /menu when atmSession throws', async () => {
    vi.spyOn(passkey, 'atmSession').mockRejectedValue(new Error('Network error'))

    // passkeyAvailable=false so the failure doesn't accidentally open the enrol prompt
    usePasskeyStore.setState({ passkeyAvailable: false })

    renderPin()
    await userEvent.keyboard('1234')

    // Navigation proceeds to the classic path
    await waitFor(() => expect(navigatedTo).toBe('/menu'))

    // A warn toast was fired (the bare `toast(...)` call in Pin.tsx — not toast.error)
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1))

    // toast.error must NOT be called — this is a warning, not a hard failure
    expect(toast.error).not.toHaveBeenCalled()

    // Enrolled flag stays false — we had no server response to set it from
    expect(usePasskeyStore.getState().passkeyEnrolled).toBe(false)
  })
})
