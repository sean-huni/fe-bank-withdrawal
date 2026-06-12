import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Receipt } from './Receipt'
import { useSessionStore } from '../stores/sessionStore'
import type { Transaction } from '../api/types'

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
        <Route path="/menu" element={<p>menu-screen</p>} />
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

describe('Receipt body', () => {
  it('shows the transaction and exactly one action: another transaction', async () => {
    renderReceipt()
    expect(screen.getByText('tx-1')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /end session/i })).not.toBeInTheDocument()
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: /another transaction/i }))
    expect(screen.getByText('menu-screen')).toBeInTheDocument()
  })
})
