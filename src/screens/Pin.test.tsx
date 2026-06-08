import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { Pin } from './Pin'
import { useSessionStore } from '../stores/sessionStore'
import * as atm from '../api/atm'

function renderPin() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}><MemoryRouter><Pin /></MemoryRouter></QueryClientProvider>)
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

  it('shows an error and clears on a wrong PIN (401)', async () => {
    vi.spyOn(atm, 'verifyPin').mockRejectedValue({ response: { status: 401, data: { error: { code: 'PIN_INVALID', message: 'Incorrect PIN' } } } })
    renderPin()
    await userEvent.keyboard('9999')
    await waitFor(() => expect(screen.getByText(/incorrect pin/i)).toBeInTheDocument())
  })
})
