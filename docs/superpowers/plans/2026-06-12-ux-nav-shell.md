# UX Iteration 2 — Nav Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fuse the nav bar to the ATM card as an attached header with a cross-screen title dropdown, add tx-ids to statement rows, reduce Receipt to a single in-body action, and close the round with a screenshot re-capture review.

**Architecture:** `AuthenticatedLayout` takes ownership of the glass card (one `motion.section` shell: AppBar header + padded `Outlet`); the six authenticated screens drop their `ScreenFrame` wrappers (`ScreenFrame` remains for the four unauthenticated screens). A new `NavMenu` renders in the AppBar title slot, driven by `NAV_DESTINATIONS` in the existing `navTitles.ts`. Spec: `docs/superpowers/specs/2026-06-12-ux-iteration-2-design.md`.

**Tech Stack:** React 19, framer-motion (shell entry fade), TypeScript strict, Vitest + Testing Library, Playwright.

**Working branch:** `JIRA-000-feat-ux-nav-shell` (already cut from `dev`; spec + screenshot tool committed).

**Conventions for every commit:** title prefixed `JIRA-000`, NO `Co-Authored-By` trailers. Never stage `src/i18n/generated/beMessages.ts`. Gates per task: `npm run lint` (zero warnings), `npm run typecheck` (`tsc -b`), `npm run test`.

**One spec amendment locked in here (Task 1):** the spec said the shell uses `overflow-hidden` to clip the header to the card radius. That would also clip the NavMenu dropdown (absolutely positioned inside the card) on short screens like the Statement empty state. Instead: NO `overflow-hidden` on the shell; the AppBar header carries `rounded-t-2xl` to match the card's `.glass` radius. Task 1 trues up the spec.

---

### Task 1: NAV_DESTINATIONS config + spec amendment

**Files:**
- Modify: `src/config/navTitles.ts`
- Test: `src/config/navTitles.test.ts`
- Modify: `docs/superpowers/specs/2026-06-12-ux-iteration-2-design.md`

- [ ] **Step 1: Write the failing test**

Add to `src/config/navTitles.test.ts` inside the existing `describe('navTitle', ...)` block (import update shown in Step 3):

```tsx
  it('exposes the four cross-screen destinations in display order', () => {
    expect(NAV_DESTINATIONS).toEqual(['/balance', '/withdraw', '/deposit', '/statement'])
    for (const to of NAV_DESTINATIONS) {
      expect(navTitle(to).key).not.toBe('menu') // every destination has its own mapped title
    }
  })
```

and change the import line to:

```tsx
import { NAV_DESTINATIONS, navTitle } from './navTitles'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- navTitles`
Expected: FAIL — `NAV_DESTINATIONS` is not exported.

- [ ] **Step 3: Implement**

In `src/config/navTitles.ts`, add after the `TITLES` map:

```ts
/** Destinations offered by the cross-screen NavMenu, in display order. */
export const NAV_DESTINATIONS = ['/balance', '/withdraw', '/deposit', '/statement'] as const
```

- [ ] **Step 4: Amend the spec (overflow-hidden → rounded header)**

In `docs/superpowers/specs/2026-06-12-ux-iteration-2-design.md`, replace the sentence fragment

```
  (Back / title / Exit). `overflow-hidden` on the shell clips the header to the card
  radius.
```

with

```
  (Back / title / Exit) plus `rounded-t-2xl` so the header's own background matches the
  card radius. The shell deliberately has NO `overflow-hidden` — it would clip the
  NavMenu dropdown (absolutely positioned inside the card) on short screens such as the
  Statement empty state.
```

- [ ] **Step 5: Run tests + gates**

Run: `npm run test -- navTitles` → PASS (4 tests). `npm run typecheck`, `npm run lint` → clean.

- [ ] **Step 6: Commit**

```bash
git add src/config/navTitles.ts src/config/navTitles.test.ts docs/superpowers/specs/2026-06-12-ux-iteration-2-design.md
git commit -m "JIRA-000 Add NAV_DESTINATIONS config; spec: header radius instead of overflow clip"
```

---

### Task 2: NavMenu component

**Files:**
- Create: `src/components/NavMenu.tsx`
- Test: `src/components/NavMenu.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/NavMenu.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { NavMenu } from './NavMenu'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/balance" element={<><NavMenu /><p>balance-screen</p></>} />
        <Route path="/withdraw" element={<><NavMenu /><p>withdraw-screen</p></>} />
        <Route path="/deposit" element={<><NavMenu /><p>deposit-screen</p></>} />
        <Route path="/statement" element={<><NavMenu /><p>statement-screen</p></>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('NavMenu', () => {
  it('renders the current route title as a collapsed menu trigger', () => {
    renderAt('/withdraw')
    const trigger = screen.getByRole('button', { name: /withdraw/i })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('opens with all four destinations and marks the current one', async () => {
    renderAt('/withdraw')
    await userEvent.click(screen.getByRole('button', { name: /withdraw/i }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    const items = screen.getAllByRole('menuitem')
    expect(items).toHaveLength(4)
    expect(screen.getByRole('menuitem', { name: /withdraw/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('menuitem', { name: /deposit/i })).not.toHaveAttribute('aria-current')
  })

  it('navigates to a destination and closes', async () => {
    renderAt('/withdraw')
    await userEvent.click(screen.getByRole('button', { name: /withdraw/i }))
    await userEvent.click(screen.getByRole('menuitem', { name: /mini-statement/i }))
    expect(screen.getByText('statement-screen')).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes on Escape and restores focus to the trigger', async () => {
    renderAt('/withdraw')
    const trigger = screen.getByRole('button', { name: /withdraw/i })
    await userEvent.click(trigger)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes on an outside click', async () => {
    renderAt('/withdraw')
    await userEvent.click(screen.getByRole('button', { name: /withdraw/i }))
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- NavMenu`
Expected: FAIL — cannot resolve `./NavMenu`.

- [ ] **Step 3: Implement the component**

Create `src/components/NavMenu.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { NAV_DESTINATIONS, navTitle } from '../config/navTitles'
import { useT } from '../i18n/strings'

/** App-bar title that doubles as a cross-screen navigation dropdown. */
export function NavMenu() {
  const t = useT()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const title = navTitle(pathname)

  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function go(to: string) {
    setOpen(false)
    if (to !== pathname) navigate(to)
  }

  return (
    <div ref={rootRef} className="relative">
      <h1 className="font-display text-lg">
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="px-2 py-1 active:scale-95 transition"
        >
          {title.emoji} {t(title.key)}{' '}
          <span aria-hidden="true" className="text-xs text-slate-500">
            ▾
          </span>
        </button>
      </h1>
      {open && (
        <div
          role="menu"
          aria-label={t('menu')}
          className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-40 glass p-1 w-44 shadow-2xl"
        >
          {NAV_DESTINATIONS.map((to) => {
            const item = navTitle(to)
            const current = to === pathname
            return (
              <button
                key={to}
                type="button"
                role="menuitem"
                aria-current={current ? 'page' : undefined}
                onClick={() => go(to)}
                className={`w-full text-left px-3 py-2 rounded-xl transition hover:bg-surface-700/40 ${
                  current ? 'bg-accent-cyan/15 text-accent-cyan' : ''
                }`}
              >
                {item.emoji} {t(item.key)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

Notes baked into this design: the `h1` lives INSIDE NavMenu (it replaces AppBar's current `h1`, keeping exactly one h1 per authenticated page, now containing the trigger button — valid HTML, and the `aria-hidden` carat stays out of the accessible name). Focus is restored on Escape; after item navigation the shell re-mounts (route-keyed), so focus restoration there is moot.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- NavMenu` → 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/NavMenu.tsx src/components/NavMenu.test.tsx
git commit -m "JIRA-000 Add NavMenu cross-screen dropdown (title trigger, menu roles, esc/outside close)"
```

---

### Task 3: Card shell — AuthenticatedLayout owns the glass card; AppBar becomes the attached header

**Files:**
- Modify: `src/components/AuthenticatedLayout.tsx`
- Modify: `src/components/AppBar.tsx`
- Test: `src/components/AuthenticatedLayout.test.tsx` (one new test)

- [ ] **Step 1: Write the failing test**

Add a new top-level `describe` to `src/components/AuthenticatedLayout.test.tsx`, after the existing `describe('session-timeout warning', ...)` block — it reuses the file's `renderLayout` helper and `beforeEach` (fake timers + session store):

```tsx
describe('card shell', () => {
  it('renders the app-bar header and screen content inside one card section', () => {
    const { container } = renderLayout()
    const section = container.querySelector('section')
    expect(section).not.toBeNull()
    expect(section!.querySelector('header')).not.toBeNull()
    expect(section!.textContent).toContain('menu-screen')
  })

  it('keeps the timeout dialog outside the animated card (transform would clip the fixed overlay)', () => {
    const { container } = renderLayout()
    act(() => vi.advanceTimersByTime(45_000))
    const section = container.querySelector('section')
    const dialog = screen.getByRole('alertdialog')
    expect(section!.contains(dialog)).toBe(false)
  })
})
```

(`act`, `vi`, `screen` are already imported in this file; fake timers are installed by the file-level `beforeEach`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- AuthenticatedLayout`
Expected: FAIL — no `<section>` exists (the current layout renders a fragment).

- [ ] **Step 3: Rewrite AuthenticatedLayout**

Replace the full contents of `src/components/AuthenticatedLayout.tsx`:

```tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useSessionStore } from '../stores/sessionStore'
import { useSessionTimeout } from '../hooks/useSessionTimeout'
import { AppBar } from './AppBar'
import { SessionTimeoutDialog } from './SessionTimeoutDialog'

/** Guards all authenticated routes, owns the ATM card shell, and runs the idle-timeout. */
export function AuthenticatedLayout() {
  const account = useSessionStore((s) => s.account)
  const { secondsLeft, keepAlive } = useSessionTimeout()
  const { pathname } = useLocation()
  if (!account) return <Navigate to="/" replace />
  return (
    <>
      <motion.section
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="glass w-full max-w-md shadow-2xl"
      >
        <AppBar />
        <div className="p-6 sm:p-8">
          <Outlet />
        </div>
      </motion.section>
      {/* Sibling of the animated card: a transformed ancestor would become the containing
          block for this fixed overlay and clip it. */}
      <SessionTimeoutDialog secondsLeft={secondsLeft} onContinue={keepAlive} />
    </>
  )
}
```

- [ ] **Step 4: Restyle AppBar as the attached header with NavMenu in the title slot**

Replace the full contents of `src/components/AppBar.tsx`:

```tsx
import { useLocation, useNavigate } from 'react-router-dom'
import { navTitle } from '../config/navTitles'
import { useT } from '../i18n/strings'
import { useExitSession } from '../hooks/useExitSession'
import { NavMenu } from './NavMenu'

/** Attached header of the ATM card: Back / NavMenu title / Exit. */
export function AppBar() {
  const t = useT()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const exitSession = useExitSession()
  const title = navTitle(pathname)

  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center px-3 py-2 rounded-t-2xl bg-surface-900/40 border-b border-surface-700/50">
      <div className="justify-self-start">
        {!title.noBack && (
          <button
            type="button"
            onClick={() => navigate('/menu')}
            className="text-accent-cyan font-display px-2 py-1 active:scale-95 transition"
          >
            <span aria-hidden="true">◀ </span>
            {t('back')}
          </button>
        )}
      </div>
      <NavMenu />
      <button
        type="button"
        onClick={exitSession}
        className="justify-self-end text-slate-400 hover:text-slate-200 px-2 py-1 transition"
      >
        🚪 {t('exit')}
      </button>
    </header>
  )
}
```

(Diff vs current: `glass w-full ... mb-3` header classes → attached-header classes; the `<h1>` block is replaced by `<NavMenu />`, which provides the h1; `navTitle` stays imported for the `noBack` check.)

- [ ] **Step 5: Run the full suite**

Run: `npm run test` → all green. The existing AppBar tests still pass: the title heading now comes from NavMenu (`getByRole('heading', { name: /withdraw/i })` matches the h1 whose accessible name excludes the aria-hidden carat); Back/Exit behavior is unchanged. The three timeout tests still pass (dialog is now a shell sibling — behavior identical). Then `npm run typecheck`, `npm run lint` → clean.

Expected intermediate state (fine): authenticated screens still wrap their content in `ScreenFrame`, so the UI briefly shows a card-inside-card. Task 4 removes the inner cards. Tests don't assert card nesting, so everything stays green.

- [ ] **Step 6: Commit**

```bash
git add src/components/AuthenticatedLayout.tsx src/components/AppBar.tsx src/components/AuthenticatedLayout.test.tsx
git commit -m "JIRA-000 AuthenticatedLayout owns the ATM card; AppBar becomes its attached header

- one motion.section shell (route-keyed entry fade), padded outlet
- AppBar: rounded-t header band, NavMenu replaces the static title
- timeout dialog stays a shell sibling (transform/containing-block hazard) — tested"
```

---

### Task 4: Authenticated screens drop ScreenFrame

**Files:**
- Modify: `src/screens/Menu.tsx`
- Modify: `src/screens/Balance.tsx`
- Modify: `src/screens/Withdraw.tsx`
- Modify: `src/screens/Deposit.tsx`
- Modify: `src/screens/Statement.tsx`
- Modify: `src/screens/Receipt.tsx`

Mechanical sweep — in each of the six files: delete the `import { ScreenFrame } from '../components/ScreenFrame'` line and replace the `<ScreenFrame>` / `</ScreenFrame>` pair with `<>` / `</>` (React fragment). Nothing else changes in this task. `ScreenFrame` itself is NOT touched (Welcome, Pin, PasskeyAuth, EnablePasskey keep using it).

- [ ] **Step 1: Apply the sweep to all six screens**

Example — `src/screens/Menu.tsx` return block becomes:

```tsx
  return (
    <>
      <h2 className="font-display text-2xl sm:text-3xl mb-5">👋 {account?.holderName ?? ''}</h2>
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
    </>
  )
```

Apply the same import-delete + wrapper-swap to Balance, Withdraw, Deposit, Statement, Receipt. (Receipt keeps its `<h2>✅ {verb}</h2>` heading and inner `glass` detail card — only the outer wrapper changes.)

- [ ] **Step 2: Run the gates**

Run: `npm run test` (full — screen tests render bare content now; none assert on ScreenFrame), `npm run typecheck`, `npm run lint` (catches any leftover unused `ScreenFrame` import). All green.

- [ ] **Step 3: Commit**

```bash
git add src/screens/Menu.tsx src/screens/Balance.tsx src/screens/Withdraw.tsx \
  src/screens/Deposit.tsx src/screens/Statement.tsx src/screens/Receipt.tsx
git commit -m "JIRA-000 Authenticated screens render bare content; the layout shell owns the card"
```

---

### Task 5: Statement rows show a truncated tx-id

**Files:**
- Modify: `src/screens/Statement.tsx`
- Test: `src/screens/Statement.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/screens/Statement.test.tsx` inside `describe('Statement pagination', ...)` (the `tx()` helper builds ids like `'t1'`; this test needs a realistic one, so it builds its own):

```tsx
  it('shows a truncated tx-id per row with the full id on hover', async () => {
    const fullId = 'f3b9c2d8-7e4a-4f1b-9c6d-000000000001'
    vi.spyOn(atm, 'statement').mockResolvedValue({
      content: [{ ...tx('ignored'), transactionId: fullId }],
      page: { size: 10, number: 0, totalElements: 1, totalPages: 1 },
    })
    renderStatement()
    const shortId = await screen.findByText('#f3b9c2d8')
    expect(shortId).toHaveAttribute('title', fullId)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- Statement`
Expected: FAIL — `#f3b9c2d8` not found.

- [ ] **Step 3: Implement**

In `src/screens/Statement.tsx`, add above the `Row` component:

```tsx
/** First 8 chars — enough to correlate with back-office records without wrecking the row. */
function shortTxId(id: string): string {
  return `#${id.slice(0, 8)}`
}
```

and replace `Row`'s left column

```tsx
      <span className="flex items-center gap-2">
        <span className="text-lg">{emoji}</span>
        <span className="text-slate-400">{dateFmt.format(new Date(tx.occurredAt))}</span>
      </span>
```

with

```tsx
      <span className="flex items-center gap-2">
        <span className="text-lg">{emoji}</span>
        <span>
          <span className="block text-slate-400">{dateFmt.format(new Date(tx.occurredAt))}</span>
          <span className="block font-mono text-[10px] text-slate-500" title={tx.transactionId}>
            {shortTxId(tx.transactionId)}
          </span>
        </span>
      </span>
```

- [ ] **Step 4: Run tests**

Run: `npm run test -- Statement` → all pass (5 tests). `npm run typecheck`, `npm run lint` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Statement.tsx src/screens/Statement.test.tsx
git commit -m "JIRA-000 Show truncated tx-id on statement rows (full id on hover)"
```

---

### Task 6: Receipt single-action body; exit-toast tests move to useExitSession

**Files:**
- Modify: `src/screens/Receipt.tsx`
- Modify: `src/screens/Receipt.test.tsx`
- Create: `src/hooks/useExitSession.test.tsx`

- [ ] **Step 1: Create the relocated exit-toast tests**

Create `src/hooks/useExitSession.test.tsx` (exercises the hook through the AppBar Exit, end-to-end through real navigation):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AppBar } from '../components/AppBar'
import { useSessionStore } from '../stores/sessionStore'

vi.mock('react-hot-toast', () => ({ default: vi.fn() }))

function renderBar() {
  return render(
    <MemoryRouter initialEntries={['/withdraw']}>
      <Routes>
        <Route path="/" element={<p>welcome-screen</p>} />
        <Route path="/withdraw" element={<AppBar />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useSessionStore.setState({
    account: {
      accountId: 'acc-1',
      holderName: 'Alice',
      maskedCardNumber: '•••• 6467',
      balance: '950.00',
      currency: 'EUR',
    },
    cardNumber: '4539148803436467',
    startedAt: Date.now(),
  })
})

describe('useExitSession (via AppBar Exit)', () => {
  it('signs out, reminds the card user to take the card, and returns to Welcome', async () => {
    renderBar()
    await userEvent.click(screen.getByRole('button', { name: /end session/i }))
    expect(screen.getByText('welcome-screen')).toBeInTheDocument()
    expect(useSessionStore.getState().account).toBeNull()
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('take your card'))
  })

  it('skips the take-card reminder for passkey sessions (no card)', async () => {
    useSessionStore.setState({ cardNumber: null })
    renderBar()
    await userEvent.click(screen.getByRole('button', { name: /end session/i }))
    expect(screen.getByText('welcome-screen')).toBeInTheDocument()
    expect(toast).not.toHaveBeenCalled()
  })
})
```

Run: `npm run test -- useExitSession` → 2 passed (these pass immediately — the hook already behaves this way; the point is keeping coverage alive when the Receipt button disappears next).

- [ ] **Step 2: Rewrite Receipt.test.tsx for the single-action body**

Replace the `describe('Receipt exit', ...)` block in `src/screens/Receipt.test.tsx` with:

```tsx
describe('Receipt body', () => {
  it('shows the transaction and exactly one action: another transaction', async () => {
    renderReceipt()
    expect(screen.getByText('tx-1')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /end session/i })).not.toBeInTheDocument()
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: /another transaction/i }))
    expect(screen.getByText('menu-screen')).toBeInTheDocument()
  })
})
```

and add a `/menu` route to `renderReceipt`'s `<Routes>`:

```tsx
        <Route path="/menu" element={<p>menu-screen</p>} />
```

The `toast` import, its `vi.mock`, and the `vi.clearAllMocks()` line can stay (harmless) or be removed with the unused import — remove `import toast from 'react-hot-toast'` and the `vi.mock('react-hot-toast', ...)` line, since nothing in this file asserts toasts anymore (lint will flag the unused import otherwise).

Run: `npm run test -- Receipt`
Expected: FAIL — the body still renders an End-session button (2 buttons found).

- [ ] **Step 3: Strip the Receipt**

In `src/screens/Receipt.tsx`:
- Delete the `import { useExitSession } from '../hooks/useExitSession'` line and the `const exitSession = useExitSession()` line.
- Replace the two-button grid

```tsx
      <div className="grid grid-cols-2 gap-3 mt-6">
        <button
          type="button"
          onClick={() => navigate('/menu')}
          className="glass p-4 text-accent-cyan font-display active:scale-95 transition"
        >
          🔁 {t('another')}
        </button>
        <button
          type="button"
          onClick={exitSession}
          className="glass p-4 font-display active:scale-95 transition"
        >
          🚪 {t('exit')}
        </button>
      </div>
```

with

```tsx
      <button
        type="button"
        onClick={() => navigate('/menu')}
        className="glass w-full p-4 mt-6 text-accent-cyan font-display active:scale-95 transition"
      >
        🔁 {t('another')}
      </button>
```

- [ ] **Step 4: Run the gates**

Run: `npm run test` (full) → green, including the new useExitSession pair and the rewritten Receipt test. `npm run typecheck`, `npm run lint` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Receipt.tsx src/screens/Receipt.test.tsx src/hooks/useExitSession.test.tsx
git commit -m "JIRA-000 Receipt body keeps a single action; exit-toast coverage moves to useExitSession

- header Exit (useExitSession) is the one session-end control
- Another transaction becomes full-width"
```

---

### Task 7: E2E — cross-screen jump + screenshot-spec updates + full gates

**Files:**
- Modify: `e2e/atm.spec.ts`
- Modify: `e2e/ux-screenshots.spec.ts`

- [ ] **Step 1: Add the cross-screen jump to the app-bar e2e test**

In `e2e/atm.spec.ts`, in the test `'app bar + statement pagination: back to menu, page through statement'`, replace the block

```ts
  // Withdraw: Available banner, then app-bar Back returns to the menu.
  await page.getByRole('button', { name: /Withdraw|Bvisa mari/i }).click()
  await expect(page).toHaveURL(/\/withdraw$/)
  await expect(page.getByText(/Available|Mari inowanikwa/i)).toBeVisible()
  await page.getByRole('button', { name: /Back|Dzokera/i }).click()
  await expect(page).toHaveURL(/\/menu$/)

  // Statement: Prev disabled on page 1, Next flips to page 2.
  await page.getByRole('button', { name: /Mini-statement|Chitsauko/i }).click()
  await expect(page).toHaveURL(/\/statement$/)
```

with

```ts
  // Withdraw: Available banner, then jump straight to the Statement via the title menu.
  await page.getByRole('button', { name: /Withdraw|Bvisa mari/i }).click()
  await expect(page).toHaveURL(/\/withdraw$/)
  await expect(page.getByText(/Available|Mari inowanikwa/i)).toBeVisible()
  await page.locator('header').getByRole('button', { name: /Withdraw|Bvisa mari/i }).click()
  await page.getByRole('menuitem', { name: /Mini-statement|Chitsauko/i }).click()
  await expect(page).toHaveURL(/\/statement$/)

  // App-bar Back still returns to the menu, then re-enter the statement.
  await page.getByRole('button', { name: /Back|Dzokera/i }).click()
  await expect(page).toHaveURL(/\/menu$/)
  await page.getByRole('button', { name: /Mini-statement|Chitsauko/i }).click()
  await expect(page).toHaveURL(/\/statement$/)
```

(The pagination assertions that follow stay unchanged.)

- [ ] **Step 2: Add a NavMenu screenshot to the capture spec**

In `e2e/ux-screenshots.spec.ts`, in the main walk, after the `await shot('05-statement-p1')` line and BEFORE the `Next` click, insert:

```ts
  await page.locator('header').getByRole('button', { name: /Mini-statement/i }).click()
  await shot('05b-nav-menu-open')
  await page.keyboard.press('Escape')
```

- [ ] **Step 3: Full verification sweep**

Run, in order, reading each output:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run e2e
```

All green, zero warnings.

- [ ] **Step 4: Commit**

```bash
git add e2e/atm.spec.ts e2e/ux-screenshots.spec.ts
git commit -m "JIRA-000 E2E: cross-screen jump via title menu; capture the open NavMenu"
```

---

### Task 8: Screenshot re-capture + review (definition of done)

**Files:** none committed (PNGs land in gitignored `.superpowers/ux-shots/`)

- [ ] **Step 1: Re-capture the full flow**

Run: `SCREENSHOTS=1 npx playwright test e2e/ux-screenshots.spec.ts`
Expected: 2 passed; 11 PNGs in `.superpowers/ux-shots/` (the original ten plus `05b-nav-menu-open`).

- [ ] **Step 2: Review the captures**

The controller (not a subagent) reads every PNG and verifies against the approved design:
- header is fused to the card (no gap, no double rounding, no nested cards),
- the open NavMenu is not clipped and highlights the current screen,
- statement rows show `#xxxxxxxx` ids,
- Receipt shows exactly one in-body action,
- nothing else regressed (welcome/pin unchanged, timeout dialog overlays correctly).

Any discrepancy becomes a fix task before the final review. This step is the spec's
"learn & adapt" gate — do not skip it or rubber-stamp it.

---

## Out of scope (per spec)

Backend changes; statement error-state redesign; timeout-dialog focus trap; Shona
translation review; tap-to-expand full tx-id.
