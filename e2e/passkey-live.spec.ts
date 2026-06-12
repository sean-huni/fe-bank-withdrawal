import { test, expect, type Page } from '@playwright/test'

/**
 * Opt-in live passkey ceremony test. No route mocks — drives the REAL WebAuthn
 * registration + authentication ceremonies against the running backend via a
 * CDP virtual authenticator (platform/internal, resident key, user-verifying).
 *
 * Regression context: enrollment used to fail with a bare 400 because
 * finishRegistration sent { publicKey: <cred>, label } where Spring Security 7
 * expects { publicKey: { credential, label } } (fixed 2026-06-11).
 *
 * Uses Bob's seeded card so Alice keeps passkeyEnrolled=false for manual demos.
 * NOTE: mutates dev BE state — Bob has a passkey enrolled after this run
 * (until the backend's in-memory credential store is restarted).
 *
 * Run with:
 *   RUN_LIVE=1 npx playwright test e2e/passkey-live.spec.ts --grep @live
 */

const BOB = '6011000990139424'

async function addVirtualAuthenticator(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })
}

async function signInWithCardAndPin(page: Page) {
  await page.goto('/')
  // Valid Luhn card number auto-submits; 4th PIN digit auto-verifies.
  await page.getByPlaceholder('#### #### #### ####').fill(BOB)
  await expect(page).toHaveURL(/\/pin$/)
  for (const d of ['1', '2', '3', '4']) {
    await page.getByRole('button', { name: d, exact: true }).click()
  }
}

test('@live passkey enrollment ceremony succeeds against the real backend', async ({ page }) => {
  await addVirtualAuthenticator(page)
  await signInWithCardAndPin(page)

  // Platform authenticator available + not enrolled → one-time enroll prompt.
  await expect(page).toHaveURL(/\/(enable-passkey|menu)$/)
  if (!page.url().endsWith('/enable-passkey')) {
    test.skip(true, 'Account already has a passkey enrolled — restart the BE to reset.')
  }

  await page.getByRole('button', { name: /Enable now|🔐/ }).click()

  // Success: enabled-toast and navigation to the menu (enrollment 400 would
  // surface the passkeyEnrollError toast and stay on /enable-passkey).
  await expect(page).toHaveURL(/\/menu$/)
  await expect(page.getByText(/Passkey enabled/i).first()).toBeVisible()
})

test('@live passkey login ceremony succeeds after enrollment', async ({ page }) => {
  await addVirtualAuthenticator(page)
  await signInWithCardAndPin(page)
  await expect(page).toHaveURL(/\/(enable-passkey|menu)$/)
  if (page.url().endsWith('/enable-passkey')) {
    await page.getByRole('button', { name: /Skip/i }).click()
    await expect(page).toHaveURL(/\/menu$/)
  }

  // Self-provision a resident credential on THIS page's virtual authenticator
  // through the real ceremony endpoints (the account may already be enrolled
  // server-side from earlier runs, but each fresh virtual authenticator is
  // empty — the UI prompt would not reappear).
  await page.evaluate(async () => {
    const xsrf = decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? '')
    const headers = { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': xsrf }
    const optRes = await fetch('/webauthn/register/options', {
      method: 'POST', headers, credentials: 'include',
    })
    if (!optRes.ok) throw new Error(`register/options ${optRes.status}`)
    const options = await optRes.json()
    const cred = (await navigator.credentials.create({
      publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(options),
    })) as PublicKeyCredential
    const finishRes = await fetch('/webauthn/register', {
      method: 'POST', headers, credentials: 'include',
      body: JSON.stringify({ publicKey: { credential: cred.toJSON(), label: 'e2e login test' } }),
    })
    if (!finishRes.ok) throw new Error(`register finish ${finishRes.status}`)
  })

  // Fresh visit (cleared session storage) → username-less passkey login.
  // Welcome's "Tap to authenticate" navigates to /passkey-auth; the button
  // there with the same label actually runs the ceremony.
  await page.goto('/')
  await page.evaluate(() => sessionStorage.clear())
  await page.getByRole('button', { name: /Tap to authenticate/i }).click()
  await expect(page).toHaveURL(/\/passkey-auth$/)
  await page.getByRole('button', { name: /Tap to authenticate/i }).click()
  await expect(page).toHaveURL(/\/menu$/, { timeout: 10_000 })
})
