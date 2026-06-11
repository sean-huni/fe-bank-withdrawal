import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthenticatedLayout } from './AuthenticatedLayout'
import { useSessionStore } from '../stores/sessionStore'

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/menu']}>
      <Routes>
        <Route path="/" element={<p>welcome-screen</p>} />
        <Route element={<AuthenticatedLayout />}>
          <Route path="/menu" element={<p>menu-screen</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.useFakeTimers()
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

afterEach(() => {
  vi.useRealTimers()
})

describe('session-timeout warning', () => {
  it('shows a countdown dialog 15s before expiry', () => {
    renderLayout()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(45_000))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText(/15/)).toBeInTheDocument()
  })

  it('any interaction dismisses the warning and resets the timer', () => {
    renderLayout()
    act(() => vi.advanceTimersByTime(45_000))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    // A fresh 60s window: still signed in 50s later…
    act(() => vi.advanceTimersByTime(50_000))
    expect(screen.getByText('menu-screen')).toBeInTheDocument()
  })

  it('signs out and returns to Welcome when the countdown expires', () => {
    renderLayout()
    act(() => vi.advanceTimersByTime(45_000))
    act(() => vi.advanceTimersByTime(15_500))
    expect(screen.getByText('welcome-screen')).toBeInTheDocument()
    expect(useSessionStore.getState().account).toBeFalsy()
  })
})
