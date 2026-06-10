/**
 * Welcome — passkey-specific tests.
 *
 * Tests:
 *  - Passkey button hidden when passkeyAvailable=false
 *  - Passkey button shown when passkeyAvailable=true
 *  - Clicking passkey button navigates to /passkey-auth
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { Welcome } from './Welcome'
import { useSessionStore } from '../stores/sessionStore'
import { usePasskeyStore } from '../stores/passkeyStore'

// Prevent the usePasskeyAvailability hook from calling the real WebAuthn API
vi.mock('../hooks/usePasskeyAvailability', () => ({
  usePasskeyAvailability: vi.fn(),
}))

// Stub card lookup to avoid unrelated network calls
vi.mock('../api/atm', () => ({
  lookupCard: vi.fn(),
  verifyPin: vi.fn(),
  withdraw: vi.fn(),
  deposit: vi.fn(),
  statement: vi.fn(),
}))

let navigatedTo: string | null = null

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => (path: string) => { navigatedTo = path },
  }
})

function renderWelcome() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Welcome />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  navigatedTo = null
  useSessionStore.getState().signOut()
  usePasskeyStore.setState({
    passkeyAvailable: false,
    passkeyEnrolled: false,
    authState: 'idle',
    authError: null,
    enrollState: 'idle',
    enrollError: null,
  })
})

describe('Welcome — passkey button', () => {
  it('hides the passkey button when platform authenticator is unavailable', () => {
    usePasskeyStore.setState({ passkeyAvailable: false })
    renderWelcome()
    expect(screen.queryByLabelText(/tap to authenticate/i)).not.toBeInTheDocument()
  })

  it('shows the passkey button when platform authenticator is available', () => {
    usePasskeyStore.setState({ passkeyAvailable: true })
    renderWelcome()
    expect(screen.getByLabelText(/tap to authenticate/i)).toBeInTheDocument()
  })

  it('navigates to /passkey-auth when the passkey button is clicked', async () => {
    usePasskeyStore.setState({ passkeyAvailable: true })
    renderWelcome()
    await userEvent.click(screen.getByLabelText(/tap to authenticate/i))
    await waitFor(() => expect(navigatedTo).toBe('/passkey-auth'))
  })
})
