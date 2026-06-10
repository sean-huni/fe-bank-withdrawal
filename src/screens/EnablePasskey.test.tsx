/**
 * EnablePasskey — unit tests.
 *
 * Tests:
 *  - hasPasskeyPromptBeenDismissed / markPasskeyPromptDismissed
 *  - Render: shows prompt when account is active
 *  - Skip button calls markDismissed and navigates to /menu
 *  - Enroll button triggers enrollPasskey; on success navigates to /menu
 *  - Cancel (NotAllowedError) stays on screen (re-arms), no navigation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { EnablePasskey } from './EnablePasskey'
import { hasPasskeyPromptBeenDismissed, markPasskeyPromptDismissed } from '../lib/passkeyPrompt'
import { useSessionStore } from '../stores/sessionStore'
import { usePasskeyStore } from '../stores/passkeyStore'

// ── Mocks ─────────────────────────────────────────────────────────────────────

let navigatedTo: string | null = null

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => (path: string) => { navigatedTo = path },
  }
})

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

// Prevent actual WebAuthn calls — the store actions are mocked below
vi.mock('../api/passkey', () => ({
  getRegistrationOptions: vi.fn(),
  finishRegistration: vi.fn(),
  getAuthOptions: vi.fn(),
  finishAuthentication: vi.fn(),
}))

vi.mock('@simplewebauthn/browser', () => ({
  startRegistration: vi.fn(),
  startAuthentication: vi.fn(),
}))

const ACCOUNT = {
  accountId: 'acc-1',
  holderName: 'Alice',
  maskedCardNumber: '•••• 6467',
  balance: '1000.00',
  currency: 'EUR',
}

function renderScreen() {
  return render(
    <MemoryRouter>
      <EnablePasskey />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  navigatedTo = null
  sessionStorage.clear()

  useSessionStore.getState().signOut()
  usePasskeyStore.setState({
    passkeyAvailable: true,
    passkeyEnrolled: false,
    authState: 'idle',
    authError: null,
    enrollState: 'idle',
    enrollError: null,
  })
})

// ── Helpers ───────────────────────────────────────────────────────────────────

describe('hasPasskeyPromptBeenDismissed / markPasskeyPromptDismissed', () => {
  it('returns false when not dismissed', () => {
    expect(hasPasskeyPromptBeenDismissed()).toBe(false)
  })

  it('returns true after markPasskeyPromptDismissed is called', () => {
    markPasskeyPromptDismissed()
    expect(hasPasskeyPromptBeenDismissed()).toBe(true)
  })
})

// ── Render ────────────────────────────────────────────────────────────────────

describe('EnablePasskey screen', () => {
  it('renders null (no output) when there is no active session', () => {
    // account is null — signOut() was called in beforeEach
    const { container } = renderScreen()
    expect(container.firstChild).toBeNull()
  })

  it('renders the enable prompt when a session is active', () => {
    useSessionStore.getState().signIn(ACCOUNT, '4539148803436467')
    renderScreen()
    expect(screen.getByText(/enable passkey on this atm/i)).toBeInTheDocument()
  })

  // ── Skip ────────────────────────────────────────────────────────────────────

  it('skip button marks dismissed and navigates to /menu', async () => {
    useSessionStore.getState().signIn(ACCOUNT, '4539148803436467')
    renderScreen()

    await userEvent.click(screen.getByText(/maybe later/i))

    expect(hasPasskeyPromptBeenDismissed()).toBe(true)
    await waitFor(() => expect(navigatedTo).toBe('/menu'))
  })

  // ── Enroll success ──────────────────────────────────────────────────────────

  it('enroll button calls enrollPasskey and navigates to /menu on success', async () => {
    useSessionStore.getState().signIn(ACCOUNT, '4539148803436467')

    // Spy on the store action
    const enrollSpy = vi.fn().mockResolvedValue(undefined)
    usePasskeyStore.setState({ enrollPasskey: enrollSpy } as unknown as Parameters<typeof usePasskeyStore.setState>[0])

    renderScreen()
    await userEvent.click(screen.getByText(/enable now/i))

    await waitFor(() => expect(enrollSpy).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(navigatedTo).toBe('/menu'))
  })

  // ── Enroll cancel (NotAllowedError) ─────────────────────────────────────────

  it('stays on screen when user cancels the browser passkey prompt (cancelled error)', async () => {
    useSessionStore.getState().signIn(ACCOUNT, '4539148803436467')

    const enrollSpy = vi.fn().mockRejectedValue(
      Object.assign(new Error('Not allowed'), { name: 'NotAllowedError' }),
    )
    usePasskeyStore.setState({
      enrollPasskey: enrollSpy,
      enrollError: 'cancelled',
    } as unknown as Parameters<typeof usePasskeyStore.setState>[0])

    renderScreen()
    await userEvent.click(screen.getByText(/enable now/i))

    // Should not navigate — user cancelled, give them another chance
    await waitFor(() => expect(enrollSpy).toHaveBeenCalledTimes(1))
    expect(navigatedTo).toBeNull()
  })
})
