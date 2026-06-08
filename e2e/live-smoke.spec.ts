import { test, expect } from '@playwright/test'

/**
 * Opt-in live smoke. No route mocks — hits the real `bank-withdrawal` backend
 * via the dev proxy. Requires the backend running with the card endpoint (Plan A
 * merged) and the seeded Alice card. Skipped by default; run with:
 *   RUN_LIVE=1 npx playwright test e2e/live-smoke.spec.ts --grep @live
 */

const ALICE = '4539148803436467'

test('@live balance inquiry and a small deposit against the real backend', async ({ page }) => {
  await page.goto('/')

  // Sign in with the seeded card.
  await page.getByPlaceholder('#### #### #### ####').fill(ALICE)
  await page.getByRole('button', { name: /Insert card/i }).click()
  await expect(page).toHaveURL(/\/pin$/)

  // Cosmetic PIN.
  for (const d of ['1', '2', '3', '4']) {
    await page.getByRole('button', { name: d, exact: true }).click()
  }
  await page.getByRole('button', { name: /Enter/i }).click()
  await expect(page).toHaveURL(/\/menu$/)

  // Balance inquiry shows a currency-formatted amount.
  await page.getByRole('button', { name: /Balance|Mari iripo/i }).click()
  await expect(page).toHaveURL(/\/balance$/)
  await expect(page.getByText(/[€$]/)).toBeVisible()
  await page.getByRole('button', { name: /◀/ }).click()

  // Small deposit → receipt.
  await page.getByRole('button', { name: /Deposit|Isa mari/i }).click()
  await expect(page).toHaveURL(/\/deposit$/)
  await page.getByRole('button', { name: /20/ }).first().click()
  await page.getByRole('button', { name: /Confirm|Simbisa/i }).click()
  await expect(page).toHaveURL(/\/receipt$/)
  await expect(page.getByText('✅', { exact: false })).toBeVisible()
})
