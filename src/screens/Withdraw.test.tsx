import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { Withdraw } from './Withdraw'
import { useSessionStore } from '../stores/sessionStore'
import * as atm from '../api/atm'

function renderWithdraw() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Withdraw />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  useSessionStore.setState({
    account: {
      accountId: 'acc-1',
      holderName: 'Alice',
      maskedCardNumber: '•••• 6467',
      balance: '1000.00',
      currency: 'EUR',
    },
    cardNumber: '4539148803436467',
    startedAt: Date.now(),
  })
})

describe('Withdraw', () => {
  it('posts the chosen amount with an idempotency key and routes to the receipt', async () => {
    const spy = vi.spyOn(atm, 'withdraw').mockResolvedValue({
      transactionId: 'tx-1',
      accountId: 'acc-1',
      type: 'DEBIT',
      amount: '50',
      balanceAfter: '950.00',
      occurredAt: '2026-06-08T10:00:00Z',
    })
    renderWithdraw()
    await userEvent.click(screen.getByRole('button', { name: /50/ }))
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() => expect(spy).toHaveBeenCalledWith('acc-1', '50', expect.any(String)))
  })
})
