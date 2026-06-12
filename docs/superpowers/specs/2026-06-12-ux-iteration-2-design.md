# UX Iteration 2 — Nav Shell, Cross-Screen Menu, Statement Tx-Ids

**Date:** 2026-06-12
**Repo:** `fe-bank-withdrawal` only (frontend; no backend changes)
**Status:** Approved design, pending implementation plan
**Predecessor:** `2026-06-11-ux-improvements-design.md` (merged to `dev`)

## Problem

Playwright screenshots of the merged round-1 UI (`.superpowers/ux-shots/`, captured via
`e2e/ux-screenshots.spec.ts`) confirmed four issues:

1. Mini-statement rows carry no transaction id — only the Receipt surfaces one, so a
   statement entry can't be correlated with support/back-office records.
2. The Menu screen is the only way to move between destinations; switching from Withdraw
   to Statement requires bouncing through Menu.
3. Navigation actions are inconsistent in placement: the Back/title/Exit bar floats as a
   separate pill *above* the ATM card while Receipt keeps its own "End session" *inside*
   the card — three visual homes for actions across the flow.
4. UI decisions were being made from code reading alone; the screenshot loop must become
   a standing part of the workflow.

## Decisions (validated via screenshots + mockups)

| # | Decision |
|---|----------|
| 1 | Statement rows show a truncated tx-id (`#` + first 8 chars, full id in `title`) |
| 2 | The header title becomes a dropdown listing the four destinations (cross-screen nav) |
| 3 | The nav bar fuses to the ATM card as an **attached header** (option A); Receipt's in-body End-session is removed |
| 4 | `e2e/ux-screenshots.spec.ts` is committed as a permanent, env-gated capture tool; re-capture + review is part of this round's definition of done |

## Design

### Layout shell (`AuthenticatedLayout`)

The glass card moves up into the layout. `AuthenticatedLayout` renders ONE
`motion.section` — classes `glass w-full max-w-md shadow-2xl overflow-hidden`, the
existing 0.2s entry fade, `key={pathname}` so route changes re-animate — containing:

- `<AppBar />` as the card's attached header: no own `glass`/rounding/`mb-3`; instead
  `border-b border-surface-700/50 bg-surface-900/40 px-3 py-2`, same 3-column grid
  (Back / title / Exit). `overflow-hidden` on the shell clips the header to the card
  radius.
- a content wrapper `div` with the card padding (`p-6 sm:p-8`) around `<Outlet />`.

`<SessionTimeoutDialog />` must render as a SIBLING of the `motion.section`, not inside
it: the section's `y` entry animation applies a `transform`, and a transformed ancestor
becomes the containing block for `position: fixed` descendants — inside the shell the
overlay would be mispositioned and clipped by `overflow-hidden`. The layout returns
`<> <motion.section>…</motion.section> <SessionTimeoutDialog … /> </>`.

The six authenticated screens (Menu, Balance, Withdraw, Deposit, Statement, Receipt)
drop their `<ScreenFrame>` wrappers and render bare content. `ScreenFrame` is untouched
and remains the card for the four unauthenticated screens (Welcome, Pin, PasskeyAuth,
EnablePasskey), which keep their own titles. The hooks-before-conditional-return rule
continues to hold in the layout.

### NavMenu (cross-screen dropdown)

New `src/components/NavMenu.tsx`, rendered by `AppBar` in the title slot:

- Trigger: a button `{emoji} {t(title.key)} ▾` with `aria-haspopup="menu"` and
  `aria-expanded`.
- Panel: `role="menu"` with `role="menuitem"` buttons for the four destinations
  (`/balance`, `/withdraw`, `/deposit`, `/statement`), each `{emoji} {label}`.
- Destinations come from a new `NAV_DESTINATIONS` export in `src/config/navTitles.ts`
  (the file already owns route → emoji/key/noBack; no second route list anywhere).
- Current route's item gets `aria-current="page"` + highlight; clicking it just closes.
- Close on: item navigation, Escape, click outside. Focus returns to the trigger on
  close. Plain controlled React state (no Popover API).
- Available on every authenticated screen, including Receipt and Menu.

Back/Exit behavior is unchanged (Back → `/menu`, hidden via `noBack`; Exit →
`useExitSession` with the card-only take-card toast).

### Statement rows: tx-id

`Row` in `src/screens/Statement.tsx` gains a second line in the left column:

- Line 1: emoji + date/time (as today).
- Line 2: `#${tx.transactionId.slice(0, 8)}` in `font-mono text-[10px] text-slate-500`,
  with the full id in the `title` attribute.

A `shortTxId(id: string)` helper lives next to the Row (module-local; promoted to a lib
only if a second consumer appears — YAGNI). The Receipt keeps showing the full id.

### Receipt cleanup

- The in-body "End session" button is deleted; "Another transaction" becomes full-width.
- The take-card toast tests currently in `Receipt.test.tsx` move to a new
  `src/hooks/useExitSession.test.tsx` (card session → toast; passkey session → none),
  exercised through the AppBar Exit so the behavior stays covered end-to-end.
- `Receipt.test.tsx` asserts the body has exactly one action (Another transaction) and
  no End-session button.

### Screenshot loop (process)

- `e2e/ux-screenshots.spec.ts` is committed: gated behind `SCREENSHOTS=1`
  (`test.skip`), walks all ten states with mocked routes, writes PNGs to
  `.superpowers/ux-shots/` (gitignored). The timeout-dialog capture uses
  `page.clock` in a separate test — a frozen clock stalls framer-motion fades, so the
  main walk runs unclocked with a 350ms settle before each shot.
- Definition of done for this round: after implementation, re-run the capture, review
  the PNGs against the approved mockups, fix discrepancies, and only then run the final
  review. Selector updates to the capture spec are part of implementation.

## Error handling

No changes to error paths. The NavMenu is purely client-side; navigation failures are
not a failure mode (routes are static).

## Testing

- **Vitest:** AuthenticatedLayout shell (header + outlet inside one section; dialog
  still wired); NavMenu (opens, lists 4 destinations, navigates + closes, Escape closes,
  outside-click closes, current route highlighted via `aria-current`); Statement row
  short-id rendering (+ full id in `title`); Receipt body single-action;
  `useExitSession` toast pair (moved from Receipt.test).
- **Playwright:** main spec gains a cross-screen jump (Withdraw → title menu →
  Mini-statement, no Menu bounce). `ux-screenshots.spec.ts` selectors updated as needed.
- **Gates:** `npm run lint` (zero warnings), `npm run typecheck` (`tsc -b`),
  `npm run test`, `npm run build`, `npm run e2e`, then the screenshot re-capture +
  review pass.

## Out of scope

- Backend changes; statement error-state redesign (pre-existing gap, still tracked);
  focus trap in the timeout dialog; Shona translation review (TODO(sn) markers remain);
  tap-to-expand full tx-id on rows (YAGNI until asked).
