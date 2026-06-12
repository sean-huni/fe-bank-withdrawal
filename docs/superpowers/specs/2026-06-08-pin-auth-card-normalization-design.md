# PIN Auth, Card Normalization & Auto-Submit — Design Spec

- **Date:** 2026-06-08
- **Status:** Approved design → ready for implementation plan
- **Author:** Sean (with Claude Code, WAT workflow)
- **Spans two repos (one feature, two phases — backend first):**
  - `be/java/spring/bank-withdrawal` — normalize cards into their own table, BCrypt PIN, PIN-verify endpoint, balance gating
  - `fe/react/fe-bank-withdrawal` — auto-submit PIN/card, two-phase auth flow, session/balance rework

---

## 1. Context & Goal

Two linked improvements to the ATM built earlier (both repos currently on `dev`):

1. **UX:** remove explicit confirmation from the login journey — the PIN authenticates the instant
   the 4th digit is entered (keypad tap or keyboard), and a card submits the instant a valid
   16-digit Luhn number is entered (no "Insert card" press).
2. **Auth/data model:** the demo PIN becomes a *real* server-verified secret, stored BCrypt-hashed,
   and card data is normalized out of the `accounts` table into a dedicated `cards` table — laying
   the groundwork for Spring Security / WebAuthn in the near future. Balance inquiry moves behind a
   verified PIN.

### Success criteria
1. Typing the 4th PIN digit (any input method) authenticates with no Enter; a valid 16-digit card
   auto-submits with no button press.
2. `accounts` no longer holds card data; a `cards` table holds `card_number` + BCrypt `pin_hash`,
   1:1 with an account.
3. The PIN is verified server-side via `BCryptPasswordEncoder.matches(rawPin, storedHash)`; the raw
   PIN travels only over HTTPS and is never logged or sent to telemetry.
4. Balance + `accountId` are returned **only** from the authenticated PIN-verify response; the open
   card lookup returns just the holder greeting.

---

## 2. Decisions (locked during brainstorming)

| Topic | Decision |
|---|---|
| PIN auto-submit | Fires when the 4th digit lands (keypad or keyboard); Enter still works as a no-op fallback |
| Card auto-submit | Fires when `isValidCardNumber` first turns true (16 Luhn digits); Insert button kept as fallback |
| Card data | Normalized into a new `cards` table (1:1 with `accounts`); `accounts.card_number` dropped |
| PIN storage | `cards.pin_hash` = `BCrypt("1234")` for all seeded cards (demo PIN 1234) |
| PIN transport/verify | FE sends **raw** PIN over HTTPS; backend `encoder.matches(rawPin, storedHash)` (NOT hash-equality) |
| Balance gating | Balance + `accountId` only from the authenticated verify response; open lookup = greeting only |
| Crypto dep | `spring-security-crypto` (encoder only, not the full security starter) |

---

## 3. Backend design (`bank-withdrawal`)

### 3.1 Migration `005-normalize-cards.sql`
```sql
--changeset sean:005-create-cards-table
CREATE TABLE cards (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id  UUID         NOT NULL UNIQUE REFERENCES accounts (id),
    card_number VARCHAR(16)  NOT NULL UNIQUE,
    pin_hash    VARCHAR(72)  NOT NULL,            -- BCrypt is 60 chars; 72 gives headroom
    version     BIGINT       NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
--rollback DROP TABLE cards;

--changeset sean:005-migrate-card-data
-- Backfill one card per existing account; all seeded cards share BCrypt("1234").
-- <BCRYPT_1234> is a precomputed cost-10 hash embedded as a literal (see 3.3).
INSERT INTO cards (account_id, card_number, pin_hash)
SELECT id, card_number, '<BCRYPT_1234>' FROM accounts;
--rollback DELETE FROM cards;

--changeset sean:005-drop-account-card-number
DROP INDEX IF EXISTS uk_accounts_card_number;
ALTER TABLE accounts DROP COLUMN card_number;
--rollback ALTER TABLE accounts ADD COLUMN card_number VARCHAR(16);
```
Register in `db.changelog-master.yaml` after 004.

### 3.2 Model & repo
- New `CardEntity` (`jdbc/model`) extending `BaseEntity`: `accountId` (UUID), `cardNumber`
  (`@NotBlank @Pattern(\d{16})`), `pinHash` (`@NotBlank`). `@Table("cards")`.
- `CardRepo extends CrudRepository<CardEntity, UUID>`: `Optional<CardEntity> findByCardNumber(String)`.
- **Revert** the `cardNumber` field added to `AccountEntity` in the 004 work (back to the 3-arg
  constructor). Fix call sites: `AccountTransactionSteps` (drop `nextCardNumber()`/4-arg ctor),
  `StatementQueryCountTest`, `DevTestDataLoggerTest`, and `DevTestDataLogger` (now reads `CardRepo`).

### 3.3 Crypto
- Add dependency `org.springframework.security:spring-security-crypto` (version via Boot BOM; no
  `gradle.properties` pin needed if BOM-managed — otherwise add `springSecurityCryptoVersion`).
- A `@Configuration` bean: `@Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }`
  (cost 10 default).
- **Precomputed seed hash:** generate `BCrypt("1234")` once (cost 10) and embed the literal as
  `<BCRYPT_1234>` in migration 005. Generate via a throwaway: `new BCryptPasswordEncoder().encode("1234")`,
  or `htpasswd -bnBC 10 "" 1234 | tr -d ':\n'`. A test (3.6) asserts
  `encoder.matches("1234", <that literal>)` so a wrong paste fails loudly.

### 3.4 DTOs
- `CardSummaryResponse` (`api/dto/resp`, record): `{ holderName, maskedCardNumber }` — the open
  lookup / greeting. **No balance, no accountId.**
- Reuse the existing `AccountResponse { accountId, holderName, maskedCardNumber, balance, currency }`
  for the authenticated verify response. **Mapper consequence:** `cardNumber` no longer lives on
  `AccountEntity`, so `AccountMapper.toAccountResponse` can no longer source `maskedCardNumber` from
  the account. Change it to compose from **both** inputs — e.g.
  `toAccountResponse(AccountEntity account, String cardNumber)` (mask `cardNumber` via the existing
  `@Named maskCard`) — and have `CardService.verifyPin` pass the `CardEntity.cardNumber`.
- `PinVerifyRequest` (`api/dto/req`, record): `{ @NotBlank @Pattern(\d{4}) String pin }`.

### 3.5 Service & endpoints
`CardService` (refactored):
- `summary(String cardNumber)` → `CardSummaryResponse` (find card → map holder + masked); 404
  `CARD_NOT_FOUND` if absent. `@Transactional(readOnly = true)`, `@Observed(name="card.summary")`.
- `verifyPin(String cardNumber, String rawPin)` → `AccountResponse`: find card (404 if absent) →
  `passwordEncoder.matches(rawPin, card.getPinHash())`; on false throw `PinInvalidException` (401);
  on true load the account (`AccountRepo.findById(card.getAccountId())`) and map the full snapshot
  (incl. balance). `@Transactional(readOnly = true)`, `@Observed(name="card.pin.verify")`. **Never
  log the PIN.**

`CardController` (`/api/{api-version}/cards`):
- `GET /{cardNumber}` → `ApiResponse<CardSummaryResponse>` (greeting). 404 / 400 (malformed) as before.
- `POST /{cardNumber}/pin` `@Valid @RequestBody PinVerifyRequest` → `ApiResponse<AccountResponse>`;
  201? No — use **200** (it's a verification, not resource creation). 401 on bad PIN, 404 unknown
  card, 400 malformed pin/card.

### 3.6 Errors, i18n, advice
- `ErrorCode.PIN_INVALID("error.pin.invalid")`; `PinInvalidException extends ApiException` (no PIN
  in the args/message — never echo the secret).
- Advice: `@ExceptionHandler(PinInvalidException.class) @ResponseStatus(UNAUTHORIZED)` → 401.
- i18n EN: `error.pin.invalid=Incorrect PIN`; SN: `error.pin.invalid=PIN isina kururama` (machine-drafted,
  review pending). Completeness test covers it.

### 3.7 Dev banner
`DevTestDataLogger` now reads cards from `CardRepo` (inject it). The "ATM cards" line maps each
card's `cardNumber` to its account's holder (join in-memory). PIN line stays `1234` (now real, not
cosmetic). Update `DevTestDataLoggerTest` accordingly.

### 3.8 Backend tests (Cucumber, real-HTTP)
- Card summary (known card → 200 holder + masked, **no balance field**); unknown → 404.
- PIN verify: correct `1234` → 200 with balance + accountId; wrong PIN → 401 `PIN_INVALID`;
  unknown card → 404; malformed pin → 400.
- i18n: `PIN_INVALID` resolves in SN via `Accept-Language: sn`.
- Migration: a query/assertion that `accounts` has no `card_number` column and `cards` has the
  seeded rows with a hash that verifies `1234`.
- Unit: `encoder.matches("1234", <BCRYPT_1234 literal>)` is true (guards the seed).
- Update existing card-lookup scenarios (balance assertions move to the verify scenario).

---

## 4. Frontend design (`fe-bank-withdrawal`)

### 4.1 Auto-submit
- **Welcome:** auto-fire the lookup when `isValidCardNumber(normalizeCard(value))` first becomes
  true (guard a `submitted` ref to fire once; re-arm if the value changes). Keep the "Insert card"
  button as an explicit fallback.
- **Pin:** a `useEffect` watching `pin.length === 4` calls `verify()` once (guard against
  double-submit while the mutation is in flight; reset the guard on error so the user can retry).
  The on-screen Enter and keyboard Enter remain wired to the same `verify()` (harmless no-op once
  auto-fired).

### 4.2 Two-phase auth flow & session
- `sessionStore` gains a **pending** phase: after lookup, store `{ pendingCardNumber, pendingHolderName }`;
  the full `account` (with balance) is set only by `signIn(account)` after a successful PIN verify.
- `useCardLookup` (GET summary) → on success set pending + navigate `/pin`.
- New `useVerifyPin` mutation → `POST /cards/{cardNumber}/pin { pin }` → on success `signIn(account)`
  → `/menu`; on 401 → toast "🔐 Incorrect PIN", clear the PIN dots, re-arm auto-submit.
- `Pin` screen guard checks `pendingCardNumber` (not full `account`); `AuthenticatedLayout` continues
  to require the full `account` for `/menu`, `/balance`, etc.
- API: `src/api/atm.ts` — `lookupCard` now returns `CardSummary {holderName, maskedCardNumber}`;
  add `verifyPin(cardNumber, pin) → AccountSnapshot`.

### 4.3 Balance rework
- Balance now lives in `sessionStore.account.balance` (set at verify). Add a `sessionStore` action
  `patchBalance(balanceAfter: string)` that updates `account.balance`; `useWithdraw`/`useDeposit`
  `onSuccess` calls it with the txn's `balanceAfter`. **Remove** `usePatchBalance`, the `useBalance`
  query, and the open-lookup-for-balance path entirely (the TanStack balance cache is gone — balance
  is purely session-held now).
- `Balance` screen reads `sessionStore.account` directly (no network on mount); `atmMetrics.balanceInquiry()`
  still fires.

### 4.4 Telemetry
- Add `atm_pin_verify_total{result: success|invalid|error}`. The PIN value is NEVER a metric label
  or log field.

### 4.5 Frontend tests
- `Pin.test.tsx`: entering 4 digits auto-calls verify with **no Enter**; wrong-PIN (mock 401) shows
  the error and clears; the key is the raw 4-digit string.
- `Welcome.test.tsx`: typing/pasting a valid 16-digit Luhn number auto-fires the lookup once.
- `validation`/`luhn` already covered.
- Playwright mocked E2E updated to the lookup→verify sequence (mock `GET /cards/*` summary and
  `POST /cards/*/pin`).

---

## 5. Build order
1. **Backend** (`bank-withdrawal`, branch off `dev`): migration → `CardEntity`/`CardRepo` → revert
   `AccountEntity.cardNumber` + fix call sites → crypto bean + seed hash → DTOs → `CardService` →
   `CardController` (summary + pin) → errors/i18n → dev banner → Cucumber + unit. Green build.
2. **Frontend** (`fe-bank-withdrawal`, branch off `dev`): api client (summary + verifyPin) →
   sessionStore pending phase → hooks → auto-submit Welcome + Pin → balance rework → telemetry →
   tests + Playwright. Green build.

---

## 6. Non-goals (explicitly deferred to the near-future WebAuthn work)
- Failed-PIN **lockout / rate-limiting** (a real ATM locks after N tries) — note as a known gap.
- **Session tokens / Spring Security filter chain** — verify is a stateless check for now; no JWT/session.
- **Gating the transaction endpoints** — withdraw/deposit/statement remain open (keyed by `accountId`),
  exactly as today. Only balance moves behind the PIN. Full gating arrives with WebAuthn.
- Multi-card-per-account, card issuance/management endpoints.

---

## 7. Risks & notes
- **Re-touches the just-merged 004 card work** (removes `AccountEntity.cardNumber`, dev banner reads
  `CardRepo`, existing lookup scenarios change). Expected with normalization; the migration sequence
  (004 adds the column, 005 moves it out) is intentional and replays cleanly on a fresh DB.
- **Card number in the URL path** for both endpoints — it's an identifier, not the secret; the PIN
  is body-only and never logged. Production needs real HTTPS (dev uses the Vite proxy to `:8080`).
- **Balance has no authenticated refresh** (re-fetching would need the PIN again) — it's session-held
  and txn-patched. Acceptable for the demo; a real build would issue a short-lived session token.
- **Soft gating:** since transactions stay open, balance is still derivable via a tiny deposit's
  `balanceAfter`. Accepted limitation until full session gating (non-goal #3).
- **BCrypt cost 10** keeps verify fast for a demo; revisit with real auth.
