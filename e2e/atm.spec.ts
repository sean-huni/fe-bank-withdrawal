import { test, expect } from '@playwright/test'

const CARD = '4539148803436467'

const cardSummary = {
  success: true,
  data: {
    holderName: 'Alice',
    maskedCardNumber: '•••• •••• •••• 6467',
  },
  error: null,
  timestamp: '2026-06-08T10:00:00Z',
  traceId: 'trace-lookup',
}

const accountSnapshot = {
  success: true,
  data: {
    accountId: 'acc-1',
    holderName: 'Alice',
    maskedCardNumber: '•••• •••• •••• 6467',
    balance: '1000.00',
    currency: 'EUR',
  },
  error: null,
  timestamp: '2026-06-08T10:00:00Z',
  traceId: 'trace-verify',
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
  traceId: 'trace-withdraw',
}

function statementPage(number: number, totalPages: number) {
  return {
    success: true,
    data: {
      content: [
        {
          transactionId: `tx-p${number}`,
          accountId: 'acc-1',
          type: 'DEBIT',
          amount: '50',
          balanceAfter: '950.00',
          occurredAt: '2026-06-08T10:00:00Z',
        },
      ],
      page: { size: 10, number, totalElements: totalPages * 10, totalPages },
    },
    error: null,
    timestamp: '2026-06-08T10:00:00Z',
    traceId: `trace-statement-${number}`,
  }
}

test('happy path: auto-submit card → auto-verify PIN → withdraw → receipt', async ({ page }) => {
  // Two-phase auth: GET .../cards/{n} is the greeting lookup, POST .../pin verifies.
  // Playwright matches the most-recently-registered route first, so register the more
  // specific `/pin` route LAST to ensure it wins over the broader `/cards/*` matcher.
  await page.route('**/api/v1/cards/*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cardSummary) }),
  )
  await page.route('**/api/v1/cards/*/pin', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(accountSnapshot) }),
  )
  await page.route('**/accounts/*/withdrawals', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(withdrawalTx) }),
  )

  await page.goto('/')

  // Welcome: typing a valid 16-digit Luhn number auto-submits — no Insert click.
  await page.getByPlaceholder('#### #### #### ####').fill(CARD)
  await expect(page).toHaveURL(/\/pin$/)

  // Pin: typing the 4th digit auto-verifies — no Enter click.
  for (const d of ['1', '2', '3', '4']) {
    await page.getByRole('button', { name: d, exact: true }).click()
  }
  await expect(page).toHaveURL(/\/menu$/)

  // Menu → Withdraw.
  await page.getByRole('button', { name: /Withdraw|Bvisa mari/i }).click()
  await expect(page).toHaveURL(/\/withdraw$/)

  // Withdraw: pick the €50 quick-cash chip, then confirm.
  await page.getByRole('button', { name: /50/ }).click()
  await page.getByRole('button', { name: /Confirm|Simbisa/i }).click()

  // Receipt: success + new balance.
  await expect(page).toHaveURL(/\/receipt$/)
  await expect(page.getByRole('heading', { name: /✅/, level: 2 })).toBeVisible()
  await expect(page.getByText(/950\.00/)).toBeVisible()
})

test('app bar + statement pagination: back to menu, page through statement', async ({ page }) => {
  await page.route('**/api/v1/cards/*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cardSummary) }),
  )
  await page.route('**/api/v1/cards/*/pin', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(accountSnapshot) }),
  )
  await page.route('**/accounts/*/transactions*', (route) => {
    const url = new URL(route.request().url())
    const pageNo = Number(url.searchParams.get('page') ?? '0')
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(statementPage(pageNo, 2)),
    })
  })

  await page.goto('/')
  await page.getByPlaceholder('#### #### #### ####').fill(CARD)
  await expect(page).toHaveURL(/\/pin$/)
  for (const d of ['1', '2', '3', '4']) {
    await page.getByRole('button', { name: d, exact: true }).click()
  }
  await expect(page).toHaveURL(/\/menu$/)

  // Menu shows no Back; keyboard focus gets the cyan outline (focus-visible pass).
  await expect(page.getByRole('button', { name: /Back|Dzokera/i })).toHaveCount(0)
  await page.keyboard.press('Tab')
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)
  expect(outline).toBe('solid')

  // Withdraw: Available banner, then jump straight to the Statement via the title menu.
  await page.getByRole('button', { name: /Withdraw|Bvisa mari/i }).click()
  await expect(page).toHaveURL(/\/withdraw$/)
  await expect(page.getByText(/Available|Mari inowanikwa/i)).toBeVisible()
  await page.locator('header').getByRole('button', { name: /Withdraw|Bvisa mari/i }).click()
  await page.getByRole('menuitem', { name: /Mini-statement|Chitsauko/i }).click()
  await expect(page).toHaveURL(/\/statement$/)

  // App-bar Back still returns to the menu, then re-enter the statement.
  await page.getByRole('button', { name: /Back|Dzokera/i }).click()
  await expect(page).toHaveURL(/\/menu$/)
  await page.getByRole('button', { name: /Mini-statement|Chitsauko/i }).click()
  await expect(page).toHaveURL(/\/statement$/)
  await expect(page.getByText('Page 1 of 2')).toBeVisible()
  await expect(page.getByRole('button', { name: /Prev|Shure/i })).toBeDisabled()
  await page.getByRole('button', { name: /Next|Mberi/i }).click()
  await expect(page.getByText('Page 2 of 2')).toBeVisible()
  await expect(page.getByRole('button', { name: /Next|Mberi/i })).toBeDisabled()
})
