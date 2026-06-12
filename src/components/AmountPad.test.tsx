import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AmountPad } from './AmountPad'

describe('AmountPad max', () => {
  it('disables quick-cash chips above max with an over-balance hint', () => {
    render(<AmountPad value="" onChange={() => {}} max={60} />)
    expect(screen.getByRole('button', { name: /€20\.00/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /€50\.00/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /€100\.00/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /€200\.00/ })).toBeDisabled()
    expect(screen.getAllByText(/over balance/i)).toHaveLength(2)
  })

  it('keeps every chip enabled when max is not given', () => {
    render(<AmountPad value="" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /€200\.00/ })).toBeEnabled()
    expect(screen.queryByText(/over balance/i)).not.toBeInTheDocument()
  })

  it('keeps a chip disabled even when it is the currently selected value', () => {
    render(<AmountPad value="200" onChange={() => {}} max={60} />)
    expect(screen.getByRole('button', { name: /€200\.00/ })).toBeDisabled()
  })
})
