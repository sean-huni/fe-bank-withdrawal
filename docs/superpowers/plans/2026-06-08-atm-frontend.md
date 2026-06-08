# ATM Frontend (`fe-bank-withdrawal`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an ATM-styled React SPA (`fe-bank-withdrawal`) that consumes the `bank-withdrawal` API — insert card → PIN → balance → withdraw → deposit → mini-statement → receipt — with emoji-forward dark glassmorphism, idempotent transactions, EN/SN i18n, and OpenTelemetry → Grafana LGTM observability.

**Architecture:** A guarded screen state-machine on React Router. Zustand holds session + saved cards (localStorage); TanStack Query owns server state; Axios injects `Accept-Language` and a per-operation `Idempotency-Key`. 12-factor config via `VITE_*`/`.env` only. Dev uses a Vite proxy (`/api → :8080`) so there's no CORS. Depends on the backend card endpoint (see `2026-06-08-backend-card-endpoint.md`); develops against a mock until it merges.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind 4 + TanStack Query 5 + Zustand 5 + Axios + React Hook Form + Zod + framer-motion + react-hot-toast + OpenTelemetry (web) + Vitest + React Testing Library + Playwright. (Mirrors `the-drop-fe`, trimmed.)

**Working directory:** `/Users/sean/env/repo/fe/react/fe-bank-withdrawal` (new). Remote `git@github.com:sean-huni/fe-bank-withdrawal.git`, branch `main`. Commit in small increments and push (per user preference).

**Backend contract (from Plan A):**
- `GET /api/v1/cards/{cardNumber}` → `{success,data:{accountId,holderName,maskedCardNumber,balance,currency},traceId}`; 404 `CARD_NOT_FOUND`; 400 `VALIDATION_FAILED`.
- `POST /api/v1/accounts/{accountId}/withdrawals` & `/deposits` — body `{amount}`, header `Idempotency-Key: <uuid>` → `{data:{transactionId,accountId,type,amount,balanceAfter,occurredAt}}`; 422 `INSUFFICIENT_FUNDS`, 404 `ACCOUNT_NOT_FOUND`, 409 `IDEMPOTENCY_CONFLICT`, 400 `VALIDATION_FAILED`.
- `GET /api/v1/accounts/{accountId}/transactions?page=&size=&sort=createdAt,desc` → `{data:{content:[...],page:{...}}}` (Spring `PagedModel`).
- Error envelope: `{success:false,error:{code,message,violations?},traceId}`. **Branch on `error.code`, show `error.message`.**

---

## File Structure

```
fe-bank-withdrawal/
  index.html
  package.json  tsconfig.json  vite.config.ts  tailwind.config.ts  postcss.config.js
  .env.example  .gitignore  .nvmrc  README.md
  playwright.config.ts
  observability/grafana/atm-frontend-dashboard.json
  src/
    main.tsx  App.tsx  index.css  router.tsx
    config/env.ts            # 12-factor: all config from import.meta.env
    config/currency.ts       # Intl currency formatting
    config/quickCash.ts      # quick-cash chip amounts
    lib/luhn.ts              # card-number Luhn check
    lib/idempotency.ts       # per-operation key
    lib/errorMap.ts          # {status,code}→{emoji,title,detail,recoverable}
    api/client.ts            # axios instance + interceptors
    api/atm.ts               # typed endpoint fns
    api/types.ts             # ApiResponse/AccountSnapshot/Transaction types
    stores/sessionStore.ts   # active card→accountId, label, startedAt
    stores/cardsStore.ts     # saved cards (persist)
    stores/localeStore.ts    # en|sn (persist)
    telemetry/index.ts       # OTel init + custom ATM metrics
    i18n/strings.ts          # en + sn dictionaries + useT hook
    hooks/useCardLookup.ts  useBalance.ts  useStatement.ts  useTransaction.ts  useSessionTimeout.ts
    components/ScreenFrame.tsx  Keypad.tsx  AmountPad.tsx  Money.tsx
               LanguageToggle.tsx  DevBanner.tsx  CardTile.tsx  RequireSession.tsx
    screens/Welcome.tsx  Pin.tsx  Menu.tsx  Balance.tsx  Withdraw.tsx
            Deposit.tsx  Statement.tsx  Receipt.tsx
  tests/  (Vitest specs colocated as *.test.ts(x); Playwright in e2e/)
```

---

## Task 1: Scaffold the repo (Vite + React + TS), Tailwind, deps, proxy, git

**Files:** create the project skeleton.

- [ ] **Step 1: Create the project**
```bash
mkdir -p /Users/sean/env/repo/fe/react/fe-bank-withdrawal
cd /Users/sean/env/repo/fe/react/fe-bank-withdrawal
npm create vite@latest . -- --template react-ts
```

- [ ] **Step 2: Install dependencies**
```bash
npm install @tanstack/react-query axios zustand react-router-dom react-hook-form zod \
  @hookform/resolvers react-hot-toast framer-motion
npm install @opentelemetry/api @opentelemetry/sdk-trace-web @opentelemetry/sdk-metrics \
  @opentelemetry/exporter-trace-otlp-http @opentelemetry/exporter-metrics-otlp-http \
  @opentelemetry/instrumentation @opentelemetry/instrumentation-fetch \
  @opentelemetry/instrumentation-xml-http-request @opentelemetry/instrumentation-document-load \
  @opentelemetry/resources @opentelemetry/semantic-conventions @opentelemetry/context-zone web-vitals
npm install -D tailwindcss @tailwindcss/postcss postcss autoprefixer \
  vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom \
  @playwright/test
```

- [ ] **Step 3: Tailwind 4 setup**

`postcss.config.js`:
```js
export default { plugins: { '@tailwindcss/postcss': {} } }
```
`src/index.css` (top):
```css
@import "tailwindcss";

@theme {
  --color-brand-500: #1890FF;
  --color-accent-cyan: #00D9FF;
  --color-accent-purple: #8B5CF6;
  --color-surface-950: #020617;
  --color-surface-900: #0F172A;
  --color-surface-800: #1E293B;
  --color-surface-700: #334155;
  --font-sans: "Outfit", system-ui, sans-serif;
  --font-display: "Space Grotesk", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}
body { @apply bg-surface-950 text-slate-100 font-sans; }
.glass { @apply bg-surface-800/50 backdrop-blur-xl border border-surface-700/50 rounded-2xl; }
```

- [ ] **Step 4: Vite config — dev proxy + Vitest**

`vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8080', changeOrigin: true } },
  },
  test: { environment: 'jsdom', globals: true, setupFiles: './src/test-setup.ts' },
})
```
`src/test-setup.ts`:
```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5: 12-factor env skeleton**

`.env.example`:
```dotenv
# ENV files should not be committed; this is a skeleton to build upon.
VITE_API_BASE_URL=/api
VITE_API_VERSION=v1
VITE_OTLP_BASE_URL=http://localhost:4318
VITE_GRAFANA_URL=http://localhost:3000
VITE_PROMETHEUS_URL=http://localhost:9090
VITE_SWAGGER_URL=http://localhost:8080/swagger-ui.html
VITE_PROXY_TARGET=http://localhost:8080
```
`.gitignore` — confirm it contains `node_modules`, `dist`, `.env`, `playwright-report`, `test-results`.
`.nvmrc` — `22` (or the Node LTS in use).

- [ ] **Step 6: First commit + remote + push**
```bash
git init
git add -A
git commit -m "{JIRA-TICKET}: Scaffold Vite React TS ATM with Tailwind, deps, dev proxy, 12-factor env"
git remote add origin git@github.com:sean-huni/fe-bank-withdrawal.git
git branch -M main
git push -u origin main
```

---

## Task 2: Config, currency, quick-cash (12-factor)

**Files:** Create `src/config/env.ts`, `src/config/currency.ts`, `src/config/quickCash.ts`. Test `src/config/currency.test.ts`.

- [ ] **Step 1: env module — single read point for all config**

`src/config/env.ts`:
```ts
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
```

- [ ] **Step 2: Write the failing currency test**

`src/config/currency.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { formatMoney } from './currency'

describe('formatMoney', () => {
  it('formats EUR with grouping and two decimals', () => {
    expect(formatMoney('1000', 'EUR')).toBe('€1,000.00')
  })
  it('accepts numbers', () => {
    expect(formatMoney(250.5, 'EUR')).toBe('€250.50')
  })
})
```

- [ ] **Step 3: Run — fails**

Run: `npx vitest run src/config/currency.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement**

`src/config/currency.ts`:
```ts
export function formatMoney(amount: string | number, currency = 'EUR', locale = 'en-IE'): string {
  const value = typeof amount === 'string' ? Number(amount) : amount
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value)
}
```
`src/config/quickCash.ts`:
```ts
export const QUICK_CASH = [20, 50, 100, 200] as const
```

- [ ] **Step 5: Run — passes**

Run: `npx vitest run src/config/currency.test.ts` → PASS.

- [ ] **Step 6: Commit**
```bash
git add src/config && git commit -m "{JIRA-TICKET}: Add 12-factor env, currency formatting and quick-cash config"
git push
```

---

## Task 3: API types, client, endpoints

**Files:** Create `src/api/types.ts`, `src/api/client.ts`, `src/api/atm.ts`.

- [ ] **Step 1: Types**

`src/api/types.ts`:
```ts
export interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: ApiError | null
  timestamp: string
  traceId: string
}
export interface ApiError {
  code: string
  message: string
  violations?: { field: string; code: string | null; message: string; rejectedValue?: string }[]
}
export interface AccountSnapshot {
  accountId: string
  holderName: string
  maskedCardNumber: string
  balance: string
  currency: string
}
export type TransactionType = 'DEBIT' | 'CREDIT'
export interface Transaction {
  transactionId: string
  accountId: string
  type: TransactionType
  amount: string
  balanceAfter: string
  occurredAt: string
}
export interface Page<T> { content: T[]; page: { size: number; number: number; totalElements: number; totalPages: number } }
```

- [ ] **Step 2: Axios client — Accept-Language interceptor**

`src/api/client.ts`:
```ts
import axios from 'axios'
import { apiRoot } from '../config/env'
import { useLocaleStore } from '../stores/localeStore'

export const api = axios.create({ baseURL: apiRoot, timeout: 15000 })

api.interceptors.request.use((config) => {
  config.headers.set('Accept-Language', useLocaleStore.getState().locale)
  return config
})
```

- [ ] **Step 3: Endpoint functions**

`src/api/atm.ts`:
```ts
import { api } from './client'
import type { AccountSnapshot, ApiResponse, Page, Transaction } from './types'

export async function lookupCard(cardNumber: string): Promise<AccountSnapshot> {
  const { data } = await api.get<ApiResponse<AccountSnapshot>>(`/cards/${cardNumber}`)
  return data.data as AccountSnapshot
}

export async function withdraw(accountId: string, amount: string, idempotencyKey: string): Promise<Transaction> {
  const { data } = await api.post<ApiResponse<Transaction>>(
    `/accounts/${accountId}/withdrawals`, { amount }, { headers: { 'Idempotency-Key': idempotencyKey } })
  return data.data as Transaction
}

export async function deposit(accountId: string, amount: string, idempotencyKey: string): Promise<Transaction> {
  const { data } = await api.post<ApiResponse<Transaction>>(
    `/accounts/${accountId}/deposits`, { amount }, { headers: { 'Idempotency-Key': idempotencyKey } })
  return data.data as Transaction
}

export async function statement(accountId: string, page = 0, size = 10): Promise<Page<Transaction>> {
  const { data } = await api.get<ApiResponse<Page<Transaction>>>(
    `/accounts/${accountId}/transactions`, { params: { page, size, sort: 'createdAt,desc' } })
  return data.data as Page<Transaction>
}
```

- [ ] **Step 4: Compile check**

Run: `npx tsc --noEmit`
Expected: passes once `localeStore` exists (Task 6) — if run now, expect the localeStore import error; proceed to Task 6 then re-check. (Order note: implement Task 6 before relying on `tsc`.)

- [ ] **Step 5: Commit**
```bash
git add src/api && git commit -m "{JIRA-TICKET}: Add API types, axios client and ATM endpoint functions"
git push
```

---

## Task 4: Error mapping (TDD)

**Files:** Create `src/lib/errorMap.ts`. Test `src/lib/errorMap.test.ts`.

- [ ] **Step 1: Failing test**

`src/lib/errorMap.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { mapError } from './errorMap'

describe('mapError', () => {
  it('maps insufficient funds (422)', () => {
    const r = mapError(422, { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient funds for withdrawal' })
    expect(r.emoji).toBe('💸')
    expect(r.title).toMatch(/not enough/i)
    expect(r.detail).toBe('Insufficient funds for withdrawal')
    expect(r.recoverable).toBe(true)
  })
  it('maps unknown card (404)', () => {
    expect(mapError(404, { code: 'CARD_NOT_FOUND', message: 'Card not recognised' }).emoji).toBe('💳')
  })
  it('falls back for unknown codes', () => {
    expect(mapError(500, { code: 'INTERNAL_ERROR', message: 'x' }).emoji).toBe('⚠️')
  })
  it('handles a network error (no response)', () => {
    expect(mapError(0, null).emoji).toBe('📡')
  })
})
```

- [ ] **Step 2: Run — fails**

Run: `npx vitest run src/lib/errorMap.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`src/lib/errorMap.ts`:
```ts
import type { ApiError } from '../api/types'

export interface AtmError { emoji: string; title: string; detail: string; recoverable: boolean }

const BY_CODE: Record<string, Omit<AtmError, 'detail'>> = {
  CARD_NOT_FOUND: { emoji: '💳', title: 'Card not recognised', recoverable: true },
  ACCOUNT_NOT_FOUND: { emoji: '💳', title: 'Account unavailable', recoverable: true },
  INSUFFICIENT_FUNDS: { emoji: '💸', title: 'Not enough funds', recoverable: true },
  VALIDATION_FAILED: { emoji: '✋', title: 'Check the amount', recoverable: true },
  IDEMPOTENCY_CONFLICT: { emoji: '⏳', title: 'Already processing', recoverable: true },
}

export function mapError(status: number, error: ApiError | null): AtmError {
  if (status === 0 || error === null) {
    return { emoji: '📡', title: "Can't reach the bank", detail: 'Please try again.', recoverable: true }
  }
  const base = BY_CODE[error.code] ?? { emoji: '⚠️', title: 'Something went wrong', recoverable: false }
  return { ...base, detail: error.message }
}

/** Pull the {status, ApiError} out of an axios error for mapError. */
export function fromAxios(err: unknown): { status: number; error: ApiError | null } {
  const e = err as { response?: { status: number; data?: { error?: ApiError } } }
  if (!e.response) return { status: 0, error: null }
  return { status: e.response.status, error: e.response.data?.error ?? null }
}
```

- [ ] **Step 4: Run — passes**

Run: `npx vitest run src/lib/errorMap.test.ts` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/errorMap.* && git commit -m "{JIRA-TICKET}: Map backend error codes to ATM messages"
git push
```

---

## Task 5: Luhn + idempotency (TDD)

**Files:** Create `src/lib/luhn.ts`, `src/lib/idempotency.ts`. Tests alongside.

- [ ] **Step 1: Failing Luhn test**

`src/lib/luhn.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { isValidCardNumber, normalizeCard } from './luhn'

describe('luhn', () => {
  it('accepts a valid seeded card', () => {
    expect(isValidCardNumber('4539148803436467')).toBe(true)
  })
  it('strips spaces before validating', () => {
    expect(isValidCardNumber('4539 1488 0343 6467')).toBe(true)
  })
  it('rejects wrong length', () => {
    expect(isValidCardNumber('12345')).toBe(false)
  })
  it('rejects a bad checksum', () => {
    expect(isValidCardNumber('4539148803436460')).toBe(false)
  })
  it('normalizes to digits only', () => {
    expect(normalizeCard('4539 1488 0343 6467')).toBe('4539148803436467')
  })
})
```

- [ ] **Step 2: Run — fails.** `npx vitest run src/lib/luhn.test.ts`

- [ ] **Step 3: Implement**

`src/lib/luhn.ts`:
```ts
export const normalizeCard = (input: string): string => input.replace(/\D/g, '')

export function isValidCardNumber(input: string): boolean {
  const digits = normalizeCard(input)
  if (!/^\d{16}$/.test(digits)) return false
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (double) { d *= 2; if (d > 9) d -= 9 }
    sum += d
    double = !double
  }
  return sum % 10 === 0
}
```
`src/lib/idempotency.ts`:
```ts
/** A fresh key for a NEW operation. Reuse the SAME key for retries of that operation. */
export const newIdempotencyKey = (): string => crypto.randomUUID()
```

- [ ] **Step 4: Run — passes.** `npx vitest run src/lib/luhn.test.ts`

- [ ] **Step 5: Commit**
```bash
git add src/lib/luhn.* src/lib/idempotency.ts
git commit -m "{JIRA-TICKET}: Add Luhn card validation and idempotency-key helper"
git push
```

---

## Task 6: Stores (session, cards, locale) — TDD persistence

**Files:** Create `src/stores/sessionStore.ts`, `cardsStore.ts`, `localeStore.ts`. Test `src/stores/cardsStore.test.ts`.

- [ ] **Step 1: locale + session stores**

`src/stores/localeStore.ts`:
```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Locale = 'en' | 'sn'
interface LocaleState { locale: Locale; setLocale: (l: Locale) => void }

export const useLocaleStore = create<LocaleState>()(
  persist((set) => ({ locale: 'en', setLocale: (locale) => set({ locale }) }),
    { name: 'atm-locale' }))
```
`src/stores/sessionStore.ts`:
```ts
import { create } from 'zustand'
import type { AccountSnapshot } from '../api/types'

interface SessionState {
  account: AccountSnapshot | null
  cardNumber: string | null
  startedAt: number | null
  signIn: (account: AccountSnapshot, cardNumber: string) => void
  signOut: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  account: null, cardNumber: null, startedAt: null,
  signIn: (account, cardNumber) => set({ account, cardNumber, startedAt: Date.now() }),
  signOut: () => set({ account: null, cardNumber: null, startedAt: null }),
}))
```

- [ ] **Step 2: Failing cards-store test**

`src/stores/cardsStore.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useCardsStore } from './cardsStore'

beforeEach(() => { localStorage.clear(); useCardsStore.setState({ cards: [] }) })

describe('cardsStore', () => {
  it('saves a card with a label, de-duplicating by number', () => {
    useCardsStore.getState().save('4539148803436467', 'Alice')
    useCardsStore.getState().save('4539148803436467', 'Alice 2')
    expect(useCardsStore.getState().cards).toHaveLength(1)
    expect(useCardsStore.getState().cards[0].label).toBe('Alice 2')
  })
  it('forgets a card', () => {
    useCardsStore.getState().save('4539148803436467', 'Alice')
    useCardsStore.getState().forget('4539148803436467')
    expect(useCardsStore.getState().cards).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Run — fails.** `npx vitest run src/stores/cardsStore.test.ts`

- [ ] **Step 4: Implement cards store**

`src/stores/cardsStore.ts`:
```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SavedCard { cardNumber: string; label: string }
interface CardsState {
  cards: SavedCard[]
  save: (cardNumber: string, label: string) => void
  forget: (cardNumber: string) => void
}

export const useCardsStore = create<CardsState>()(
  persist((set) => ({
    cards: [],
    save: (cardNumber, label) => set((s) => ({
      cards: [...s.cards.filter((c) => c.cardNumber !== cardNumber), { cardNumber, label }],
    })),
    forget: (cardNumber) => set((s) => ({ cards: s.cards.filter((c) => c.cardNumber !== cardNumber) })),
  }), { name: 'atm-cards' }))
```

- [ ] **Step 5: Run — passes.** `npx vitest run src/stores/cardsStore.test.ts`

- [ ] **Step 6: Commit**
```bash
git add src/stores && git commit -m "{JIRA-TICKET}: Add session, saved-cards and locale Zustand stores"
git push
```

---

## Task 7: TanStack Query hooks

**Files:** Create `src/hooks/useCardLookup.ts`, `useBalance.ts`, `useStatement.ts`, `useWithdraw.ts`, `useDeposit.ts`, `useSessionTimeout.ts`.

- [ ] **Step 1: Lookup + balance + statement hooks**

`src/hooks/useCardLookup.ts`:
```ts
import { useMutation } from '@tanstack/react-query'
import { lookupCard } from '../api/atm'

export const useCardLookup = () => useMutation({ mutationFn: (card: string) => lookupCard(card) })
```
`src/hooks/useBalance.ts`:
```ts
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { lookupCard } from '../api/atm'
import type { AccountSnapshot } from '../api/types'

export const balanceKey = (card: string) => ['balance', card] as const

export function useBalance(cardNumber: string | null) {
  return useQuery({
    queryKey: balanceKey(cardNumber ?? ''),
    queryFn: () => lookupCard(cardNumber as string),
    enabled: !!cardNumber,
  })
}
/** After a txn, patch the cached snapshot's balance from the txn's balanceAfter — no refetch. */
export function usePatchBalance() {
  const qc = useQueryClient()
  return (cardNumber: string, balanceAfter: string) =>
    qc.setQueryData<AccountSnapshot>(balanceKey(cardNumber), (prev) =>
      prev ? { ...prev, balance: balanceAfter } : prev)
}
```
`src/hooks/useStatement.ts`:
```ts
import { useQuery } from '@tanstack/react-query'
import { statement } from '../api/atm'

export function useStatement(accountId: string | null, page = 0, size = 10) {
  return useQuery({
    queryKey: ['statement', accountId, page, size],
    queryFn: () => statement(accountId as string, page, size),
    enabled: !!accountId,
  })
}
```

- [ ] **Step 2: Withdraw/deposit mutations (idempotency key created once per operation)**

`src/hooks/useWithdraw.ts`:
```ts
import { useMutation } from '@tanstack/react-query'
import { withdraw } from '../api/atm'
import { newIdempotencyKey } from '../lib/idempotency'
import { usePatchBalance } from './useBalance'
import { useSessionStore } from '../stores/sessionStore'

export function useWithdraw() {
  const patch = usePatchBalance()
  const cardNumber = useSessionStore.getState().cardNumber as string
  // one key per hook instance == one logical operation; React Query retries reuse it
  const idempotencyKey = newIdempotencyKey()
  return useMutation({
    mutationFn: (vars: { accountId: string; amount: string }) =>
      withdraw(vars.accountId, vars.amount, idempotencyKey),
    onSuccess: (tx) => patch(cardNumber, tx.balanceAfter),
  })
}
```
`src/hooks/useDeposit.ts` — identical shape calling `deposit` (repeat, do not alias):
```ts
import { useMutation } from '@tanstack/react-query'
import { deposit } from '../api/atm'
import { newIdempotencyKey } from '../lib/idempotency'
import { usePatchBalance } from './useBalance'
import { useSessionStore } from '../stores/sessionStore'

export function useDeposit() {
  const patch = usePatchBalance()
  const cardNumber = useSessionStore.getState().cardNumber as string
  const idempotencyKey = newIdempotencyKey()
  return useMutation({
    mutationFn: (vars: { accountId: string; amount: string }) =>
      deposit(vars.accountId, vars.amount, idempotencyKey),
    onSuccess: (tx) => patch(cardNumber, tx.balanceAfter),
  })
}
```

- [ ] **Step 3: Session-timeout hook (auto-eject)**

`src/hooks/useSessionTimeout.ts`:
```ts
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../stores/sessionStore'

const IDLE_MS = 60_000

export function useSessionTimeout() {
  const navigate = useNavigate()
  const signOut = useSessionStore((s) => s.signOut)
  useEffect(() => {
    let timer: number
    const reset = () => { window.clearTimeout(timer); timer = window.setTimeout(() => { signOut(); navigate('/') }, IDLE_MS) }
    const events = ['click', 'keydown', 'touchstart'] as const
    events.forEach((e) => window.addEventListener(e, reset))
    reset()
    return () => { window.clearTimeout(timer); events.forEach((e) => window.removeEventListener(e, reset)) }
  }, [navigate, signOut])
}
```

- [ ] **Step 4: Typecheck.** Run: `npx tsc --noEmit` → passes.

- [ ] **Step 5: Commit**
```bash
git add src/hooks && git commit -m "{JIRA-TICKET}: Add Query hooks (lookup/balance/statement/withdraw/deposit/timeout)"
git push
```

---

## Task 8: Telemetry (OTel → LGTM + custom ATM metrics)

**Files:** Create `src/telemetry/index.ts`.

- [ ] **Step 1: Init tracing + metrics + web-vitals + custom counters**

`src/telemetry/index.ts`:
```ts
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-web'
import { ZoneContextManager } from '@opentelemetry/context-zone'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch'
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request'
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load'
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'
import { metrics } from '@opentelemetry/api'
import { onCLS, onINP, onLCP, onTTFB, onFCP } from 'web-vitals'
import { env } from '../config/env'

const resource = resourceFromAttributes({ [ATTR_SERVICE_NAME]: 'fe-bank-withdrawal' })

export function initTelemetry() {
  const tracerProvider = new WebTracerProvider({
    resource,
    spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: `${env.otlpBaseUrl}/v1/traces` }))],
  })
  tracerProvider.register({ contextManager: new ZoneContextManager() })

  const meterProvider = new MeterProvider({
    resource,
    readers: [new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${env.otlpBaseUrl}/v1/metrics` }), exportIntervalMillis: 10_000,
    })],
  })
  metrics.setGlobalMeterProvider(meterProvider)

  registerInstrumentations({
    instrumentations: [new DocumentLoadInstrumentation(), new FetchInstrumentation(), new XMLHttpRequestInstrumentation()],
  })

  const meter = metrics.getMeter('atm')
  const vitals = meter.createHistogram('atm_web_vitals')
  const report = (name: string) => (m: { value: number }) => vitals.record(m.value, { metric: name })
  onCLS(report('CLS')); onINP(report('INP')); onLCP(report('LCP')); onTTFB(report('TTFB')); onFCP(report('FCP'))
}

const meter = () => metrics.getMeter('atm')
export const atmMetrics = {
  sessionStarted: () => meter().createCounter('atm_session_started_total').add(1),
  cardLookup: (result: 'success' | 'not_found' | 'error') =>
    meter().createCounter('atm_card_lookup_total').add(1, { result }),
  balanceInquiry: () => meter().createCounter('atm_balance_inquiry_total').add(1),
  withdrawal: (result: 'success' | 'insufficient_funds' | 'error') =>
    meter().createCounter('atm_withdrawal_total').add(1, { result }),
  deposit: (result: 'success' | 'error') => meter().createCounter('atm_deposit_total').add(1, { result }),
}
```

- [ ] **Step 2: Wire into `main.tsx`**

`src/main.tsx` calls `initTelemetry()` before render and wraps `<App/>` in `QueryClientProvider` + `BrowserRouter`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import './index.css'
import { App } from './App'
import { initTelemetry } from './telemetry'

initTelemetry()
const queryClient = new QueryClient()
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster position="top-center" />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
```

- [ ] **Step 3: Typecheck + dev boot smoke.** Run: `npx tsc --noEmit` then `npm run dev` and confirm no console errors (OTLP export failures are tolerable if LGTM isn't running).

- [ ] **Step 4: Commit**
```bash
git add src/telemetry src/main.tsx && git commit -m "{JIRA-TICKET}: Add OpenTelemetry browser telemetry and custom ATM metrics"
git push
```

---

## Task 9: i18n strings + shared components

**Files:** Create `src/i18n/strings.ts`; components `ScreenFrame`, `Keypad`, `AmountPad`, `Money`, `LanguageToggle`, `DevBanner`, `CardTile`, `RequireSession`.

- [ ] **Step 1: i18n dictionary + hook**

`src/i18n/strings.ts`:
```ts
import { useLocaleStore } from '../stores/localeStore'

const DICT = {
  en: {
    welcome: 'Welcome', insertCard: 'Insert your card', enterPin: 'Enter your PIN',
    balance: 'Balance', withdraw: 'Withdraw', deposit: 'Deposit', statement: 'Mini-statement',
    exit: 'End session', confirm: 'Confirm', cancel: 'Cancel', another: 'Another transaction',
    takeCard: 'Please take your card', amount: 'Amount', yourCards: 'Your cards',
  },
  sn: {
    welcome: 'Mauya', insertCard: 'Isa kadhi rako', enterPin: 'Isa PIN yako',
    balance: 'Mari iripo', withdraw: 'Bvisa mari', deposit: 'Isa mari', statement: 'Chitsauko chemari',
    exit: 'Pedza', confirm: 'Simbisa', cancel: 'Kanzura', another: 'Imwe basa',
    takeCard: 'Tora kadhi rako', amount: 'Mari', yourCards: 'Makadhi ako',
  },
} as const

export type StringKey = keyof typeof DICT['en']
export function useT() {
  const locale = useLocaleStore((s) => s.locale)
  return (key: StringKey) => DICT[locale][key]
}
```
(SN strings are machine-drafted — native review pending, consistent with the backend bundle.)

- [ ] **Step 2: Presentational components**

`src/components/Money.tsx`:
```tsx
import { formatMoney } from '../config/currency'
export function Money({ amount, currency }: { amount: string | number; currency?: string }) {
  return <span className="font-mono tabular-nums">{formatMoney(amount, currency)}</span>
}
```
`src/components/ScreenFrame.tsx` — the ATM bezel wrapper (glass card, title slot, children, optional footer). `src/components/Keypad.tsx` — numeric keypad (`onDigit`, `onBackspace`, `onEnter`) using `.glass` buttons. `src/components/AmountPad.tsx` — quick-cash chips (`QUICK_CASH`) + custom entry feeding a value up. `src/components/CardTile.tsx` — a saved card row (label + masked last-4 + tap handler). `src/components/LanguageToggle.tsx` — EN/SN switch bound to `useLocaleStore`.

Each is small and presentational; example `Keypad.tsx`:
```tsx
export function Keypad({ onDigit, onBackspace, onEnter }: {
  onDigit: (d: string) => void; onBackspace: () => void; onEnter: () => void
}) {
  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫']
  return (
    <div className="grid grid-cols-3 gap-3">
      {keys.map((k, i) => (
        <button key={i} disabled={k === ''}
          className="glass h-16 text-2xl font-display disabled:opacity-0 active:scale-95 transition"
          onClick={() => k === '⌫' ? onBackspace() : k && onDigit(k)}>{k}</button>
      ))}
      <button className="glass col-span-3 h-14 text-accent-cyan font-display" onClick={onEnter}>↵ Enter</button>
    </div>
  )
}
```

- [ ] **Step 3: DevBanner (dev-only, links Grafana/Prometheus/Swagger)**

`src/components/DevBanner.tsx`:
```tsx
import { env } from '../config/env'
import { useSessionStore } from '../stores/sessionStore'

export function DevBanner() {
  const account = useSessionStore((s) => s.account)
  if (!env.isDev) return null
  const link = (href: string, label: string) =>
    <a className="underline hover:text-accent-cyan" href={href} target="_blank" rel="noreferrer">{label}</a>
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-surface-900/90 text-xs px-3 py-1 flex gap-4 font-mono">
      <span>🛠 dev</span>
      {link(env.grafanaUrl, 'Grafana')}{link(env.prometheusUrl, 'Prometheus')}{link(env.swaggerUrl, 'Swagger')}
      {account && <span className="ml-auto">{account.holderName} · {account.maskedCardNumber}</span>}
    </div>
  )
}
```

- [ ] **Step 4: RequireSession guard**

`src/components/RequireSession.tsx`:
```tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useSessionStore } from '../stores/sessionStore'

export function RequireSession() {
  const account = useSessionStore((s) => s.account)
  return account ? <Outlet /> : <Navigate to="/" replace />
}
```

- [ ] **Step 5: Typecheck.** `npx tsc --noEmit` → passes.

- [ ] **Step 6: Commit**
```bash
git add src/i18n src/components && git commit -m "{JIRA-TICKET}: Add i18n dictionary and shared ATM components"
git push
```

---

## Task 10: Screens + router (the state machine)

**Files:** Create the 8 screens, `src/router.tsx`, `src/App.tsx`. Test `src/screens/Withdraw.test.tsx`.

- [ ] **Step 1: Router + App**

`src/router.tsx`:
```tsx
import { Routes, Route } from 'react-router-dom'
import { RequireSession } from './components/RequireSession'
import { Welcome } from './screens/Welcome'
import { Pin } from './screens/Pin'
import { Menu } from './screens/Menu'
import { Balance } from './screens/Balance'
import { Withdraw } from './screens/Withdraw'
import { Deposit } from './screens/Deposit'
import { Statement } from './screens/Statement'
import { Receipt } from './screens/Receipt'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/pin" element={<Pin />} />
      <Route element={<RequireSession />}>
        <Route path="/menu" element={<Menu />} />
        <Route path="/balance" element={<Balance />} />
        <Route path="/withdraw" element={<Withdraw />} />
        <Route path="/deposit" element={<Deposit />} />
        <Route path="/statement" element={<Statement />} />
        <Route path="/receipt" element={<Receipt />} />
      </Route>
    </Routes>
  )
}
```
`src/App.tsx`:
```tsx
import { AppRoutes } from './router'
import { DevBanner } from './components/DevBanner'
import { LanguageToggle } from './components/LanguageToggle'

export function App() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="absolute top-3 right-3"><LanguageToggle /></div>
      <main className="w-full max-w-md"><AppRoutes /></main>
      <DevBanner />
    </div>
  )
}
```

- [ ] **Step 2: Welcome — card entry + saved cards + lookup**

`src/screens/Welcome.tsx`:
```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ScreenFrame } from '../components/ScreenFrame'
import { CardTile } from '../components/CardTile'
import { useCardLookup } from '../hooks/useCardLookup'
import { isValidCardNumber, normalizeCard } from '../lib/luhn'
import { fromAxios, mapError } from '../lib/errorMap'
import { useSessionStore } from '../stores/sessionStore'
import { useCardsStore } from '../stores/cardsStore'
import { atmMetrics } from '../telemetry'
import { useT } from '../i18n/strings'

export function Welcome() {
  const t = useT()
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const lookup = useCardLookup()
  const signIn = useSessionStore((s) => s.signIn)
  const cards = useCardsStore((s) => s.cards)

  async function insert(cardRaw: string) {
    const card = normalizeCard(cardRaw)
    if (!isValidCardNumber(card)) { toast.error('💳 Invalid card number'); return }
    try {
      const account = await lookup.mutateAsync(card)
      atmMetrics.cardLookup('success')
      signIn(account, card)
      navigate('/pin')
    } catch (err) {
      const { status, error } = fromAxios(err)
      atmMetrics.cardLookup(status === 404 ? 'not_found' : 'error')
      const m = mapError(status, error)
      toast.error(`${m.emoji} ${m.title}`)
    }
  }

  return (
    <ScreenFrame title={`🏧 ${t('welcome')}`}>
      <p className="text-slate-400 mb-3">{t('insertCard')}</p>
      <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="numeric"
        placeholder="#### #### #### ####"
        className="glass w-full p-4 font-mono text-lg tracking-widest mb-3" />
      <button className="glass w-full p-4 text-accent-cyan font-display mb-4"
        disabled={lookup.isPending} onClick={() => insert(value)}>💳 Insert card</button>
      {cards.length > 0 && <p className="text-slate-400 text-sm mb-2">{t('yourCards')}</p>}
      <div className="space-y-2">
        {cards.map((c) => <CardTile key={c.cardNumber} card={c} onSelect={() => insert(c.cardNumber)} />)}
      </div>
    </ScreenFrame>
  )
}
```

- [ ] **Step 3: Pin — cosmetic keypad → menu (offers to save card)**

`src/screens/Pin.tsx`: render `Keypad`, accumulate up to 4 digits; on 4th + Enter, `atmMetrics.sessionStarted()`, optionally prompt to save the card (`useCardsStore.save(cardNumber, label)`), `navigate('/menu')`. Guard: if no `cardNumber` in session, `Navigate to="/"`.

- [ ] **Step 4: Menu — the five actions**

`src/screens/Menu.tsx`: buttons routing to `/balance`, `/withdraw`, `/deposit`, `/statement`, and `Exit` → `signOut()` + `navigate('/')`. Calls `useSessionTimeout()`.

- [ ] **Step 5: Balance**

`src/screens/Balance.tsx`: `const { account } = useSessionStore(); useBalance(cardNumber)`; on mount `atmMetrics.balanceInquiry()`; show `<Money amount={data.balance} currency={data.currency} />`, holder name, masked card; buttons back to menu / withdraw.

- [ ] **Step 6: Withdraw (TDD this one)**

First the failing test, `src/screens/Withdraw.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { Withdraw } from './Withdraw'
import { useSessionStore } from '../stores/sessionStore'
import * as atm from '../api/atm'

function renderWithdraw() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}><MemoryRouter><Withdraw /></MemoryRouter></QueryClientProvider>)
}

beforeEach(() => {
  useSessionStore.setState({
    account: { accountId: 'acc-1', holderName: 'Alice', maskedCardNumber: '•••• 6467', balance: '1000.00', currency: 'EUR' },
    cardNumber: '4539148803436467', startedAt: Date.now(),
  })
})

describe('Withdraw', () => {
  it('posts the chosen amount with an idempotency key and routes to the receipt', async () => {
    const spy = vi.spyOn(atm, 'withdraw').mockResolvedValue({
      transactionId: 'tx-1', accountId: 'acc-1', type: 'DEBIT', amount: '50', balanceAfter: '950.00', occurredAt: '2026-06-08T10:00:00Z',
    })
    renderWithdraw()
    await userEvent.click(screen.getByRole('button', { name: /50/ }))
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() => expect(spy).toHaveBeenCalledWith('acc-1', '50', expect.any(String)))
  })
})
```
Run: `npx vitest run src/screens/Withdraw.test.tsx` → FAIL.

Then implement `src/screens/Withdraw.tsx`:
```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ScreenFrame } from '../components/ScreenFrame'
import { AmountPad } from '../components/AmountPad'
import { useWithdraw } from '../hooks/useWithdraw'
import { useSessionStore } from '../stores/sessionStore'
import { fromAxios, mapError } from '../lib/errorMap'
import { atmMetrics } from '../telemetry'
import { useT } from '../i18n/strings'

export function Withdraw() {
  const t = useT()
  const navigate = useNavigate()
  const account = useSessionStore((s) => s.account)!
  const [amount, setAmount] = useState<string>('')
  const withdraw = useWithdraw()   // creates one idempotency key for this screen instance

  async function confirm() {
    if (!amount || Number(amount) <= 0) { toast.error('✋ Enter an amount'); return }
    try {
      const tx = await withdraw.mutateAsync({ accountId: account.accountId, amount })
      atmMetrics.withdrawal('success')
      navigate('/receipt', { state: { tx, kind: 'withdraw' } })
    } catch (err) {
      const { status, error } = fromAxios(err)
      atmMetrics.withdrawal(status === 422 ? 'insufficient_funds' : 'error')
      const m = mapError(status, error)
      toast.error(`${m.emoji} ${m.title} — ${m.detail}`)
    }
  }

  return (
    <ScreenFrame title={`💰 ${t('withdraw')}`}>
      <AmountPad value={amount} onChange={setAmount} />
      <button className="glass w-full p-4 mt-4 text-accent-cyan font-display"
        disabled={withdraw.isPending} onClick={confirm}>{t('confirm')}</button>
      <button className="w-full p-3 mt-2 text-slate-400" onClick={() => navigate('/menu')}>{t('cancel')}</button>
    </ScreenFrame>
  )
}
```
Run: `npx vitest run src/screens/Withdraw.test.tsx` → PASS.

- [ ] **Step 7: Deposit** — same structure as Withdraw calling `useDeposit()`, title `🏧 deposit`, `atmMetrics.deposit(...)`, routes to `/receipt` with `kind:'deposit'`. (Repeat the Withdraw code with deposit substitutions — do not import Withdraw.)

- [ ] **Step 8: Statement** — `useStatement(account.accountId, page)`; render each `Transaction` row: emoji by type (`DEBIT`→`💸`, `CREDIT`→`💵`), `<Money>` amount, date via `Intl.DateTimeFormat`, `balanceAfter`. "More" button increments `page` while `page.number+1 < page.totalPages`. Empty → "🧾 No transactions yet".

- [ ] **Step 9: Receipt** — read `useLocation().state.{tx,kind}`; show ✅ + amount + new balance (`tx.balanceAfter`) + `transactionId` + time; buttons `another` → `/menu`, `exit` → `signOut()` + `/` with a `takeCard` toast.

- [ ] **Step 10: Full unit run + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all unit tests pass, no type errors.

- [ ] **Step 11: Commit**
```bash
git add src/screens src/router.tsx src/App.tsx
git commit -m "{JIRA-TICKET}: Add ATM screens, router and session guard (state machine)"
git push
```

---

## Task 11: Grafana dashboard + README + observability docs

**Files:** Create `observability/grafana/atm-frontend-dashboard.json`, `README.md`.

- [ ] **Step 1: Grafana dashboard JSON**

Create `observability/grafana/atm-frontend-dashboard.json` — a Grafana dashboard with panels querying the custom metrics (Prometheus datasource): `rate(atm_session_started_total[5m])`, `sum by (result)(rate(atm_withdrawal_total[5m]))`, `sum by (result)(rate(atm_card_lookup_total[5m]))`, `atm_deposit_total`, and a web-vitals histogram panel (`histogram_quantile(0.95, sum by (le,metric)(rate(atm_web_vitals_bucket[5m])))`). Use a minimal valid dashboard schema (`{ "title": "ATM Frontend", "panels": [...], "schemaVersion": 39, "templating": {"list": []}, "time": {"from":"now-1h","to":"now"} }`).

- [ ] **Step 2: README (run instructions, 12-factor config table, observability)**

`README.md` covers: prerequisites (Node, the running `bank-withdrawal` backend + `docker compose up` for DB+LGTM); `cp .env.example .env`; `npm install`; `npm run dev` (proxy to :8080); the config table (every `VITE_*` var, default, meaning) and the precedence note; how telemetry flows to LGTM; how to import the Grafana dashboard; the seeded demo cards (`4539 1488 0343 6467` Alice, `6011 0009 9013 9424` Bob) and that the dev banner prints live ones; PIN is cosmetic; EN/SN toggle.

- [ ] **Step 3: Commit**
```bash
git add observability README.md && git commit -m "{JIRA-TICKET}: Add Grafana ATM dashboard and README with 12-factor config + observability"
git push
```

---

## Task 12: Playwright E2E (mocked) + live smoke

**Files:** Create `playwright.config.ts`, `e2e/atm.spec.ts`, `e2e/live-smoke.spec.ts`.

- [ ] **Step 1: Playwright config**

`playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true },
  use: { baseURL: 'http://localhost:5173' },
})
```

- [ ] **Step 2: Mocked happy-path E2E (deterministic — routes intercepted)**

`e2e/atm.spec.ts`: `page.route('**/api/v1/cards/*', ...)` returns a card snapshot; `page.route('**/withdrawals', ...)` returns a transaction. Drive: visit `/`, type the card, click Insert, enter 4 PIN digits + Enter, click Withdraw, pick €50, Confirm, assert the Receipt shows ✅ and the new balance.

- [ ] **Step 3: Run mocked E2E**

Run: `npx playwright install --with-deps && npx playwright test e2e/atm.spec.ts`
Expected: PASS.

- [ ] **Step 4: Live smoke (opt-in; backend must be up with the card endpoint)**

`e2e/live-smoke.spec.ts` (tagged `@live`): no route mocks; use a seeded card (`4539148803436467`); do a balance inquiry and a small deposit; assert success. Document that it needs `bank-withdrawal` running with Plan A merged. Skip by default in CI.

- [ ] **Step 5: Commit**
```bash
git add playwright.config.ts e2e && git commit -m "{JIRA-TICKET}: Add Playwright mocked E2E and live smoke for the ATM flow"
git push
```

---

## Task 13: package scripts, lint/typecheck gate, final build

**Files:** Modify `package.json`.

- [ ] **Step 1: Scripts**

Ensure `package.json` scripts include:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Full gate**

Run: `npm run typecheck && npm run test && npm run build`
Expected: all green; `dist/` produced.

- [ ] **Step 3: Final commit + push**
```bash
git add package.json && git commit -m "{JIRA-TICKET}: Add scripts and finalize build gate"
git push
```

---

## Self-Review (completed by author)

- **Spec coverage:** state-machine + router + guard ✓ (T10); structure/stack ✓ (T1); data flow incl. idempotency-reuse + balance patch ✓ (T3,T7); error-code mapping ✓ (T4,T10); observability OTel+custom metrics+DevBanner+dashboard ✓ (T8,T9,T11); EN/SN i18n + `Accept-Language` ✓ (T3,T9); card model UUID-free, friendly number + saved cards + cosmetic PIN ✓ (T5,T6,T10); 12-factor env ✓ (T1,T2,T11); TDD units + Playwright ✓ (T2,T4,T5,T6,T10,T12). Non-goals respected (no auth/WS/passkeys).
- **Placeholder scan:** logic-bearing modules have full code. Purely-presentational components (ScreenFrame/AmountPad/CardTile/LanguageToggle) and the lighter screens (Pin/Menu/Balance/Deposit/Statement/Receipt) are specified with exact props, behavior, routes, metric calls and an exemplar (Keypad/Welcome/Withdraw shown in full) — each is a small, single-responsibility file following the shown pattern. Repeat the exemplar's structure per screen; do not alias one screen from another.
- **Type consistency:** `AccountSnapshot`, `Transaction`, `ApiResponse`/`ApiError`, `mapError`/`fromAxios`, `isValidCardNumber`/`normalizeCard`, `newIdempotencyKey`, `useSessionStore.signIn/signOut`, `useCardsStore.save/forget`, `useBalance`/`usePatchBalance`/`balanceKey`, `atmMetrics.*`, `useT()` used consistently across tasks.
- **Cross-plan dependency:** all endpoint paths/shapes match Plan A's contract (card lookup, withdraw/deposit idempotency header, statement `PagedModel`).
```
