import { test, expect } from '@playwright/test'

/**
 * UX-review screenshot capture — walks every screen with mocked routes and
 * saves full-page PNGs. Not a regression test: gated behind SCREENSHOTS=1 so
 * the normal e2e run skips it.
 *
 *   SCREENSHOTS=1 npx playwright test e2e/ux-screenshots.spec.ts
 */
test.skip(!process.env.SCREENSHOTS, 'screenshot capture — run with SCREENSHOTS=1')

const SHOT_DIR = '.superpowers/ux-shots'
const CARD = '4539148803436467'

const cardSummary = {
  success: true,
  data: { holderName: 'Alice', maskedCardNumber: '•••• •••• •••• 6467' },
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
    balance: '120.00', // makes the €200 quick-cash chip render its disabled over-balance state
    currency: 'EUR',
  },
  error: null,
  timestamp: '2026-06-08T10:00:00Z',
  traceId: 'trace-verify',
}

const atmSessionOk = {
  success: true,
  data: { accountId: 'acc-1', holderName: 'Alice', maskedCardNumber: '•••• •••• •••• 6467', passkeyEnrolled: true },
  error: null,
  timestamp: '2026-06-08T10:00:00Z',
  traceId: 'trace-session',
}

const withdrawalTx = {
  success: true,
  data: {
    transactionId: 'tx-1',
    accountId: 'acc-1',
    type: 'DEBIT',
    amount: '50',
    balanceAfter: '70.00',
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
          transactionId: `f3b9c2d8-7e4a-4f1b-9c6d-p${number}00000000`,
          accountId: 'acc-1',
          type: 'DEBIT',
          amount: '50',
          balanceAfter: '950.00',
          occurredAt: '2026-06-08T10:00:00Z',
        },
        {
          transactionId: `a1e5d7c3-2b8f-4a9e-8d1c-p${number}11111111`,
          accountId: 'acc-1',
          type: 'CREDIT',
          amount: '200',
          balanceAfter: '1000.00',
          occurredAt: '2026-06-07T16:30:00Z',
        },
      ],
      page: { size: 10, number, totalElements: totalPages * 10, totalPages },
    },
    error: null,
    timestamp: '2026-06-08T10:00:00Z',
    traceId: `trace-statement-${number}`,
  }
}

test.use({ viewport: { width: 480, height: 900 } })

// Shared route mocks. NOTE: no clock.install() in the main walk — a frozen clock
// stalls framer-motion's entry fade and screenshots capture half-faded cards.
async function mockRoutes(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/atm/session', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(atmSessionOk) }),
  )
  await page.route('**/api/v1/cards/*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cardSummary) }),
  )
  await page.route('**/api/v1/cards/*/pin', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(accountSnapshot) }),
  )
  await page.route('**/accounts/*/withdrawals', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(withdrawalTx) }),
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
}

test('capture every screen for UX review', async ({ page }) => {
  await mockRoutes(page)

  const settle = () => page.waitForTimeout(350) // let the 0.2s ScreenFrame fade finish
  const shot = async (name: string) => {
    await settle()
    await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: true })
  }

  // 01 Welcome
  await page.goto('/')
  await shot('01-welcome')

  // 02 PIN
  await page.getByPlaceholder('#### #### #### ####').fill(CARD)
  await expect(page).toHaveURL(/\/pin$/)
  await shot('02-pin')

  // 03 Menu
  for (const d of ['1', '2', '3', '4']) {
    await page.getByRole('button', { name: d, exact: true }).click()
  }
  await expect(page).toHaveURL(/\/menu$/)
  await expect(page.getByText(/Passkey registration|Passkey setup/i)).toHaveCount(0)
  await shot('03-menu')

  // 04 Balance
  await page.getByRole('button', { name: /Balance/i }).click()
  await expect(page).toHaveURL(/\/balance$/)
  await shot('04-balance')
  await page.getByRole('button', { name: /Back/i }).click()

  // 05 Statement page 1 + 2
  await page.getByRole('button', { name: /Mini-statement/i }).click()
  await expect(page.getByText('Page 1 of 2')).toBeVisible()
  await shot('05-statement-p1')
  await page.locator('header').getByRole('button', { name: /Mini-statement/i }).click()
  await shot('05b-nav-menu-open')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /Next/i }).click()
  await expect(page.getByText('Page 2 of 2')).toBeVisible()
  await shot('06-statement-p2')
  await page.getByRole('button', { name: /Back/i }).click()

  // 07 Deposit
  await page.getByRole('button', { name: /Deposit/i }).click()
  await expect(page).toHaveURL(/\/deposit$/)
  await shot('07-deposit')
  await page.getByRole('button', { name: /Back/i }).click()

  // 08 Withdraw (balance 120 → €200 chip disabled with hint)
  await page.getByRole('button', { name: /Withdraw/i }).click()
  await expect(page.getByText(/Available/i)).toBeVisible()
  await shot('08-withdraw')

  // 09 Receipt
  await page.getByRole('button', { name: '€50.00' }).click()
  await page.getByRole('button', { name: /Confirm/i }).click()
  await expect(page).toHaveURL(/\/receipt$/)
  await shot('09-receipt')

  await page.getByRole('button', { name: /Another transaction/i }).click()
  await expect(page).toHaveURL(/\/menu$/)
})

test('capture the timeout warning (clocked)', async ({ page }) => {
  await page.clock.install()
  await mockRoutes(page)

  await page.goto('/')
  await page.getByPlaceholder('#### #### #### ####').fill(CARD)
  for (const d of ['1', '2', '3', '4']) {
    await page.getByRole('button', { name: d, exact: true }).click()
  }
  await expect(page).toHaveURL(/\/menu$/)
  await page.clock.fastForward(46_000)
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.screenshot({ path: `${SHOT_DIR}/10-timeout-warning.png`, fullPage: true })
})
