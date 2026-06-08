import axios from 'axios'
import { apiRoot } from '../config/env'
import { useLocaleStore } from '../stores/localeStore'

export const api = axios.create({ baseURL: apiRoot, timeout: 15000 })

api.interceptors.request.use((config) => {
  config.headers.set('Accept-Language', useLocaleStore.getState().locale)
  return config
})
