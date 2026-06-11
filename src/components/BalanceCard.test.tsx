import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BalanceCard } from './BalanceCard'

describe('BalanceCard', () => {
  it('shows the Available label and the formatted amount', () => {
    render(<BalanceCard amount="1250.00" currency="EUR" />)
    expect(screen.getByText(/available/i)).toBeInTheDocument()
    expect(screen.getByText('€1,250.00')).toBeInTheDocument()
  })

  it('falls back to the default currency when none is given', () => {
    render(<BalanceCard amount="50.00" />)
    expect(screen.getByText('€50.00')).toBeInTheDocument()
  })
})
