import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Keypad } from './Keypad'

afterEach(cleanup)

function setup() {
  const onDigit = vi.fn()
  const onBackspace = vi.fn()
  const onEnter = vi.fn()
  render(<Keypad onDigit={onDigit} onBackspace={onBackspace} onEnter={onEnter} />)
  return { onDigit, onBackspace, onEnter }
}

describe('Keypad keyboard support', () => {
  it('maps digit keys 0-9 to onDigit', async () => {
    const { onDigit } = setup()
    await userEvent.keyboard('1')
    expect(onDigit).toHaveBeenCalledWith('1')
    await userEvent.keyboard('0')
    expect(onDigit).toHaveBeenCalledWith('0')
  })

  it('maps Backspace to onBackspace', async () => {
    const { onBackspace } = setup()
    await userEvent.keyboard('{Backspace}')
    expect(onBackspace).toHaveBeenCalledTimes(1)
  })

  it('maps Enter to onEnter', async () => {
    const { onEnter } = setup()
    await userEvent.keyboard('{Enter}')
    expect(onEnter).toHaveBeenCalledTimes(1)
  })

  it('ignores non-digit letter keys', async () => {
    const { onDigit } = setup()
    await userEvent.keyboard('a')
    expect(onDigit).not.toHaveBeenCalled()
  })

  it('does not hijack typing while an input is focused', async () => {
    const { onDigit } = setup()
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    await userEvent.keyboard('1')
    expect(onDigit).not.toHaveBeenCalled()
    input.remove()
  })

  it('ignores digit keys held with a modifier', async () => {
    const { onDigit } = setup()
    await userEvent.keyboard('{Meta>}1{/Meta}')
    expect(onDigit).not.toHaveBeenCalled()
  })

  it('still fires onDigit on button click (touch/click path)', async () => {
    const { onDigit } = setup()
    await userEvent.click(screen.getByRole('button', { name: '7' }))
    expect(onDigit).toHaveBeenCalledWith('7')
  })
})
