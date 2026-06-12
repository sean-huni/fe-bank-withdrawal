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

  it('any interaction dismisses the warning and re-arms the full idle window', () => {
    renderLayout()
    act(() => vi.advanceTimersByTime(45_000))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    // Fresh 60s window: no warning at 44s…
    act(() => vi.advanceTimersByTime(44_000))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByText('menu-screen')).toBeInTheDocument()
    // …and the warning re-appears right after the 45s mark.
    act(() => vi.advanceTimersByTime(2_000))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })

  it('signs out and returns to Welcome when the countdown expires', () => {
    renderLayout()
    act(() => vi.advanceTimersByTime(45_000))
    act(() => vi.advanceTimersByTime(15_500))
    expect(screen.getByText('welcome-screen')).toBeInTheDocument()
    expect(useSessionStore.getState().account).toBeFalsy()
  })
})

describe('card shell', () => {
  it('renders the app-bar header and screen content inside one card section', () => {
    renderLayout()
    const section = screen.getByRole('region', { name: /atm/i })
    expect(section.querySelector('header')).not.toBeNull()
    expect(section).toHaveTextContent('menu-screen')
  })

  it('keeps the timeout dialog outside the animated card (transform would clip the fixed overlay)', () => {
    renderLayout()
    act(() => vi.advanceTimersByTime(45_000))
    const section = screen.getByRole('region', { name: /atm/i })
    const dialog = screen.getByRole('alertdialog')
    expect(section.contains(dialog)).toBe(false)
  })
})
