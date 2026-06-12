import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { NavMenu } from './NavMenu'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/balance" element={<><NavMenu /><p>balance-screen</p></>} />
        <Route path="/withdraw" element={<><NavMenu /><p>withdraw-screen</p></>} />
        <Route path="/deposit" element={<><NavMenu /><p>deposit-screen</p></>} />
        <Route path="/statement" element={<><NavMenu /><p>statement-screen</p></>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('NavMenu', () => {
  it('renders the current route title as a collapsed menu trigger', () => {
    renderAt('/withdraw')
    const trigger = screen.getByRole('button', { name: /withdraw/i })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('opens with all four destinations and marks the current one', async () => {
    renderAt('/withdraw')
    await userEvent.click(screen.getByRole('button', { name: /withdraw/i }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    const items = screen.getAllByRole('menuitem')
    expect(items).toHaveLength(4)
    expect(screen.getByRole('menuitem', { name: /withdraw/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('menuitem', { name: /deposit/i })).not.toHaveAttribute('aria-current')
  })

  it('navigates to a destination and closes', async () => {
    renderAt('/withdraw')
    await userEvent.click(screen.getByRole('button', { name: /withdraw/i }))
    await userEvent.click(screen.getByRole('menuitem', { name: /mini-statement/i }))
    expect(screen.getByText('statement-screen')).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes on Escape and restores focus to the trigger', async () => {
    renderAt('/withdraw')
    const trigger = screen.getByRole('button', { name: /withdraw/i })
    await userEvent.click(trigger)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes on an outside click', async () => {
    renderAt('/withdraw')
    await userEvent.click(screen.getByRole('button', { name: /withdraw/i }))
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
