import axios from 'axios'
import { apiRoot } from '../config/env'
import { useLocaleStore } from '../stores/localeStore'

export const api = axios.create({
  baseURL: apiRoot,
  timeout: 15000,
  // Session-cookie based auth: include cookies on every request (BE sets HttpSession cookie).
  // CSRF: Spring Security sets XSRF-TOKEN cookie; Axios reads it and sends X-XSRF-TOKEN header
  // automatically when withCredentials is true and these names are configured.
  withCredentials: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
})

api.interceptors.request.use((config) => {
  config.headers.set('Accept-Language', useLocaleStore.getState().locale)
  return config
})
