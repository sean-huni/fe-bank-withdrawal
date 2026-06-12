import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AppBar } from '../components/AppBar'
import { useSessionStore } from '../stores/sessionStore'

vi.mock('react-hot-toast', () => ({ default: vi.fn() }))

function renderBar() {
  return render(
    <MemoryRouter initialEntries={['/withdraw']}>
      <Routes>
        <Route path="/" element={<p>welcome-screen</p>} />
        <Route path="/withdraw" element={<AppBar />} />
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

describe('useExitSession (via AppBar Exit)', () => {
  it('signs out, reminds the card user to take the card, and returns to Welcome', async () => {
    renderBar()
    await userEvent.click(screen.getByRole('button', { name: /end session/i }))
    expect(screen.getByText('welcome-screen')).toBeInTheDocument()
    expect(useSessionStore.getState().account).toBeNull()
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('take your card'))
  })

  it('skips the take-card reminder for passkey sessions (no card)', async () => {
    useSessionStore.setState({ cardNumber: null })
    renderBar()
    await userEvent.click(screen.getByRole('button', { name: /end session/i }))
    expect(screen.getByText('welcome-screen')).toBeInTheDocument()
    expect(toast).not.toHaveBeenCalled()
  })
})
