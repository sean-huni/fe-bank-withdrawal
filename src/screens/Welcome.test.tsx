import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { Welcome } from './Welcome'
import { useSessionStore } from '../stores/sessionStore'
import * as atm from '../api/atm'

function renderWelcome() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}><MemoryRouter><Welcome /></MemoryRouter></QueryClientProvider>)
}

const summary = { holderName: 'Alice', maskedCardNumber: '•••• 6467' }

beforeEach(() => {
  vi.restoreAllMocks()
  useSessionStore.getState().signOut()
})

describe('Welcome', () => {
  it('auto-fires lookupCard once on a valid 16-digit Luhn number — no Insert click', async () => {
    const spy = vi.spyOn(atm, 'lookupCard').mockResolvedValue(summary)
    renderWelcome()
    await userEvent.type(screen.getByPlaceholderText(/####/), '4539148803436467')
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
    expect(spy).toHaveBeenCalledWith('4539148803436467')
  })

  it('does NOT call lookupCard for an invalid/short number', async () => {
    const spy = vi.spyOn(atm, 'lookupCard').mockResolvedValue(summary)
    renderWelcome()
    await userEvent.type(screen.getByPlaceholderText(/####/), '1234')
    expect(spy).not.toHaveBeenCalled()
  })

  it('sets the pending card on a successful lookup', async () => {
    vi.spyOn(atm, 'lookupCard').mockResolvedValue(summary)
    renderWelcome()
    await userEvent.type(screen.getByPlaceholderText(/####/), '4539148803436467')
    await waitFor(() =>
      expect(useSessionStore.getState().pendingCardNumber).toBe('4539148803436467'))
  })
})
