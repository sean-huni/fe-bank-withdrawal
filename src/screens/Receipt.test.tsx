import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Receipt } from './Receipt'
import { useSessionStore } from '../stores/sessionStore'
import type { Transaction } from '../api/types'

vi.mock('react-hot-toast', () => ({ default: vi.fn() }))

const tx: Transaction = {
  transactionId: 'tx-1',
  accountId: 'acc-1',
  type: 'DEBIT',
  amount: '50',
  balanceAfter: '950.00',
  occurredAt: '2026-06-08T10:00:00Z',
}

function renderReceipt() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/receipt', state: { tx, kind: 'withdraw' } }]}>
      <Routes>
        <Route path="/" element={<p>welcome-screen</p>} />
        <Route path="/receipt" element={<Receipt />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useSessionStore.setState({
    account: {
      accountId: 'acc-1',
      holderName: 'Alice',
      maskedCardNumber: '•••• 6467',
      balance: '950.00',
      currency: 'EUR',
    },
    cardNumber: '4539148803436467',
    startedAt: Date.now(),
  })
})

describe('Receipt exit', () => {
  it('signs out, reminds the card user to take the card, and returns to Welcome', async () => {
    renderReceipt()
    await userEvent.click(screen.getByRole('button', { name: /end session/i }))
    expect(screen.getByText('welcome-screen')).toBeInTheDocument()
    expect(useSessionStore.getState().account).toBeNull()
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('take your card'))
  })

  it('skips the take-card reminder for passkey sessions (no card)', async () => {
    useSessionStore.setState({ cardNumber: null })
    renderReceipt()
    await userEvent.click(screen.getByRole('button', { name: /end session/i }))
    expect(screen.getByText('welcome-screen')).toBeInTheDocument()
    expect(toast).not.toHaveBeenCalled()
  })
})
