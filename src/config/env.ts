export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  apiVersion: import.meta.env.VITE_API_VERSION ?? 'v1',
  otlpBaseUrl: import.meta.env.VITE_OTLP_BASE_URL ?? 'http://localhost:4318',
  grafanaUrl: import.meta.env.VITE_GRAFANA_URL ?? 'http://localhost:3000',
  prometheusUrl: import.meta.env.VITE_PROMETHEUS_URL ?? 'http://localhost:9090',
  swaggerUrl: import.meta.env.VITE_SWAGGER_URL ?? 'http://localhost:8080/swagger-ui.html',
  isDev: import.meta.env.DEV,
} as const

/** Base path for all API calls, e.g. "/api/v1". */
export const apiRoot = `${env.apiBaseUrl}/${env.apiVersion}`
