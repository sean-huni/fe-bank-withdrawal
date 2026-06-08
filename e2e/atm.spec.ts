import { test, expect } from '@playwright/test'

const CARD = '4539148803436467'

const cardSnapshot = {
  success: true,
  data: {
    accountId: 'acc-1',
    holderName: 'Alice',
    maskedCardNumber: '•••• 6467',
    balance: '1000.00',
    currency: 'EUR',
  },
  error: null,
  timestamp: '2026-06-08T10:00:00Z',
  traceId: 'trace-1',
}

const withdrawalTx = {
  success: true,
  data: {
    transactionId: 'tx-1',
    accountId: 'acc-1',
    type: 'DEBIT',
    amount: '50',
    balanceAfter: '950.00',
    occurredAt: '2026-06-08T10:00:00Z',
  },
  error: null,
  timestamp: '2026-06-08T10:00:00Z',
  traceId: 'trace-2',
}

test('happy path: insert card → PIN → withdraw → receipt', async ({ page }) => {
  await page.route('**/api/v1/cards/*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cardSnapshot) }),
  )
  await page.route('**/accounts/*/withdrawals', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(withdrawalTx) }),
  )

  await page.goto('/')

  // Welcome: enter the card and insert.
  await page.getByPlaceholder('#### #### #### ####').fill(CARD)
  await page.getByRole('button', { name: /Insert card/i }).click()

  // Pin: cosmetic 4-digit keypad + Enter.
  await expect(page).toHaveURL(/\/pin$/)
  for (const d of ['1', '2', '3', '4']) {
    await page.getByRole('button', { name: d, exact: true }).click()
  }
  await page.getByRole('button', { name: /Enter/i }).click()

  // Menu → Withdraw.
  await expect(page).toHaveURL(/\/menu$/)
  await page.getByRole('button', { name: /Withdraw/i }).click()

  // Withdraw: pick the €50 quick-cash chip, then confirm.
  await expect(page).toHaveURL(/\/withdraw$/)
  await page.getByRole('button', { name: /50/ }).click()
  await page.getByRole('button', { name: /Confirm|Simbisa/i }).click()

  // Receipt: success + new balance.
  await expect(page).toHaveURL(/\/receipt$/)
  await expect(page.getByText('✅', { exact: false })).toBeVisible()
  await expect(page.getByText(/950\.00/)).toBeVisible()
})
