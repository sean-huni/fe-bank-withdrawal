# UX Improvements — Design Spec

**Date:** 2026-06-11
**Repos:** `fe-bank-withdrawal` (all changes) · `bank-withdrawal` backend (no changes required)
**Status:** Approved design, pending implementation plan

## Problem

Five UX issues in the ATM frontend:

1. The mini-statement's "More ▼" button silently replaces the list with the next page — no
   position indicator, no way back. Feels endless.
2. The account balance on the Withdraw screen is a small grey caption under the amount pad —
   effectively invisible.
3. "Cancel" buttons (Withdraw, Deposit, Statement) read as "abort/log out" when they actually
   mean "return to menu".
4. No screen tells the user where they are in the navigation; each screen shows only its own
   title.
5. Assorted rough edges found in audit: silent session expiry, tappable-but-unaffordable
   quick-cash buttons, no visible keyboard-focus indicator.

The backend already returns full Spring `PagedModel` metadata (`totalElements`, `totalPages`,
`number`, `size`) on `GET /accounts/{accountId}/transactions`, so every change below is
frontend-only (chosen approach A over adding a fresh-balance endpoint).

## Design decisions (validated via visual mockups)

| # | Decision |
|---|----------|
| 1 | Statement gets a **Prev/Next pager with "Page X of Y"** indicator |
| 2 | Withdraw gets a **prominent "Available" balance card** above the amount pad |
| 3 | In-body Cancel buttons are **removed** — the app bar's Back replaces them |
| 4 | A **persistent app bar** (◀ Back · screen title · 🚪 Exit) on all authenticated screens |
| 5 | Session-timeout warning dialog · disable unaffordable quick-cash · visible focus rings |

## Components

### AppBar (new, `src/components/AppBar.tsx`)

Rendered once by `AuthenticatedLayout` so every authenticated route gets it for free.

- **◀ Back** — navigates to `/menu`. The post-login flow is only ever one level deep, so a
  fixed target beats history-stack tricks. Hidden on `/menu` (root) and `/receipt`
  (transaction is final; Receipt keeps its own two action buttons).
- **Title** — derived from the route via a small `src/config/navTitles.ts` map
  (route path → i18n key + emoji). `ScreenFrame` in-body titles are removed to avoid
  duplication; `ScreenFrame` keeps layout duties only.
- **🚪 Exit** — calls the existing `signOut()` then navigates to `/`. The Menu screen's
  bottom "End session" button is removed as redundant.

### BalanceCard (new, `src/components/BalanceCard.tsx`)

Cyan-accented card: small uppercase "Available" label + `<Money>` amount. Reads
`sessionStore.account.balance` (already patched after every transaction via
`patchBalance()`). Used on Withdraw only; Deposit can adopt it later if symmetry is wanted.

Known trade-off: the session snapshot can go stale if funds move via another channel
mid-session. Accepted — the server remains the source of truth on the actual withdrawal;
worst case is a friendlier error path.

### Pager (new, `src/components/Pager.tsx`)

`◀ Prev · Page X of Y · Next ▶`. Props: `page`, `totalPages`, `onPage`. Buttons disabled at
bounds. Replaces the More/Cancel button pair on Statement.

### SessionTimeoutDialog (new, `src/components/SessionTimeoutDialog.tsx`)

`useSessionTimeout` (60 s client-side idle timer) gains a warning threshold: at **15 s
remaining** the hook flips a warning state with a live countdown; the dialog renders in
`AuthenticatedLayout`. "Continue" (or any user interaction) resets the timer; expiry keeps
today's behavior (signOut + redirect to `/`). The timeout is purely client-side, so the
countdown is exact, not an estimate.

### AmountPad (extend, `src/components/AmountPad.tsx`)

New optional `max?: number` prop. Quick-cash chips with `value > max` are disabled
(`disabled` + `aria-disabled`) with a short "over balance" hint. Withdraw passes the session
balance; Deposit passes nothing (any deposit is affordable). The custom-amount path keeps the
existing client pre-check + server-as-source-of-truth toast flow.

### Focus rings (`src/index.css`)

Global `:focus-visible` outline in the cyan accent (`--color-accent-cyan`); no per-component
changes.

## Per-screen summary

| Screen | Changes |
|---|---|
| Withdraw | + BalanceCard · − grey balance caption · − Cancel · AmountPad gets `max` |
| Deposit | − Cancel |
| Balance | − "◀ Cancel" button (`Balance.tsx:36`) — app bar Back replaces it |
| Statement | More/Cancel → Pager · `placeholderData: keepPreviousData` on the query so page flips don't flash the loading state |
| Menu | − bottom "End session" (app bar Exit replaces it) |
| Receipt | keeps its own Menu/Exit action buttons; no Back in app bar |
| All authenticated | AppBar + SessionTimeoutDialog via `AuthenticatedLayout`; in-body `ScreenFrame` titles move to the app bar |

## i18n

New FE-owned strings in `src/i18n/strings.ts`, en + sn: `back`, `available`,
`pageOf` ("Page {x} of {y}"), `prev`, `next`, `overBalance`, `timeoutTitle`, `timeoutBody`,
`continue`. The existing `exit` key is reused by the AppBar. Shona drafts (e.g. *Dzokera*
for Back) marked `// TODO(sn): review translation`. The `cancel` key is removed once unused.
No hardcoded UI strings in new code.

## Error handling

No changes to the error-mapping pipeline (`lib/errorMap.ts`). Pager bound-disabling prevents
invalid page requests; statement fetch errors keep the existing toast path.

## Testing

- **Vitest:** AppBar (title per route, Back hidden on `/menu` + `/receipt`, Exit signs out),
  Pager (bounds, label, callbacks), Withdraw (BalanceCard rendered, chips above balance
  disabled, confirm flow still green), Statement (Prev/Next drives the query page),
  useSessionTimeout warning + reset (fake timers).
- **Playwright:** update the main flow spec (Cancel buttons gone, navigation via app bar);
  add a statement-pagination pass with mocked pages.
- **Gates:** `npm run lint` (`--max-warnings 0`), `npm run typecheck` (`tsc -b`),
  `npm run test`, `npm run e2e`.

## Out of scope

- Backend changes of any kind (incl. fresh-balance endpoint — rejected as YAGNI).
- Localizing pre-existing hardcoded strings ("Loading…", "No transactions yet") beyond the
  ones this work touches or replaces.
- Transaction detail drill-down, balance polling, Deposit balance card.
