# UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Frontend-only UX overhaul: statement Prev/Next pagination, prominent Withdraw balance card, persistent app bar (Back/title/Exit) replacing in-body Cancel buttons, session-timeout warning, unaffordable quick-cash disabling, and visible focus rings.

**Architecture:** All changes live in `fe-bank-withdrawal` (React 19 + Vite + Tailwind 4 + TanStack Query + Zustand). New components (`AppBar`, `Pager`, `BalanceCard`, `SessionTimeoutDialog`) compose into the existing `AuthenticatedLayout`/`ScreenFrame` structure; the backend already returns full `PagedModel` page metadata, so no backend work. Spec: `docs/superpowers/specs/2026-06-11-ux-improvements-design.md`.

**Tech Stack:** TypeScript strict, Vitest + Testing Library, Playwright, Tailwind 4 theme tokens (`--color-accent-cyan`, `.glass`), FE i18n catalogue `src/i18n/strings.ts` (en/sn).

**Working branch:** `JIRA-000-feat-ux-improvements` (already cut from `dev`; spec committed).

**Conventions for every commit:** title prefixed `JIRA-000`, no `Co-Authored-By` trailers. Gates that must stay green: `npm run lint` (zero warnings), `npm run typecheck` (`tsc -b`), `npm run test`.

---

### Task 1: i18n keys + navTitles config

New FE-owned strings (en + sn drafts) and the route→title map the AppBar will use. The `cancel` key is NOT removed here — screens still use it until Task 8.

**Files:**
- Modify: `src/i18n/strings.ts`
- Create: `src/config/navTitles.ts`
- Test: `src/config/navTitles.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/config/navTitles.test.ts`:

```tsx
import { describe, it, expect } from 'vitest'
import { navTitle } from './navTitles'

describe('navTitle', () => {
  it('maps each authenticated route to an emoji + i18n key', () => {
    expect(navTitle('/menu')).toEqual({ emoji: '🏦', key: 'menu' })
    expect(navTitle('/balance')).toEqual({ emoji: '💰', key: 'balance' })
    expect(navTitle('/withdraw')).toEqual({ emoji: '💸', key: 'withdraw' })
    expect(navTitle('/deposit')).toEqual({ emoji: '🏧', key: 'deposit' })
    expect(navTitle('/statement')).toEqual({ emoji: '🧾', key: 'statement' })
    expect(navTitle('/receipt')).toEqual({ emoji: '✅', key: 'receipt' })
  })

  it('falls back to the menu title for unknown paths', () => {
    expect(navTitle('/nope')).toEqual({ emoji: '🏦', key: 'menu' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- navTitles`
Expected: FAIL — `Cannot find module './navTitles'` (or equivalent resolve error).

- [ ] **Step 3: Add the new i18n keys**

In `src/i18n/strings.ts`, inside the `en` object, after the line
`takeCard: 'Please take your card', amount: 'Amount', yourCards: 'Your cards',` add:

```ts
    // Navigation / app bar
    back: 'Back', menu: 'Menu', receipt: 'Receipt',
    // Withdraw balance card + quick-cash guard
    available: 'Available', overBalance: 'Over balance',
    // Statement pager
    pageOf: 'Page {x} of {y}', prev: 'Prev', next: 'Next',
    // Session-timeout warning
    timeoutTitle: 'Still there?', timeoutBody: 'Session ends in', continue: 'Continue',
```

Inside the `sn` object, after the line
`takeCard: 'Tora kadhi rako', amount: 'Mari', yourCards: 'Makadhi ako',` add:

```ts
    // Navigation / app bar — TODO(sn): review translation
    back: 'Dzokera', menu: 'Menyu', receipt: 'Risiti',
    // Withdraw balance card + quick-cash guard — TODO(sn): review translation
    available: 'Mari inowanikwa', overBalance: 'Inopfuura mari iripo',
    // Statement pager — TODO(sn): review translation
    pageOf: 'Peji {x} pa {y}', prev: 'Shure', next: 'Mberi',
    // Session-timeout warning — TODO(sn): review translation
    timeoutTitle: 'Uchiripo here?', timeoutBody: 'Basa rinopera mu', continue: 'Enderera',
```

(The `DICT` `as const` typing makes `tsc` fail if en/sn key sets diverge — that is the catalogue-parity guard.)

- [ ] **Step 4: Create the navTitles config**

Create `src/config/navTitles.ts`:

```ts
import type { StringKey } from '../i18n/strings'

export type NavTitle = { emoji: string; key: StringKey }

/** Route → app-bar title. Emojis follow the Menu screen's action icons. */
const TITLES: Record<string, NavTitle> = {
  '/menu': { emoji: '🏦', key: 'menu' },
  '/balance': { emoji: '💰', key: 'balance' },
  '/withdraw': { emoji: '💸', key: 'withdraw' },
  '/deposit': { emoji: '🏧', key: 'deposit' },
  '/statement': { emoji: '🧾', key: 'statement' },
  '/receipt': { emoji: '✅', key: 'receipt' },
}

export function navTitle(pathname: string): NavTitle {
  return TITLES[pathname] ?? TITLES['/menu']
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- navTitles` → PASS. Then `npm run typecheck` → clean.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/strings.ts src/config/navTitles.ts src/config/navTitles.test.ts
git commit -m "JIRA-000 Add navigation i18n keys and route-title map

- strings.ts: back/menu/receipt/available/overBalance/pageOf/prev/next/timeout*/continue (en + sn drafts)
- navTitles.ts: route -> emoji + StringKey map with menu fallback, unit-tested"
```

---

### Task 2: Pager component

`◀ Prev · Page X of Y · Next ▶` with bound-disabled buttons.

**Files:**
- Create: `src/components/Pager.tsx`
- Test: `src/components/Pager.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/Pager.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Pager } from './Pager'

describe('Pager', () => {
  it('shows a 1-based "Page X of Y" position', () => {
    render(<Pager page={0} totalPages={7} onPage={() => {}} />)
    expect(screen.getByText('Page 1 of 7')).toBeInTheDocument()
  })

  it('disables Prev on the first page and Next on the last', () => {
    const { rerender } = render(<Pager page={0} totalPages={3} onPage={() => {}} />)
    expect(screen.getByRole('button', { name: /prev/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()
    rerender(<Pager page={2} totalPages={3} onPage={() => {}} />)
    expect(screen.getByRole('button', { name: /prev/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('reports the target page via onPage', async () => {
    const onPage = vi.fn()
    render(<Pager page={1} totalPages={3} onPage={onPage} />)
    await userEvent.click(screen.getByRole('button', { name: /prev/i }))
    expect(onPage).toHaveBeenCalledWith(0)
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(onPage).toHaveBeenCalledWith(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- Pager`
Expected: FAIL — cannot resolve `./Pager`.

- [ ] **Step 3: Implement the component**

Create `src/components/Pager.tsx`:

```tsx
import { useT } from '../i18n/strings'

export function Pager({
  page,
  totalPages,
  onPage,
}: {
  page: number
  totalPages: number
  onPage: (page: number) => void
}) {
  const t = useT()
  const label = t('pageOf')
    .replace('{x}', String(page + 1))
    .replace('{y}', String(totalPages))
  return (
    <div className="flex items-center justify-between gap-3 mt-4">
      <button
        type="button"
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
        className="glass p-4 font-display active:scale-95 transition disabled:opacity-40"
      >
        ◀ {t('prev')}
      </button>
      <span className="text-slate-400 text-sm whitespace-nowrap">{label}</span>
      <button
        type="button"
        disabled={page + 1 >= totalPages}
        onClick={() => onPage(page + 1)}
        className="glass p-4 font-display active:scale-95 transition disabled:opacity-40"
      >
        {t('next')} ▶
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- Pager` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Pager.tsx src/components/Pager.test.tsx
git commit -m "JIRA-000 Add Pager component (Prev/Next with Page X of Y)"
```

---

### Task 3: Statement uses Pager + keepPreviousData

Replace the More/Cancel button pair; flip pages without a loading flash.

**Files:**
- Modify: `src/screens/Statement.tsx`
- Modify: `src/hooks/useStatement.ts`
- Test: `src/screens/Statement.test.tsx` (new)

- [ ] **Step 1: Write the failing test**

Create `src/screens/Statement.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { Statement } from './Statement'
import { useSessionStore } from '../stores/sessionStore'
import * as atm from '../api/atm'
import type { Transaction } from '../api/types'

function tx(id: string): Transaction {
  return {
    transactionId: id,
    accountId: 'acc-1',
    type: 'DEBIT',
    amount: '50',
    balanceAfter: '950.00',
    occurredAt: '2026-06-08T10:00:00Z',
  }
}

function pageOf(ids: string[], number: number, totalPages: number) {
  return {
    content: ids.map(tx),
    page: { size: 10, number, totalElements: totalPages * 10, totalPages },
  }
}

function renderStatement() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Statement />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
  useSessionStore.setState({
    account: {
      accountId: 'acc-1',
      holderName: 'Alice',
      maskedCardNumber: '•••• 6467',
      balance: '1000.00',
      currency: 'EUR',
    },
    cardNumber: '4539148803436467',
    startedAt: Date.now(),
  })
})

describe('Statement pagination', () => {
  it('shows the position and disables Prev on the first page', async () => {
    vi.spyOn(atm, 'statement').mockResolvedValue(pageOf(['t1', 't2'], 0, 7))
    renderStatement()
    expect(await screen.findByText('Page 1 of 7')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /prev/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()
  })

  it('fetches the next page when Next is clicked', async () => {
    const spy = vi
      .spyOn(atm, 'statement')
      .mockResolvedValueOnce(pageOf(['t1'], 0, 2))
      .mockResolvedValueOnce(pageOf(['t2'], 1, 2))
    renderStatement()
    await screen.findByText('Page 1 of 2')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => expect(spy).toHaveBeenLastCalledWith('acc-1', 1, 10))
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('hides the pager when everything fits on one page', async () => {
    vi.spyOn(atm, 'statement').mockResolvedValue(pageOf(['t1'], 0, 1))
    renderStatement()
    await screen.findByText(/Jun/)
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- Statement`
Expected: FAIL — no "Page 1 of 7" text; "More ▼" button still rendered.

- [ ] **Step 3: Add keepPreviousData to the statement query**

Replace the full contents of `src/hooks/useStatement.ts`:

```ts
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { statement } from '../api/atm'

export function useStatement(accountId: string | null, page = 0, size = 10) {
  return useQuery({
    queryKey: ['statement', accountId, page, size],
    queryFn: () => statement(accountId as string, page, size),
    enabled: !!accountId,
    // Keep showing the current page while the next one loads — no flash on page flips.
    placeholderData: keepPreviousData,
  })
}
```

- [ ] **Step 4: Rewrite the Statement screen**

Replace the full contents of `src/screens/Statement.tsx` (the `Row` component and `dateFmt` stay as-is; only imports and the `Statement` function change — `useNavigate` is no longer used):

```tsx
import { useState } from 'react'
import { ScreenFrame } from '../components/ScreenFrame'
import { Money } from '../components/Money'
import { Pager } from '../components/Pager'
import { useStatement } from '../hooks/useStatement'
import { useSessionStore } from '../stores/sessionStore'
import type { Transaction } from '../api/types'
import { useT } from '../i18n/strings'

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function Row({ tx, currency }: { tx: Transaction; currency: string }) {
  const emoji = tx.type === 'DEBIT' ? '💸' : '💵'
  return (
    <li className="glass p-3 flex items-center justify-between text-sm">
      <span className="flex items-center gap-2">
        <span className="text-lg">{emoji}</span>
        <span className="text-slate-400">{dateFmt.format(new Date(tx.occurredAt))}</span>
      </span>
      <span className="text-right">
        <span className={tx.type === 'DEBIT' ? 'text-rose-300' : 'text-emerald-300'}>
          {tx.type === 'DEBIT' ? '−' : '+'}
          <Money amount={tx.amount} currency={currency} />
        </span>
        <span className="block text-slate-500 font-mono text-xs">
          <Money amount={tx.balanceAfter} currency={currency} />
        </span>
      </span>
    </li>
  )
}

export function Statement() {
  const t = useT()
  const account = useSessionStore((s) => s.account)
  const currency = account?.currency ?? 'EUR'
  const [page, setPage] = useState(0)
  const { data, isLoading } = useStatement(account?.accountId ?? null, page)

  const rows = data?.content ?? []
  const totalPages = data?.page.totalPages ?? 0

  return (
    <ScreenFrame title={`🧾 ${t('statement')}`}>
      {isLoading && rows.length === 0 ? (
        <p className="text-slate-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-400 text-center py-6">🧾 No transactions yet</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((tx) => (
            <Row key={tx.transactionId} tx={tx} currency={currency} />
          ))}
        </ul>
      )}
      {totalPages > 1 && <Pager page={page} totalPages={totalPages} onPage={setPage} />}
    </ScreenFrame>
  )
}
```

(The `title` prop is removed later, in Task 8, together with all other screens.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -- Statement` → PASS. Run `npm run typecheck` → clean.

- [ ] **Step 6: Commit**

```bash
git add src/screens/Statement.tsx src/screens/Statement.test.tsx src/hooks/useStatement.ts
git commit -m "JIRA-000 Replace Statement More-button with Prev/Next pager

- Pager with 1-based 'Page X of Y' replaces the replace-in-place More button
- keepPreviousData placeholder avoids a loading flash on page flips
- Pager hidden when a single page holds everything"
```

---

### Task 4: BalanceCard component

**Files:**
- Create: `src/components/BalanceCard.tsx`
- Test: `src/components/BalanceCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/BalanceCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BalanceCard } from './BalanceCard'

describe('BalanceCard', () => {
  it('shows the Available label and the formatted amount', () => {
    render(<BalanceCard amount="1250.00" currency="EUR" />)
    expect(screen.getByText(/available/i)).toBeInTheDocument()
    expect(screen.getByText('€1,250.00')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- BalanceCard`
Expected: FAIL — cannot resolve `./BalanceCard`.

- [ ] **Step 3: Implement the component**

Create `src/components/BalanceCard.tsx`:

```tsx
import { Money } from './Money'
import { useT } from '../i18n/strings'

/** Prominent available-balance banner for transaction screens. */
export function BalanceCard({ amount, currency }: { amount: string; currency?: string }) {
  const t = useT()
  return (
    <div className="glass !border-accent-cyan/40 bg-accent-cyan/10 flex items-baseline justify-between px-4 py-3 mb-4">
      <span className="text-accent-cyan text-xs uppercase tracking-widest">{t('available')}</span>
      <span className="font-display text-xl text-accent-cyan">
        <Money amount={amount} currency={currency} />
      </span>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- BalanceCard` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/BalanceCard.tsx src/components/BalanceCard.test.tsx
git commit -m "JIRA-000 Add BalanceCard banner component"
```

---

### Task 5: AmountPad `max` prop — disable unaffordable quick-cash

**Files:**
- Modify: `src/components/AmountPad.tsx`
- Test: `src/components/AmountPad.test.tsx` (new)

- [ ] **Step 1: Write the failing test**

Create `src/components/AmountPad.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AmountPad } from './AmountPad'

describe('AmountPad max', () => {
  it('disables quick-cash chips above max with an over-balance hint', () => {
    render(<AmountPad value="" onChange={() => {}} max={60} />)
    expect(screen.getByRole('button', { name: /20/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /50/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /100/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /200/ })).toBeDisabled()
    expect(screen.getAllByText(/over balance/i)).toHaveLength(2)
  })

  it('keeps every chip enabled when max is not given', () => {
    render(<AmountPad value="" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /200/ })).toBeEnabled()
    expect(screen.queryByText(/over balance/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- AmountPad`
Expected: FAIL — €100/€200 chips are enabled; no over-balance hint.

- [ ] **Step 3: Implement the prop**

Replace the full contents of `src/components/AmountPad.tsx`:

```tsx
import { QUICK_CASH } from '../config/quickCash'
import { Money } from './Money'
import { useT } from '../i18n/strings'

/** Keep only digits and a single decimal point with at most 2 fraction digits. */
function sanitizeAmount(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot === -1) return cleaned
  const intPart = cleaned.slice(0, firstDot)
  const fracPart = cleaned.slice(firstDot + 1).replace(/\./g, '').slice(0, 2)
  return `${intPart}.${fracPart}`
}

export function AmountPad({
  value,
  onChange,
  currency = 'EUR',
  max,
}: {
  value: string
  onChange: (next: string) => void
  currency?: string
  /** When set, quick-cash chips above this amount are disabled (error prevention). */
  max?: number
}) {
  const t = useT()
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {QUICK_CASH.map((amt) => {
          const selected = value === String(amt)
          const over = max !== undefined && amt > max
          return (
            <button
              key={amt}
              type="button"
              aria-pressed={selected}
              disabled={over}
              aria-disabled={over}
              onClick={() => onChange(String(amt))}
              className={`glass h-16 font-display text-xl active:scale-95 transition disabled:opacity-40 disabled:active:scale-100 ${
                selected ? 'ring-2 ring-accent-cyan text-accent-cyan' : ''
              }`}
            >
              <Money amount={amt} currency={currency} />
              {over && <span className="block text-xs text-rose-300 font-sans">{t('overBalance')}</span>}
            </button>
          )
        })}
      </div>
      <label className="block">
        <span className="text-slate-400 text-sm">Custom amount</span>
        <input
          value={value}
          inputMode="decimal"
          placeholder="0.00"
          onChange={(e) => onChange(sanitizeAmount(e.target.value))}
          className="glass w-full p-4 mt-1 font-mono text-lg tabular-nums"
        />
      </label>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- AmountPad` → PASS. Run `npm run test` (full) — the existing Withdraw tests must still pass (they don't pass `max` yet).

- [ ] **Step 5: Commit**

```bash
git add src/components/AmountPad.tsx src/components/AmountPad.test.tsx
git commit -m "JIRA-000 Disable unaffordable quick-cash chips via AmountPad max prop"
```

---

### Task 6: Withdraw screen — BalanceCard + max, drop caption and Cancel

**Files:**
- Modify: `src/screens/Withdraw.tsx`
- Modify: `src/screens/Withdraw.test.tsx`

- [ ] **Step 1: Update the tests first**

In `src/screens/Withdraw.test.tsx`, replace the two balance-label tests:

```tsx
  it('shows the available balance so the user need not cancel to check it', () => {
    renderWithdraw()
    expect(screen.getByText(/Balance/i)).toBeInTheDocument()
    expect(screen.getByText('€1,000.00')).toBeInTheDocument()
  })
```

becomes:

```tsx
  it('shows the available balance prominently and has no Cancel button', () => {
    renderWithdraw()
    expect(screen.getByText(/Available/i)).toBeInTheDocument()
    expect(screen.getByText('€1,000.00')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
  })

  it('disables quick-cash chips above the session balance', () => {
    useSessionStore.setState({
      account: {
        accountId: 'acc-1',
        holderName: 'Alice',
        maskedCardNumber: '•••• 6467',
        balance: '60.00',
        currency: 'EUR',
      },
      cardNumber: '4539148803436467',
      startedAt: Date.now(),
    })
    renderWithdraw()
    expect(screen.getByRole('button', { name: /50/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /100/ })).toBeDisabled()
  })
```

and the Shona test:

```tsx
    it('shows the balance label in Shona when locale is sn', () => {
      useLocaleStore.setState({ locale: 'sn' })
      renderWithdraw()
      expect(screen.getByText(/Mari iripo/)).toBeInTheDocument()
      expect(screen.getByText('€1,000.00')).toBeInTheDocument()
    })
```

becomes:

```tsx
    it('shows the available-balance label in Shona when locale is sn', () => {
      useLocaleStore.setState({ locale: 'sn' })
      renderWithdraw()
      expect(screen.getByText(/Mari inowanikwa/)).toBeInTheDocument()
      expect(screen.getByText('€1,000.00')).toBeInTheDocument()
    })
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm run test -- Withdraw`
Expected: FAIL — `/Available/i` not found; €100 chip enabled; Cancel button present.

- [ ] **Step 3: Update the screen**

In `src/screens/Withdraw.tsx`:

Add the import:

```tsx
import { BalanceCard } from '../components/BalanceCard'
```

Replace the return block (everything inside `<ScreenFrame …>`):

```tsx
  return (
    <ScreenFrame title={`💰 ${t('withdraw')}`}>
      <BalanceCard amount={account.balance} currency={account.currency} />
      <AmountPad
        value={amount}
        onChange={setAmount}
        currency={account.currency}
        max={Number(account.balance)}
      />
      <button
        type="button"
        className="glass w-full p-4 mt-4 text-accent-cyan font-display active:scale-95 transition disabled:opacity-50"
        disabled={withdraw.isPending}
        onClick={confirm}
      >
        {t('confirm')}
      </button>
    </ScreenFrame>
  )
```

This removes the `<p>` balance caption, the Cancel button, and the now-unused `Money` import and `navigate` usage **for the Cancel path only** — `navigate` is still used in `confirm()` for the receipt redirect, so keep `useNavigate`. Remove the `import { Money } from '../components/Money'` line.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- Withdraw` → PASS (all, including the idempotency tests). `npm run lint` → clean (no unused imports).

- [ ] **Step 5: Commit**

```bash
git add src/screens/Withdraw.tsx src/screens/Withdraw.test.tsx
git commit -m "JIRA-000 Show prominent BalanceCard on Withdraw and disable unaffordable chips

- BalanceCard above the amount pad replaces the subtle grey caption
- AmountPad max wired to the session balance
- In-body Cancel removed (app bar Back takes over in a follow-up task)"
```

---

### Task 7: AppBar component

**Files:**
- Create: `src/components/AppBar.tsx`
- Test: `src/components/AppBar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/AppBar.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AppBar } from './AppBar'
import { useSessionStore } from '../stores/sessionStore'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>welcome-screen</p>} />
        <Route path="/menu" element={<><AppBar /><p>menu-screen</p></>} />
        <Route path="/withdraw" element={<><AppBar /><p>withdraw-screen</p></>} />
        <Route path="/receipt" element={<><AppBar /><p>receipt-screen</p></>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useSessionStore.setState({
    account: {
      accountId: 'acc-1',
      holderName: 'Alice',
      maskedCardNumber: '•••• 6467',
      balance: '1000.00',
      currency: 'EUR',
    },
    cardNumber: '4539148803436467',
    startedAt: Date.now(),
  })
})

describe('AppBar', () => {
  it('shows the route title', () => {
    renderAt('/withdraw')
    expect(screen.getByRole('heading', { name: /withdraw/i })).toBeInTheDocument()
  })

  it('hides Back on the menu (root) and on the receipt (transaction final)', () => {
    renderAt('/menu')
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
  })

  it('hides Back on the receipt', () => {
    renderAt('/receipt')
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
  })

  it('Back returns to the menu', async () => {
    renderAt('/withdraw')
    await userEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByText('menu-screen')).toBeInTheDocument()
  })

  it('Exit signs out and returns to Welcome', async () => {
    renderAt('/withdraw')
    await userEvent.click(screen.getByRole('button', { name: /end session/i }))
    expect(screen.getByText('welcome-screen')).toBeInTheDocument()
    expect(useSessionStore.getState().account).toBeNull()
  })
})
```

(`signOut()` in `src/stores/sessionStore.ts:23` sets `account: null`, so `toBeNull()` is the right assertion.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- AppBar`
Expected: FAIL — cannot resolve `./AppBar`.

- [ ] **Step 3: Implement the component**

Create `src/components/AppBar.tsx`:

```tsx
import { useLocation, useNavigate } from 'react-router-dom'
import { useSessionStore } from '../stores/sessionStore'
import { navTitle } from '../config/navTitles'
import { useT } from '../i18n/strings'

/** Screens where Back makes no sense: menu is the root; a receipt is final. */
const NO_BACK = ['/menu', '/receipt']

export function AppBar() {
  const t = useT()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const signOut = useSessionStore((s) => s.signOut)
  const title = navTitle(pathname)
  const showBack = !NO_BACK.includes(pathname)

  return (
    <header className="glass w-full flex items-center px-3 py-2 mb-3">
      {showBack ? (
        <button
          type="button"
          onClick={() => navigate('/menu')}
          className="text-accent-cyan font-display px-2 py-1 active:scale-95 transition"
        >
          ◀ {t('back')}
        </button>
      ) : (
        <span aria-hidden className="px-2 py-1">&emsp;&emsp;</span>
      )}
      <h1 className="font-display flex-1 text-center text-lg">
        {title.emoji} {t(title.key)}
      </h1>
      <button
        type="button"
        onClick={() => {
          signOut()
          navigate('/')
        }}
        className="text-slate-400 hover:text-slate-200 px-2 py-1 transition"
      >
        🚪 {t('exit')}
      </button>
    </header>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- AppBar` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/AppBar.tsx src/components/AppBar.test.tsx
git commit -m "JIRA-000 Add AppBar (Back / route title / Exit) for authenticated screens"
```

---

### Task 8: Mount AppBar in the layout; strip per-screen titles, Cancels, and Menu's Exit

One coherent sweep: `AuthenticatedLayout` renders the AppBar; `ScreenFrame` titles become optional and the authenticated screens stop passing them; the remaining in-body Cancel buttons (Balance, Deposit — Withdraw's went in Task 6, Statement's in Task 3) and Menu's bottom Exit go away; the `cancel` i18n key is now unused and is removed.

**Files:**
- Modify: `src/components/AuthenticatedLayout.tsx`
- Modify: `src/components/ScreenFrame.tsx`
- Modify: `src/screens/Menu.tsx`
- Modify: `src/screens/Balance.tsx`
- Modify: `src/screens/Deposit.tsx`
- Modify: `src/screens/Statement.tsx`
- Modify: `src/screens/Withdraw.tsx`
- Modify: `src/screens/Receipt.tsx`
- Modify: `src/i18n/strings.ts`

- [ ] **Step 1: Make ScreenFrame's title optional**

In `src/components/ScreenFrame.tsx`, change the props type and heading line:

```tsx
export function ScreenFrame({
  title,
  children,
  footer,
}: {
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
```

and

```tsx
      {title && <h1 className="font-display text-2xl sm:text-3xl mb-5">{title}</h1>}
```

(Unauthenticated screens — Welcome, Pin, PasskeyAuth, EnablePasskey — keep passing `title`; they have no app bar.)

- [ ] **Step 2: Mount the AppBar in AuthenticatedLayout**

Replace the full contents of `src/components/AuthenticatedLayout.tsx`:

```tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useSessionStore } from '../stores/sessionStore'
import { useSessionTimeout } from '../hooks/useSessionTimeout'
import { AppBar } from './AppBar'

/** Guards all authenticated routes and runs the idle-timeout once for the whole session. */
export function AuthenticatedLayout() {
  const account = useSessionStore((s) => s.account)
  useSessionTimeout()
  if (!account) return <Navigate to="/" replace />
  return (
    <>
      <AppBar />
      <Outlet />
    </>
  )
}
```

(All hooks run before the conditional return — required by the hooks-ordering rule.)

- [ ] **Step 3: Strip the screens**

`src/screens/Menu.tsx` — greeting moves into the body; bottom Exit button and `signOut` go away. Replace the full contents:

```tsx
import { useNavigate } from 'react-router-dom'
import { ScreenFrame } from '../components/ScreenFrame'
import { useSessionStore } from '../stores/sessionStore'
import { useT } from '../i18n/strings'

export function Menu() {
  const t = useT()
  const navigate = useNavigate()
  const account = useSessionStore((s) => s.account)

  const actions: { emoji: string; label: string; to: string }[] = [
    { emoji: '💰', label: t('balance'), to: '/balance' },
    { emoji: '💸', label: t('withdraw'), to: '/withdraw' },
    { emoji: '🏧', label: t('deposit'), to: '/deposit' },
    { emoji: '🧾', label: t('statement'), to: '/statement' },
  ]

  return (
    <ScreenFrame>
      <p className="font-display text-2xl sm:text-3xl mb-5">👋 {account?.holderName ?? ''}</p>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((a) => (
          <button
            key={a.to}
            type="button"
            onClick={() => navigate(a.to)}
            className="glass h-24 font-display text-lg flex flex-col items-center justify-center gap-1 active:scale-95 transition"
          >
            <span className="text-2xl">{a.emoji}</span>
            {a.label}
          </button>
        ))}
      </div>
    </ScreenFrame>
  )
}
```

`src/screens/Balance.tsx` — drop the title and the Cancel half of the button grid:

```tsx
  return (
    <ScreenFrame>
      <div className="text-center py-4">
        <p className="text-slate-400">{account.holderName}</p>
        <p className="font-mono text-slate-500 text-sm mb-4">{account.maskedCardNumber}</p>
        <p className="font-display text-4xl text-accent-cyan">
          <Money amount={account.balance} currency={account.currency} />
        </p>
      </div>
      <button
        type="button"
        onClick={() => navigate('/withdraw')}
        className="glass w-full p-4 mt-6 text-accent-cyan font-display active:scale-95 transition"
      >
        💸 {t('withdraw')}
      </button>
    </ScreenFrame>
  )
```

`src/screens/Deposit.tsx` — drop the title and the Cancel button. The `<ScreenFrame title={…}>` opening becomes `<ScreenFrame>` and the trailing block

```tsx
      <button type="button" className="w-full p-3 mt-2 text-slate-400" onClick={() => navigate('/menu')}>
        {t('cancel')}
      </button>
```

is deleted. `useNavigate` stays (used for the receipt redirect in `confirm()`).

`src/screens/Statement.tsx` — `<ScreenFrame title={`🧾 ${t('statement')}`}>` becomes `<ScreenFrame>`. The title was the screen's only use of `t`, so also delete `const t = useT()` and the `import { useT } from '../i18n/strings'` line (`Pager` resolves its own strings internally).

`src/screens/Withdraw.tsx` — `<ScreenFrame title={`💰 ${t('withdraw')}`}>` becomes `<ScreenFrame>`.

`src/screens/Receipt.tsx` — title becomes a body heading. `<ScreenFrame title={`✅ ${verb}`}>` becomes:

```tsx
    <ScreenFrame>
      <p className="font-display text-2xl text-center mb-2">✅ {verb}</p>
```

(Receipt keeps its own Another-transaction/Exit buttons — the app bar shows no Back there.)

- [ ] **Step 4: Remove the dead `cancel` i18n key**

In `src/i18n/strings.ts` delete `cancel: 'Cancel',` from `en` and `cancel: 'Kanzura',` from `sn` (in the `confirm: …, cancel: …, another: …` lines).

- [ ] **Step 5: Run the gates**

Run: `npm run typecheck` — must be clean (this proves no `t('cancel')` usage survived). Run: `npm run test` — full suite green (Statement/Withdraw tests already assert no Cancel; AppBar tests cover Back/Exit). Run: `npm run lint` — zero warnings (catches unused imports: `signOut` in Menu, `useT` in Statement).

Note: `useT` stays in `Withdraw.tsx` and `Deposit.tsx` — both still render `t('confirm')`.

- [ ] **Step 6: Commit**

```bash
git add src/components/AuthenticatedLayout.tsx src/components/ScreenFrame.tsx \
  src/screens/Menu.tsx src/screens/Balance.tsx src/screens/Deposit.tsx \
  src/screens/Statement.tsx src/screens/Withdraw.tsx src/screens/Receipt.tsx \
  src/i18n/strings.ts
git commit -m "JIRA-000 Mount AppBar on authenticated screens; remove in-body Cancel/Exit

- AuthenticatedLayout renders AppBar above the outlet
- ScreenFrame title optional; authenticated screens delegate titles to the app bar
- Menu greeting moves into the body; bottom End-session removed (app bar Exit)
- Balance/Deposit Cancel buttons removed; Receipt verb becomes a body heading
- Dead 'cancel' i18n key removed from both locales"
```

---

### Task 9: Session-timeout warning

`useSessionTimeout` gains a warning countdown; a dialog renders in the layout. Expiry behavior (signOut + redirect) is unchanged.

**Files:**
- Modify: `src/hooks/useSessionTimeout.ts`
- Create: `src/components/SessionTimeoutDialog.tsx`
- Modify: `src/components/AuthenticatedLayout.tsx`
- Test: `src/components/AuthenticatedLayout.test.tsx` (new)

- [ ] **Step 1: Write the failing test**

Create `src/components/AuthenticatedLayout.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthenticatedLayout } from './AuthenticatedLayout'
import { useSessionStore } from '../stores/sessionStore'

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/menu']}>
      <Routes>
        <Route path="/" element={<p>welcome-screen</p>} />
        <Route element={<AuthenticatedLayout />}>
          <Route path="/menu" element={<p>menu-screen</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  useSessionStore.setState({
    account: {
      accountId: 'acc-1',
      holderName: 'Alice',
      maskedCardNumber: '•••• 6467',
      balance: '1000.00',
      currency: 'EUR',
    },
    cardNumber: '4539148803436467',
    startedAt: Date.now(),
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('session-timeout warning', () => {
  it('shows a countdown dialog 15s before expiry', () => {
    renderLayout()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(45_000))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText(/15/)).toBeInTheDocument()
  })

  it('any interaction dismisses the warning and resets the timer', () => {
    renderLayout()
    act(() => vi.advanceTimersByTime(45_000))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    // A fresh 60s window: still signed in 50s later…
    act(() => vi.advanceTimersByTime(50_000))
    expect(screen.getByText('menu-screen')).toBeInTheDocument()
  })

  it('signs out and returns to Welcome when the countdown expires', () => {
    renderLayout()
    act(() => vi.advanceTimersByTime(45_000))
    act(() => vi.advanceTimersByTime(15_500))
    expect(screen.getByText('welcome-screen')).toBeInTheDocument()
    expect(useSessionStore.getState().account).toBeFalsy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- AuthenticatedLayout`
Expected: FAIL — no `alertdialog` ever appears (current hook signs out silently).

- [ ] **Step 3: Extend the hook**

Replace the full contents of `src/hooks/useSessionTimeout.ts`:

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../stores/sessionStore'

const IDLE_MS = 60_000
const WARN_MS = 15_000
const TICK_MS = 250

/**
 * Client-side idle timeout. Returns the warning countdown in whole seconds,
 * or null while no warning is active. Any user interaction resets the window.
 */
export function useSessionTimeout(): number | null {
  const navigate = useNavigate()
  const signOut = useSessionStore((s) => s.signOut)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    let warnTimer: number
    let tick: number
    let deadline = 0

    const clearTimers = () => {
      window.clearTimeout(warnTimer)
      window.clearInterval(tick)
    }

    const reset = () => {
      clearTimers()
      setSecondsLeft(null)
      deadline = Date.now() + IDLE_MS
      warnTimer = window.setTimeout(() => {
        setSecondsLeft(Math.ceil(WARN_MS / 1000))
        tick = window.setInterval(() => {
          const left = Math.ceil((deadline - Date.now()) / 1000)
          if (left <= 0) {
            clearTimers()
            signOut()
            navigate('/')
          } else {
            setSecondsLeft(left)
          }
        }, TICK_MS)
      }, IDLE_MS - WARN_MS)
    }

    const events = ['click', 'keydown', 'touchstart'] as const
    events.forEach((e) => window.addEventListener(e, reset))
    reset()
    return () => {
      clearTimers()
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [navigate, signOut])

  return secondsLeft
}
```

- [ ] **Step 4: Create the dialog**

Create `src/components/SessionTimeoutDialog.tsx`:

```tsx
import { useT } from '../i18n/strings'

/** Idle-session warning. The Continue click bubbles to the window listener, which resets the timer. */
export function SessionTimeoutDialog({ secondsLeft }: { secondsLeft: number | null }) {
  const t = useT()
  if (secondsLeft === null) return null
  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/70 p-4"
    >
      <div className="glass p-6 w-full max-w-xs text-center">
        <p className="font-display text-lg mb-1">⏳ {t('timeoutTitle')}</p>
        <p className="text-slate-400 text-sm mb-4">
          {t('timeoutBody')} {secondsLeft}s
        </p>
        <button type="button" className="glass w-full p-3 text-accent-cyan font-display active:scale-95 transition">
          {t('continue')}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Wire it into the layout**

Replace the full contents of `src/components/AuthenticatedLayout.tsx`:

```tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useSessionStore } from '../stores/sessionStore'
import { useSessionTimeout } from '../hooks/useSessionTimeout'
import { AppBar } from './AppBar'
import { SessionTimeoutDialog } from './SessionTimeoutDialog'

/** Guards all authenticated routes and runs the idle-timeout once for the whole session. */
export function AuthenticatedLayout() {
  const account = useSessionStore((s) => s.account)
  const secondsLeft = useSessionTimeout()
  if (!account) return <Navigate to="/" replace />
  return (
    <>
      <AppBar />
      <Outlet />
      <SessionTimeoutDialog secondsLeft={secondsLeft} />
    </>
  )
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test -- AuthenticatedLayout` → PASS. Run `npm run test` (full) → green.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useSessionTimeout.ts src/components/SessionTimeoutDialog.tsx \
  src/components/AuthenticatedLayout.tsx src/components/AuthenticatedLayout.test.tsx
git commit -m "JIRA-000 Warn 15s before idle-session expiry with a countdown dialog

- useSessionTimeout returns the warning countdown (null when inactive)
- SessionTimeoutDialog renders in AuthenticatedLayout; any interaction resets
- Expiry behavior unchanged: signOut + redirect to Welcome"
```

---

### Task 10: Visible focus rings

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add the global focus style**

In `src/index.css`, after the `.glass` line, add:

```css
:focus-visible { outline: 2px solid var(--color-accent-cyan); outline-offset: 2px; }
```

- [ ] **Step 2: Verify manually**

Run: `npm run dev`, open the app, Tab through the Welcome screen — every focusable element must show a cyan outline. Stop the dev server.

- [ ] **Step 3: Run gates and commit**

Run: `npm run build` (proves `tsc -b && vite build` still passes with the CSS change).

```bash
git add src/index.css
git commit -m "JIRA-000 Add cyan focus-visible outline for keyboard accessibility"
```

---

### Task 11: E2E updates + full verification

**Files:**
- Modify: `e2e/atm.spec.ts`

- [ ] **Step 1: Extend the happy path with app-bar navigation and statement pagination**

In `e2e/atm.spec.ts`, add after the `withdrawalTx` constant:

```ts
function statementPage(number: number, totalPages: number) {
  return {
    success: true,
    data: {
      content: [
        {
          transactionId: `tx-p${number}`,
          accountId: 'acc-1',
          type: 'DEBIT',
          amount: '50',
          balanceAfter: '950.00',
          occurredAt: '2026-06-08T10:00:00Z',
        },
      ],
      page: { size: 10, number, totalElements: totalPages * 10, totalPages },
    },
    error: null,
    timestamp: '2026-06-08T10:00:00Z',
    traceId: `trace-statement-${number}`,
  }
}
```

Then add a new test after the existing happy-path test:

```ts
test('app bar + statement pagination: back to menu, page through statement', async ({ page }) => {
  await page.route('**/api/v1/cards/*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cardSummary) }),
  )
  await page.route('**/api/v1/cards/*/pin', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(accountSnapshot) }),
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

  await page.goto('/')
  await page.getByPlaceholder('#### #### #### ####').fill(CARD)
  await expect(page).toHaveURL(/\/pin$/)
  for (const d of ['1', '2', '3', '4']) {
    await page.getByRole('button', { name: d, exact: true }).click()
  }
  await expect(page).toHaveURL(/\/menu$/)

  // Menu shows no Back; Withdraw does — and Back returns to the menu.
  await expect(page.getByRole('button', { name: /Back|Dzokera/i })).toHaveCount(0)
  await page.getByRole('button', { name: /Withdraw|Bvisa mari/i }).click()
  await expect(page).toHaveURL(/\/withdraw$/)
  await expect(page.getByText(/Available|Mari inowanikwa/i)).toBeVisible()
  await page.getByRole('button', { name: /Back|Dzokera/i }).click()
  await expect(page).toHaveURL(/\/menu$/)

  // Statement: Prev disabled on page 1, Next flips to page 2.
  await page.getByRole('button', { name: /Mini-statement|Chitsauko/i }).click()
  await expect(page).toHaveURL(/\/statement$/)
  await expect(page.getByText('Page 1 of 2')).toBeVisible()
  await expect(page.getByRole('button', { name: /Prev|Shure/i })).toBeDisabled()
  await page.getByRole('button', { name: /Next|Mberi/i }).click()
  await expect(page.getByText('Page 2 of 2')).toBeVisible()
  await expect(page.getByRole('button', { name: /Next|Mberi/i })).toBeDisabled()
})
```

- [ ] **Step 2: Run the e2e suite**

Run: `npm run e2e`
Expected: both specs PASS (the original happy path needs no edits — it never used Cancel, and the receipt's ✅ assertion still matches the body heading).

If the existing happy path fails on the `name: /50/` chip click because the app bar now also matches, tighten the selector to `page.getByRole('button', { name: '€50.00' })`.

- [ ] **Step 3: Full verification sweep**

Run, in order, reading each output:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run e2e
```

Expected: all green, zero warnings.

- [ ] **Step 4: Commit**

```bash
git add e2e/atm.spec.ts
git commit -m "JIRA-000 Cover app-bar navigation and statement pagination in e2e

- New spec: Back hidden on menu, Back returns from Withdraw, Available banner visible
- Statement pager: position label, bound-disabled Prev/Next across two mocked pages"
```

---

## Out of scope (per spec)

- Backend changes of any kind.
- Localizing pre-existing hardcoded strings ("Loading…", "No transactions yet", "Custom amount") beyond what new code touches.
- Transaction detail drill-down, balance polling, Deposit balance card.
