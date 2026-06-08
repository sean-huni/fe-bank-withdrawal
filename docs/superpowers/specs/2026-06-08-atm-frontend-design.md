# ATM Frontend (`fe-back-withdrawal`) — Design Spec

- **Date:** 2026-06-08
- **Status:** Approved design → ready for implementation plan
- **Author:** Sean (with Claude Code, WAT workflow)
- **Spans two repos:**
  - `be/java/spring/bank-withdrawal` — small backend addition (the "card" endpoint)
  - `fe/react/fe-back-withdrawal` — **new** React ATM frontend (does not yet exist)

---

## 1. Context & Goal

Build a browser frontend that **looks and behaves like an ATM**, talking to the existing
`bank-withdrawal` Spring Boot 4 banking API (withdraw / deposit / statement / single
transaction). It learns its stack and emoji-forward personality from `the-drop-fe`, and ships
first-class **observability** (OpenTelemetry → Grafana LGTM, with Prometheus/Grafana surfaced in
a dev banner).

The brief originally named `the-drop-be` as the backend, but that is a skydiving
session-management service with no accounts/balances. The real banking API is `bank-withdrawal`
(this repo); `the-drop-fe`/`the-drop-be` serve only as the **style + stack reference**.

### Success criteria
1. A user can: insert a card → enter PIN → see balance → withdraw → deposit → view a
   mini-statement → take a receipt → end session, all in an ATM-styled UI.
2. Withdrawals/deposits are **idempotent** (safe retries, no double-debit).
3. Errors map to friendly, emoji-led ATM messages driven by the backend's **wire-stable error
   codes**, with localized (EN/SN) message text.
4. Frontend telemetry (web-vitals + custom ATM metrics) flows to the same LGTM stack the backend
   uses; Grafana/Prometheus are reachable from an in-app dev banner; a provisioned Grafana
   dashboard shows the ATM stats out of the box.

---

## 2. Decisions (locked during brainstorming)

| Topic | Decision |
|---|---|
| Backend target | `bank-withdrawal` API (not `the-drop-be`) |
| FE location | New sibling repo `/Users/sean/env/repo/fe/react/fe-back-withdrawal` |
| Scope | Full-but-simple ATM: balance · withdraw · deposit · mini-statement · receipt |
| Card model | **Friendly 16-digit card number** (Luhn-valid), seeded & stable across DB resets |
| Backend change | Add a card-lookup / balance-inquiry endpoint (+ `card_number` column) |
| PIN | Cosmetic ATM theater (any 4 digits) — backend has no PIN concept |
| Style reference | `the-drop-fe` — dark glassmorphism, emoji-forward |
| Stack | React 19 + Vite + Tailwind 4 + TanStack Query + Zustand + Axios + RHF/Zod + framer-motion + OpenTelemetry |
| Observability | OTel browser → OTLP `:4318` (LGTM); in-app dev banner → Grafana `:3000` / Prometheus `:9090` / Swagger; provisioned Grafana dashboard |
| i18n | EN + SN (Shona) toggle; backend serves localized errors via `Accept-Language` |
| Dev networking | Vite dev proxy `/api → localhost:8080` (sidesteps CORS) |

---

## 3. Backend changes (`bank-withdrawal`)

A real ATM is **balance-first**: the user inserts a card and is greeted with their balance. The
current API exposes balance only as `balanceAfter` on a transaction, so a freshly-seeded account
(Alice €1000, Bob €250.50) with an empty ledger has no readable balance. We close that gap with
one small, idiomatic read endpoint, and add a stable **friendly card number** so the demo
survives DB resets (account UUIDs are `gen_random_uuid()` and change every reseed).

### 3.1 New endpoint — card lookup / balance inquiry

```
GET /api/{api-version}/cards/{cardNumber}
→ 200 ApiResponse<AccountResponse>
     { accountId, holderName, maskedCardNumber, balance, currency }
→ 404 CARD_NOT_FOUND     (new ErrorCode + i18n message, EN + SN)
→ 400 VALIDATION_FAILED  (malformed card number — fails the 16-digit format constraint; field violation on `cardNumber`)
```

- `cardNumber` path variable is **digits-only (16 digits)** — the FE normalizes any space-grouping
  client-side (`normalizeCard`) before calling, since a URL path segment carries no spaces (so the
  server keeps a strict `@Pattern(\d{16})` rather than normalizing). A constraint on the path var
  yields a **400 `VALIDATION_FAILED`** (handler-method-validation → advice, field violation on
  `cardNumber`); a well-formed-but-unknown number yields **404 `CARD_NOT_FOUND`**.
- The FE uses the returned **`accountId`** for all subsequent transaction calls (which remain
  keyed by `accountId`). `maskedCardNumber` (e.g. `•••• •••• •••• 6467`) is for display/receipts;
  the full PAN is never returned.
- This endpoint also serves **balance refresh** (the FE re-fetches it after a transaction, or
  updates the cache from the txn response's `balanceAfter` — see §5).

> REST shape note: a sibling resource `/cards/{cardNumber}` is cleaner than overloading
> `/accounts/{accountId}` (different identifier, different lookup). It lives in a new lean
> `CardController` mirroring `AccountTransactionController` conventions (thin handler → service →
> `ApiResponse` envelope → `traceId`).

### 3.2 Pieces to add (house rules: controller → service → mapper, dto/domain/model split)

- **Liquibase** `db/changelog/changes/004-add-card-number-to-accounts.sql`:
  - `ALTER TABLE accounts ADD COLUMN card_number VARCHAR(16);`
  - Backfill seeded rows by `holder_name` with **deterministic, Luhn-valid** numbers:
    - Alice → `4539148803436467`
    - Bob   → `6011000990139424`
  - `ALTER TABLE accounts ALTER COLUMN card_number SET NOT NULL;`
  - `CREATE UNIQUE INDEX uk_accounts_card_number ON accounts (card_number);`
  - `--rollback` lines for each change.
  - (No account-creation endpoint exists, so NOT NULL/UNIQUE is safe after backfill.)
- **`AccountEntity`** (`jdbc/model`): add `@Column("card_number") private String cardNumber;`
  with `@NotBlank` + `@Pattern(regexp="\\d{16}")`, plus an all-args constructor update.
- **`AccountRepo`**: add `Optional<AccountEntity> findByCardNumber(String cardNumber);`
  (read-only; the no-load-and-save warning in the class javadoc still holds — we never `save()`).
- **`AccountResponse`** DTO record (`api/dto/resp`): `accountId, holderName, maskedCardNumber,
  balance, currency` with `@Schema` docs.
- **`AccountMapper`** (`mapper`, MapStruct, `componentModel = SPRING`): `AccountEntity →
  AccountResponse`; `id → accountId`; a `@Named` masking method maps `cardNumber →
  maskedCardNumber` (keep last 4, mask the rest, grouped).
- **Service**: a small dedicated `CardService` with
  `lookup(@Pattern(\d{16}) String cardNumber)` → `findByCardNumber` → map →
  throw `CardNotFoundException` if absent. Annotate `@Observed(name = "card.lookup")`,
  `@Transactional(readOnly = true)`, `@Validated`.
- **`CardNotFoundException`** + **`ErrorCode.CARD_NOT_FOUND("error.card.not-found")`** +
  advice mapping to **404** (mirror `AccountNotFoundException`). The card-number arg is **not**
  echoed in the message (avoid leaking a probed PAN) — message is generic "card not recognised".
- **i18n**: add `error.card.not-found` to `messages.properties` (EN) **and**
  `messages_sn.properties` (SN). The existing `MessageCatalogCompletenessTest` enforces parity —
  it will fail if SN is missing.
- **`CardController`**: `GET /api/{api-version}/cards/{cardNumber}` with `@Operation`/`@Tag`,
  `@ResponseStatus` defaults, `ApiResponse` envelope + `traceIdProvider`.
- **OpenAPI**: the existing `OpenApiCustomizer` that substitutes `{api-version}` must also cover
  the new path (verify the customizer is path-agnostic; adjust if it enumerates paths).
- **Dev banner** (`DevTestDataLogger`): print each account's **card number** alongside
  id/holder/balance, and add a `curl` example hitting `/cards/{cardNumber}`. Update
  `DevTestDataLoggerTest` (Logback `ListAppender`) to assert the card line appears.

### 3.3 Backend tests (TDD, real-HTTP)
- **Cucumber** (`@Tag` per repo convention): card lookup **positive** (valid seeded card → 200,
  correct holder/balance/currency, masked number) and **negative** (unknown well-formed card →
  404 `CARD_NOT_FOUND`; malformed card → 400 `VALIDATION_FAILED`, violation on `cardNumber`).
- **i18n**: one scenario asserting the SN `error.card.not-found` text via `Accept-Language: sn`,
  plus the completeness test (already present) now covering the new key.
- All existing tests stay green.

---

## 4. Frontend architecture (`fe-back-withdrawal`)

### 4.1 Model: a screen **state machine**
The ATM is a guarded linear flow. React Router routes with a **session guard** (no active card →
redirect to Welcome):

```
/            Welcome / Insert card   (card number entry + saved cards)
/pin         PIN keypad              (cosmetic, 4 digits)
/menu        Main menu               (Balance · Withdraw · Deposit · Statement · Exit)
/balance     Balance inquiry
/withdraw    Withdraw                (quick-cash chips + custom)
/deposit     Deposit
/statement   Mini-statement          (paged, newest first)
/receipt     Receipt                 (another transaction · end session)
```

A **session-timeout** hook auto-ejects the card after inactivity (real-ATM touch). framer-motion
drives screen transitions.

### 4.2 Directory structure (mirrors `the-drop-fe`, trimmed)
```
src/
  api/         client.ts (axios: baseURL, Accept-Language, Idempotency-Key), atm.ts (endpoints)
  stores/      sessionStore.ts (active card→accountId, label, startedAt),
               cardsStore.ts (saved cards: {cardNumber,label}; zustand persist→localStorage)
  screens/     Welcome, Pin, Menu, Balance, Withdraw, Deposit, Statement, Receipt
  components/  Keypad, AmountPad, Money, ScreenFrame, DevBanner, LanguageToggle, Toasts, CardTile
  hooks/       useCardLookup, useBalance, useStatement, useWithdraw, useDeposit, useSessionTimeout
  telemetry/   index.ts (OTel init + custom ATM metrics)
  i18n/        en.ts, sn.ts (mirror backend error keys for shared messages)
  config/      env.ts, currency.ts, quickCash.ts
  lib/         luhn.ts, idempotency.ts, errorMap.ts
```

### 4.3 Stack (from `the-drop-fe`, ATM-trimmed)
React 19 · Vite · TypeScript · Tailwind 4 (reuse design tokens: brand/cyan/purple surfaces,
Outfit / Space Grotesk / JetBrains Mono) · TanStack Query (server state) · Zustand+persist
(client/session state) · Axios · React Hook Form + Zod (amount + card validation) ·
react-hot-toast · framer-motion · OpenTelemetry browser SDK · Vitest + RTL + Playwright.

**Dropped vs `the-drop-fe`** (YAGNI): WebSockets/STOMP, passkeys/WebAuthn, signature pad,
multi-role pages, OAuth.

---

## 5. Data flow & API integration

Base path `/api/v1` (configurable `VITE_API_VERSION=v1`). Dev calls go through the **Vite proxy**
to `http://localhost:8080`, so no CORS dance.

| Action | Call |
|---|---|
| Insert card | `GET /api/v1/cards/{cardNumber}` → store `accountId`, greet by `holderName`, show `balance` |
| Balance | reuse the card-lookup response; refresh by re-fetching `/cards/{cardNumber}` |
| Withdraw | `POST /api/v1/accounts/{accountId}/withdrawals` `{amount}` + `Idempotency-Key` |
| Deposit | `POST /api/v1/accounts/{accountId}/deposits` `{amount}` + `Idempotency-Key` |
| Statement | `GET /api/v1/accounts/{accountId}/transactions?page=&size=&sort=createdAt,desc` |

- **Idempotency:** a fresh `crypto.randomUUID()` is generated when the user **confirms** an
  amount and is **kept for all retries of that same operation** (stored on the in-flight mutation,
  not regenerated on retry) — guarantees no double-debit. A new operation gets a new key.
- **Balance after a txn:** the withdraw/deposit response carries `balanceAfter`; the mutation's
  `onSuccess` writes it into the balance cache, so the receipt and menu show the new balance with
  no extra round-trip.
- **Amount validation (Zod):** positive, ≤ 2 decimal places, ≤ 15 integer digits (matches
  backend `@Digits(integer=15, fraction=4)`); withdrawals additionally pre-checked against the
  known balance for a friendly client-side message (server remains the source of truth).
- **Card validation (Zod + Luhn):** 16 digits, Luhn-valid, before calling the backend — catches
  typos without a round-trip.

---

## 6. Error handling

Branch on the **wire-stable `error.code`** (never message text); display the backend's
**localized** `error.message` as the subtitle.

| HTTP / code | ATM message |
|---|---|
| `404 CARD_NOT_FOUND` | 💳 Card not recognised |
| `404 ACCOUNT_NOT_FOUND` | 💳 Account unavailable |
| `422 INSUFFICIENT_FUNDS` | 💸 Not enough funds — your balance is € … |
| `400 VALIDATION_FAILED` / `violations` | inline error on the amount/card field |
| `409 IDEMPOTENCY_CONFLICT` (any of the trio) | ⏳ Already processing — one moment |
| network / timeout | 📡 Can't reach the bank — try again |

A central `errorMap.ts` turns `{httpStatus, code, message, violations}` into
`{emoji, title, detail, recoverable}`.

---

## 7. Card number & PIN model

- **Card number** = the user-facing identifier (16 digits, grouped `#### #### #### ####`).
  Seeded deterministically (Alice `4539 1488 0343 6467`, Bob `6011 0009 9013 9424`) so demo
  cards are **stable across DB resets** — a real win over the random account UUIDs.
- **Saved cards**: after a successful lookup, the FE offers to save the card with a friendly
  label (e.g. "Alice") in localStorage (`cardsStore`), masked to last-4 in the UI, for one-tap
  re-entry. Stored value is the card number only (no PIN, no balance).
- **PIN**: a 4-digit keypad for authentic feel; **not** validated by the backend (it has no PIN).
  Any 4 digits proceed. Documented as cosmetic so no one mistakes it for real auth.

---

## 8. Observability (requirement #4)

- **OTel browser SDK** → OTLP HTTP `http://localhost:4318` (the same LGTM container the backend
  exports to). Auto-instrumentation: document load, fetch/XHR spans (so ATM calls correlate with
  backend traces by `traceId`), route changes, JS errors, web-vitals (LCP/FCP/CLS/TTFB/INP).
- **Custom ATM metrics:**
  - `atm_session_started_total`
  - `atm_card_lookup_total{result=success|not_found|error}`
  - `atm_balance_inquiry_total`
  - `atm_withdrawal_total{result=success|insufficient_funds|error}`
  - `atm_deposit_total{result=success|error}`
  - `atm_txn_duration` (histogram, by operation)
- **In-app DevBanner** (dev-only, dismissible): links Grafana `:3000`, Prometheus `:9090`,
  backend Swagger `:8080/swagger-ui.html`; shows the active card label + masked number + the
  current Idempotency-Key. URLs read from `VITE_*` env with the same defaults the backend banner
  uses, so both stay consistent.
- **Provisioned Grafana dashboard**: ship `observability/grafana/atm-frontend-dashboard.json`
  (panels for the custom metrics + web-vitals) so the stats are visible out of the box. README
  documents importing it (or dropping it into the LGTM provisioning dir).

---

## 9. i18n

EN + SN toggle (`LanguageToggle`), default EN, persisted in localStorage. The selected locale is
sent as `Accept-Language` on every request so backend error text returns localized. FE-owned
strings (screen labels, button text) live in `i18n/en.ts` / `i18n/sn.ts`; the shared **error**
strings mirror the backend message keys so the two catalogs agree. SN strings get the same
"machine-drafted, native review pending" caveat as the backend bundle.

---

## 10. Testing (TDD)

- **Unit/component (Vitest + RTL):** Keypad & AmountPad behavior; Luhn validation; Zod amount
  rules; `balanceAfter` cache update; `errorMap` code→message; idempotency-key generated once and
  reused on retry; session-timeout eject.
- **E2E (Playwright):** full flow insert card → PIN → balance → withdraw → receipt against a
  **mocked** API (deterministic), plus one **happy-path smoke** wired to the real backend
  (`docker compose up` + `bootRun`) to prove the contract.
- **CI:** lint + typecheck + unit + Playwright (mocked) on every push; the live-backend smoke is
  opt-in.

---

## 11. Non-goals (YAGNI)
Real authentication/authorization; real PIN verification; account creation/management; transfers
between accounts; multi-currency conversion; WebSockets/live updates; passkeys; printing;
mobile-native. (Most are absent from the backend by design.)

---

## 12. Risks & mitigations
- **Backend scope creep** → keep the addition to exactly one read endpoint + one column + tests.
- **`OpenApiCustomizer` path handling** → verify it substitutes `{api-version}` for the new path;
  fix if it enumerates a fixed path list.
- **Card number leakage** → never return the full PAN; never echo it in error messages or logs.
- **DB reseed changes UUIDs** → mitigated: the FE keys the demo on the **stable card number**, not
  the UUID; the dev banner prints both.
- **Telemetry noise** → custom metrics are low-cardinality (`result` label only); no PANs/UUIDs as
  metric labels.

---

## 13. Phasing (drives the implementation plan)
1. **Backend phase (`bank-withdrawal`)** — migration → entity/repo → DTO/mapper →
   exception/ErrorCode/i18n → service → `CardController` → OpenAPI → dev banner → Cucumber +
   i18n tests green. (FE depends on this contract.)
2. **Frontend phase (`fe-back-withdrawal`)** — scaffold (Vite/React/TS/Tailwind, Vite proxy) →
   api client + idempotency + errorMap → stores → telemetry → screens & components (TDD) →
   i18n → dev banner → Grafana dashboard → Playwright E2E → README.
