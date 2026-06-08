# 🏧 fe-bank-withdrawal

An ATM-styled React SPA for the [`bank-withdrawal`](../../../be/java/spring/bank-withdrawal)
API: card → PIN → balance → withdraw → deposit → mini-statement → receipt. Login **auto-submits** —
the card is looked up the instant a valid 16-digit Luhn number is entered, and the PIN is
**server-verified** the instant the 4th digit lands (no Insert/Enter press). Emoji-forward
dark glassmorphism, idempotent transactions, EN/SN i18n, and OpenTelemetry → Grafana LGTM
observability.

## Stack

React 19 · TypeScript · Vite · Tailwind 4 · TanStack Query 5 · Zustand 5 · Axios · React Hook
Form + Zod · framer-motion · react-hot-toast · OpenTelemetry (web) · Vitest + React Testing
Library · Playwright.

## Prerequisites

- **Node 22** (see `.nvmrc`) — `nvm use`.
- The **`bank-withdrawal` backend** running on `http://localhost:8080` with the two-phase auth
  endpoints — card lookup (`GET /api/v1/cards/{cardNumber}`, greeting only, no balance) and PIN
  verify (`POST /api/v1/cards/{cardNumber}/pin`). Start its `docker compose up` for the database
  and the Grafana LGTM observability stack.

## Quick start

First time on a fresh machine, bootstrap the toolchain (installs the latest Node LTS via
`nvm`, pins it into `.nvmrc`, then installs deps + Playwright chromium — idempotent, safe to
re-run):

```bash
npm run setup          # or: bash scripts/setup-env.sh
```

Then run the app:

```bash
nvm use                # Node from .nvmrc
cp .env.example .env   # 12-factor config; .env is gitignored
npm install            # (npm run setup already did this)
npm run dev            # http://localhost:5173 — proxies /api → :8080 (no CORS)
```

Open `http://localhost:5173` and type a demo card number — login **auto-submits** the moment a
valid 16-digit Luhn number is entered (no Insert press), greeting you by name. Then type the
**demo PIN `1234`**, which is **server-verified**: authentication fires automatically the instant
the 4th digit lands (no Enter press), and a wrong PIN shows an error and clears for a retry. The
**balance is revealed only after the PIN is verified** — the card lookup returns a greeting only.
The PIN keypad accepts both **touch/click** and **keyboard** input (hardware or Bluetooth):
digits `0`–`9`, `Backspace`, and `Enter`.

## Scripts

| Script              | Purpose                                          |
| ------------------- | ------------------------------------------------ |
| `npm run setup`     | Bootstrap toolchain: Node LTS via nvm + deps     |
| `npm run dev`       | Vite dev server with `/api` proxy to the backend |
| `npm run build`     | `tsc -b && vite build` → `dist/`                 |
| `npm run preview`   | Serve the production build                        |
| `npm run test`      | Vitest unit/component suite (run once)            |
| `npm run test:watch`| Vitest in watch mode                             |
| `npm run typecheck` | `tsc --noEmit` type gate                          |
| `npm run lint`      | ESLint                                            |
| `npm run e2e`       | Playwright E2E (mocked happy path)               |

## 12-factor configuration

All runtime config is read once from `import.meta.env` (`src/config/env.ts`). Set values via
`.env` (gitignored) or real environment variables — never commit secrets. Vite only exposes
variables prefixed `VITE_`. Precedence: process environment overrides `.env`; each var falls
back to the default below if unset.

| Variable               | Default                               | Meaning                                                              |
| ---------------------- | ------------------------------------- | ------------------------------------------------------------------- |
| `VITE_API_BASE_URL`    | `/api`                                | Base path for API calls (proxied to the backend in dev).            |
| `VITE_API_VERSION`     | `v1`                                  | API version segment; combined as `${base}/${version}`.              |
| `VITE_OTLP_BASE_URL`   | `http://localhost:4318`               | OTLP/HTTP collector base; traces → `/v1/traces`, metrics → `/v1/metrics`. |
| `VITE_GRAFANA_URL`     | `http://localhost:3000`               | Grafana link in the dev banner.                                     |
| `VITE_PROMETHEUS_URL`  | `http://localhost:9090`               | Prometheus link in the dev banner.                                  |
| `VITE_SWAGGER_URL`     | `http://localhost:8080/swagger-ui.html` | Backend OpenAPI/Swagger link in the dev banner.                   |
| `VITE_PROXY_TARGET`    | `http://localhost:8080`               | Dev-only Vite proxy target for `/api` (see `vite.config.ts`).       |

## Demo cards (seeded)

The backend seeds two demo accounts. Card numbers are Luhn-valid and friendly (no UUIDs):

| Holder | Card number           |
| ------ | --------------------- |
| Alice  | `4539 1488 0343 6467` |
| Bob    | `6011 0009 9013 9424` |

The **demo PIN is `1234`** and is **verified server-side** (`POST /cards/{n}/pin`) — a wrong PIN
returns `401 PIN_INVALID`, surfaced as an inline error before clearing for a retry. After a
successful verify, the card is remembered locally (Zustand `persist`) and appears as a tap-to-use
tile on the Welcome screen; the authenticated balance is held in the session and patched after
each transaction (no balance refetch). In dev, the bottom **dev banner** shows the live signed-in
holder and masked card, plus links to Grafana, Prometheus and Swagger.

## Internationalisation

Toggle **EN / SN** (English / Shona) top-right; the choice persists and is sent to the backend
as `Accept-Language` on every request. Shona strings are machine-drafted and pending native
review (consistent with the backend message bundle).

## Observability

`initTelemetry()` (in `src/main.tsx`) wires browser OpenTelemetry:

- **Traces** — document-load, `fetch` and `XMLHttpRequest` auto-instrumentation, exported via
  OTLP/HTTP to `${VITE_OTLP_BASE_URL}/v1/traces`.
- **Metrics** — exported to `${VITE_OTLP_BASE_URL}/v1/metrics` every 10s. Custom ATM counters
  (`src/telemetry/index.ts`):
  - `atm_session_started_total`
  - `atm_card_lookup_total{result}` (`success` / `not_found` / `error`)
  - `atm_pin_verify_total{result}` (`success` / `invalid` / `error`) — the PIN value is never a label
  - `atm_balance_inquiry_total`
  - `atm_withdrawal_total{result}` (`success` / `insufficient_funds` / `error`)
  - `atm_deposit_total{result}` (`success` / `error`)
  - `atm_web_vitals` histogram (CLS, INP, LCP, TTFB, FCP) via `web-vitals`.

OTLP export failures are tolerated when no collector is running (dev still works).

### Import the Grafana dashboard

A ready-made dashboard lives at `observability/grafana/atm-frontend-dashboard.json`.

1. Open Grafana (`http://localhost:3000`).
2. **Dashboards → New → Import**.
3. Upload `observability/grafana/atm-frontend-dashboard.json` (or paste its contents).
4. Select your **Prometheus** datasource when prompted.

Panels: sessions/5m, withdrawals by result, card lookups by result, deposit & balance-inquiry
totals, and a Web Vitals p95 panel.

## Architecture

A guarded screen state-machine on React Router. Zustand holds the session — including the
authenticated balance, set at PIN verify and patched after each transaction — plus the saved
cards (localStorage); TanStack Query owns the lookup/verify/transaction mutations and statement
query; Axios injects `Accept-Language` and a per-operation `Idempotency-Key` (created once per
withdraw/deposit operation, reused on retry).
Errors are branched on the backend `error.code`, mapped to friendly emoji messages
(`src/lib/errorMap.ts`) and surfaced as toasts.

## Testing

```bash
npm run test          # Vitest (Luhn, currency, error map, cards & session stores, Pin + Withdraw components)
npm run e2e           # Playwright mocked happy path (e2e/atm.spec.ts)
```

The `@live` smoke test (`e2e/live-smoke.spec.ts`) hits the real backend and is opt-in — it
requires `bank-withdrawal` running with the card endpoint and a seeded card. Run it with:

```bash
npx playwright test e2e/live-smoke.spec.ts --grep @live
```
