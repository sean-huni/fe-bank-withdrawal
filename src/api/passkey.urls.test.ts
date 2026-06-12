/**
 * Regression tests — ceremony URL resolution (the shipped-404 bug).
 *
 * The original implementation routed all WebAuthn ceremony endpoints through the
 * `api` axios instance (baseURL = /api/v1), which caused every request to resolve
 * to /api/v1/webauthn/... → 404.
 *
 * The fix added a `ceremonyApi` instance with baseURL = env.serverOrigin (default ''),
 * keeping ceremony calls at the context root (/webauthn/..., /login/webauthn).
 *
 * These tests lock in:
 *  1. All four ceremony endpoints resolve to root paths (NOT under /api/).
 *  2. The atmSession endpoint resolves to exactly ONE /api/v1 prefix (no double-prefix).
 *  3. ceremonyApi carries the same withCredentials + XSRF config as the main `api` client.
 */

import { describe, it, expect } from 'vitest'
import { api, ceremonyApi } from './client'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolve the fully-qualified URL that axios would use for a given path on an
 * instance.  We rely on `axios.getUri`, which concatenates the instance's
 * baseURL with the supplied url — identical to what the real adapter receives.
 */
function resolveUrl(instance: typeof api, path: string): string {
  return instance.getUri({ url: path })
}

// ── Test 1: ceremony endpoints are NOT under /api/ ────────────────────────────

describe('passkey ceremony endpoint URL resolution', () => {
  const ceremonyEndpoints: [label: string, path: string][] = [
    ['registerOptions', '/webauthn/register/options'],
    ['registerFinish', '/webauthn/register'],
    ['authOptions', '/webauthn/authenticate/options'],
    ['authFinish', '/login/webauthn'],
  ]

  for (const [label, path] of ceremonyEndpoints) {
    it(`${label} (${path}) resolves via ceremonyApi — NOT under /api/`, () => {
      const resolved = resolveUrl(ceremonyApi, path)

      // Must not start with /api/ — that was the 404 bug
      expect(
        resolved.startsWith('/api/'),
        `${label}: expected resolved URL "${resolved}" NOT to start with /api/`,
      ).toBe(false)

      // Must equal the expected root-level path
      expect(resolved).toBe(path)
    })
  }

  // Sanity: make sure the assertion is meaningful by also verifying what the
  // wrong (old) instance would produce — if someone accidentally swaps
  // ceremonyApi back to api, the URL would contain /api/v1.
  it('same ceremony paths on the `api` instance WOULD start with /api/ (red proof baseline)', () => {
    const resolved = resolveUrl(api, '/webauthn/register/options')
    expect(resolved.startsWith('/api/')).toBe(true)
  })
})

// ── Test 2: atmSession resolves to exactly one /api/v1 prefix ─────────────────

describe('atmSession endpoint URL resolution', () => {
  it('resolves to /api/v1/atm/session — exactly one /api/v1 prefix, no double-prefix', () => {
    const atmSessionPath = '/atm/session'
    const resolved = resolveUrl(api, atmSessionPath)

    expect(resolved).toBe('/api/v1/atm/session')

    // Guard: ensure the resolved URL does NOT contain /api/v1/api/v1 (double-prefix)
    expect(resolved).not.toContain('/api/v1/api/')
  })
})

// ── Test 3: ceremonyApi carries the same security config as `api` ─────────────

describe('ceremonyApi shared security config', () => {
  it('carries withCredentials: true (same as the main api client)', () => {
    // Access instance defaults — axios exposes them on instance.defaults
    expect((ceremonyApi.defaults as Record<string, unknown>).withCredentials).toBe(true)
    expect((api.defaults as Record<string, unknown>).withCredentials).toBe(true)
  })

  it('carries the correct xsrfCookieName (XSRF-TOKEN)', () => {
    expect((ceremonyApi.defaults as Record<string, unknown>).xsrfCookieName).toBe('XSRF-TOKEN')
    expect((api.defaults as Record<string, unknown>).xsrfCookieName).toBe('XSRF-TOKEN')
  })

  it('carries the correct xsrfHeaderName (X-XSRF-TOKEN)', () => {
    expect((ceremonyApi.defaults as Record<string, unknown>).xsrfHeaderName).toBe('X-XSRF-TOKEN')
    expect((api.defaults as Record<string, unknown>).xsrfHeaderName).toBe('X-XSRF-TOKEN')
  })
})
