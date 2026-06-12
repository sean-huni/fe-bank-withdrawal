import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Pin } from './Pin'
import { useSessionStore } from '../stores/sessionStore'
import * as atm from '../api/atm'
import * as passkey from '../api/passkey'

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { error: vi.fn() }) }))

function renderPin() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/pin']}>
        <Routes>
          <Route path="/pin" element={<Pin />} />
          <Route path="/menu" element={<p>menu-screen</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
  useSessionStore.getState().signOut()
  useSessionStore.getState().setPending('4539148803436467', 'Alice')
})

describe('Pin', () => {
  it('auto-verifies the instant the 4th digit is entered — no Enter', async () => {
    const spy = vi.spyOn(atm, 'verifyPin').mockResolvedValue({
      accountId: 'acc-1', holderName: 'Alice', maskedCardNumber: '•••• 6467', balance: '1000.00', currency: 'EUR',
    })
    renderPin()
    await userEvent.keyboard('1234') // no Enter pressed
    await waitFor(() => expect(spy).toHaveBeenCalledWith('4539148803436467', '1234'))
  })

  it('still navigates to /menu and shows setup-unavailable toast (not enroll-error) when atmSession rejects', async () => {
    vi.spyOn(atm, 'verifyPin').mockResolvedValue({
      accountId: 'acc-1', holderName: 'Alice', maskedCardNumber: '•••• 6467', balance: '1000.00', currency: 'EUR',
    })
    vi.spyOn(passkey, 'atmSession').mockRejectedValue(new Error('network error'))
    renderPin()
    await userEvent.keyboard('1234')
    await waitFor(() => expect(screen.getByText('menu-screen')).toBeInTheDocument())
    expect(toast).toHaveBeenCalledWith('Passkey setup unavailable right now', { icon: '⚠️' })
    expect(toast).not.toHaveBeenCalledWith(
      expect.stringContaining('Passkey registration failed'),
      expect.anything(),
    )
  })

  it('shows an error and clears the PIN dots on a wrong PIN (401), re-arming for retry', async () => {
    const spy = vi.spyOn(atm, 'verifyPin').mockRejectedValue({ response: { status: 401, data: { error: { code: 'PIN_INVALID', message: 'Incorrect PIN' } } } })
    renderPin()
    await userEvent.keyboard('9999')
    await waitFor(() => expect(screen.getByText(/incorrect pin/i)).toBeInTheDocument())
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))

    // PIN entry reset: no filled dots remain after the failed attempt.
    const filled = screen.getByLabelText('PIN entry').querySelectorAll('.bg-accent-cyan')
    expect(filled).toHaveLength(0)

    // Re-armed: a second 4-digit entry triggers verifyPin again.
    await userEvent.keyboard('1234')
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
  })
})
