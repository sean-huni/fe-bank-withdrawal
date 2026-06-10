import axios, { type CreateAxiosDefaults } from 'axios'
import { apiRoot, env } from '../config/env'
import { useLocaleStore } from '../stores/localeStore'

/** Shared axios configuration (credentials + XSRF) applied to every instance. */
const sharedConfig: CreateAxiosDefaults = {
  timeout: 15000,
  // Session-cookie based auth: include cookies on every request (BE sets HttpSession cookie).
  // CSRF: Spring Security sets XSRF-TOKEN cookie; Axios reads it and sends X-XSRF-TOKEN header
  // automatically when withCredentials is true and these names are configured.
  withCredentials: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
}

/** Main API client — baseURL is /api/v1 (versioned namespace). */
export const api = axios.create({ ...sharedConfig, baseURL: apiRoot })

/**
 * Ceremony client — baseURL is the server origin (default '' = same-origin).
 * Used for Spring Security WebAuthn endpoints (/webauthn/..., /login/webauthn)
 * which live at the context root, NOT under /api/v1.
 * In dev the Vite proxy forwards /webauthn and /login to the backend.
 */
export const ceremonyApi = axios.create({ ...sharedConfig, baseURL: env.serverOrigin })

function addLocaleHeader(instance: ReturnType<typeof axios.create>) {
  instance.interceptors.request.use((config) => {
    config.headers.set('Accept-Language', useLocaleStore.getState().locale)
    return config
  })
}

addLocaleHeader(api)
addLocaleHeader(ceremonyApi)
