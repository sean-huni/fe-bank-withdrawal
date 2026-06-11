import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AppBar } from './AppBar'
import { useSessionStore } from '../stores/sessionStore'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>welcome-screen</p>} />
        <Route path="/menu" element={<><AppBar /><p>menu-screen</p></>} />
        <Route path="/withdraw" element={<><AppBar /><p>withdraw-screen</p></>} />
        <Route path="/receipt" element={<><AppBar /><p>receipt-screen</p></>} />
      </Routes>
    </MemoryRouter>,
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

describe('AppBar', () => {
  it('shows the route title', () => {
    renderAt('/withdraw')
    expect(screen.getByRole('heading', { name: /withdraw/i })).toBeInTheDocument()
  })

  it('hides Back on the menu (root)', () => {
    renderAt('/menu')
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
  })

  it('hides Back on the receipt', () => {
    renderAt('/receipt')
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
  })

  it('Back returns to the menu', async () => {
    renderAt('/withdraw')
    await userEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByText('menu-screen')).toBeInTheDocument()
  })

  it('Exit signs out and returns to Welcome', async () => {
    renderAt('/withdraw')
    await userEvent.click(screen.getByRole('button', { name: /end session/i }))
    expect(screen.getByText('welcome-screen')).toBeInTheDocument()
    expect(useSessionStore.getState().account).toBeNull()
  })
})
