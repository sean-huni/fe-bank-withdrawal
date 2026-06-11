import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Pager } from './Pager'

describe('Pager', () => {
  it('shows a 1-based "Page X of Y" position', () => {
    render(<Pager page={0} totalPages={7} onPage={() => {}} />)
    expect(screen.getByText('Page 1 of 7')).toBeInTheDocument()
  })

  it('disables Prev on the first page and Next on the last', () => {
    const { rerender } = render(<Pager page={0} totalPages={3} onPage={() => {}} />)
    expect(screen.getByRole('button', { name: /prev/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()
    rerender(<Pager page={2} totalPages={3} onPage={() => {}} />)
    expect(screen.getByRole('button', { name: /prev/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('reports the target page via onPage', async () => {
    const onPage = vi.fn()
    render(<Pager page={1} totalPages={3} onPage={onPage} />)
    await userEvent.click(screen.getByRole('button', { name: /prev/i }))
    expect(onPage).toHaveBeenCalledWith(0)
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(onPage).toHaveBeenCalledWith(2)
  })
})
