import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { Statement } from './Statement'
import { useSessionStore } from '../stores/sessionStore'
import * as atm from '../api/atm'
import type { Transaction, Page } from '../api/types'

function tx(id: string): Transaction {
  return {
    transactionId: id,
    accountId: 'acc-1',
    type: 'DEBIT',
    amount: '50',
    balanceAfter: '950.00',
    occurredAt: '2026-06-08T10:00:00Z',
  }
}

function pageOf(ids: string[], number: number, totalPages: number) {
  return {
    content: ids.map(tx),
    page: { size: 10, number, totalElements: totalPages * 10, totalPages }, // totalElements approximate; screen only uses totalPages
  }
}

function renderStatement() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Statement />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
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

describe('Statement pagination', () => {
  it('shows the position and disables Prev on the first page', async () => {
    vi.spyOn(atm, 'statement').mockResolvedValue(pageOf(['t1', 't2'], 0, 7))
    renderStatement()
    expect(await screen.findByText('Page 1 of 7')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /prev/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()
  })

  it('fetches the next page when Next is clicked', async () => {
    const spy = vi
      .spyOn(atm, 'statement')
      .mockResolvedValueOnce(pageOf(['t1'], 0, 2))
      .mockResolvedValueOnce(pageOf(['t2'], 1, 2))
    renderStatement()
    await screen.findByText('Page 1 of 2')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => expect(spy).toHaveBeenLastCalledWith('acc-1', 1, 10))
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('keeps the current rows visible while the next page is in flight', async () => {
    let resolveSecond: ((value: Page<Transaction>) => void) | undefined
    vi.spyOn(atm, 'statement')
      .mockResolvedValueOnce(pageOf(['t1'], 0, 2))
      .mockImplementationOnce(
        () => new Promise((resolve) => { resolveSecond = resolve }),
      )
    renderStatement()
    await screen.findByText('Page 1 of 2')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    // Previous page's rows stay on screen (no loading flash) and the pager is locked.
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    expect(screen.getByText(/Jun/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
    resolveSecond?.(pageOf(['t2'], 1, 2))
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument()
  })

  it('hides the pager when everything fits on one page', async () => {
    vi.spyOn(atm, 'statement').mockResolvedValue(pageOf(['t1'], 0, 1))
    renderStatement()
    await screen.findByText(/Jun/)
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument()
  })

  it('shows a truncated tx-id per row with the full id on hover', async () => {
    const fullId = 'f3b9c2d8-7e4a-4f1b-9c6d-000000000001'
    vi.spyOn(atm, 'statement').mockResolvedValue({
      content: [{ ...tx('ignored'), transactionId: fullId }],
      page: { size: 10, number: 0, totalElements: 1, totalPages: 1 },
    })
    renderStatement()
    const shortId = await screen.findByText('#f3b9c2d8')
    expect(shortId).toHaveAttribute('title', fullId)
  })
})
