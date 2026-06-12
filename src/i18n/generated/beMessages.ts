// GENERATED from BE ErrorCode.java + i18n bundle — DO NOT EDIT
// Run `npm run i18n:gen` to regenerate when ErrorCode.java or messages*.properties changes.
// Source: be/java/spring/bank-withdrawal/src/main/java/.../exception/ErrorCode.java
//         be/java/spring/bank-withdrawal/src/main/resources/i18n/messages*.properties
//
// Wire-code collisions: when multiple ErrorCode enum constants share one wire code
// (e.g. IDEMPOTENCY_UNRESOLVED / IDEMPOTENCY_REPLAY_MISMATCH / IDEMPOTENCY_IN_PROGRESS
// all collapse to "IDEMPOTENCY_CONFLICT"), the entry carries a `variants` map keyed by
// messageKey so runtime callers can pick the right text via BE's error.message.
// Top-level en/sn hold the FIRST variant for callers that don't need disambiguation.

export type BeMessageKey =
  | 'ACCOUNT_NOT_FOUND'
  | 'CARD_NOT_FOUND'
  | 'PIN_INVALID'
  | 'TRANSACTION_NOT_FOUND'
  | 'INSUFFICIENT_FUNDS'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VALIDATION_FAILED'
  | 'MISSING_HEADER'
  | 'INVALID_PARAMETER'
  | 'UNSUPPORTED_API_VERSION'
  | 'MISSING_API_VERSION'
  | 'MALFORMED_BODY'
  | 'CONCURRENT_MODIFICATION'
  | 'DATA_INTEGRITY_VIOLATION'
  | 'RESOURCE_NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'AMOUNT_REQUIRED'
  | 'AMOUNT_POSITIVE'
  | 'AMOUNT_DIGITS'
  | 'SORT_UNSUPPORTED'

export type BeMessageEntry =
  | { en: string; sn: string }
  | { variants: Record<string, { en: string; sn: string }>; en: string; sn: string }

export const beMessages: Record<BeMessageKey, BeMessageEntry> = {
  ACCOUNT_NOT_FOUND: { en: "Account {0} not found", sn: "Akaundi {0} haina kuwanikwa" },
  CARD_NOT_FOUND: { en: "Card not recognised", sn: "Kadhi harizivikanwi" },
  PIN_INVALID: { en: "Incorrect PIN", sn: "PIN isina kururama" },
  TRANSACTION_NOT_FOUND: { en: "Transaction {0} not found", sn: "Kutengeserana {0} hakuna kuwanikwa" },
  INSUFFICIENT_FUNDS: { en: "Insufficient funds for withdrawal", sn: "Mari haikwane kubvisa" },
  // IDEMPOTENCY_UNRESOLVED, IDEMPOTENCY_REPLAY_MISMATCH, IDEMPOTENCY_IN_PROGRESS all collapse to this wire code.
  // variants is keyed by messageKey; callers can match error.message for exact disambiguation.
  // Top-level en/sn = first variant (IDEMPOTENCY_UNRESOLVED).
  IDEMPOTENCY_CONFLICT: {
    variants: {
      // IDEMPOTENCY_UNRESOLVED
      "error.idempotency.unresolved": { en: "Idempotency-Key {0} could not be resolved", sn: "Idempotency-Key {0} haina kugona kuwanikwa" },
      // IDEMPOTENCY_REPLAY_MISMATCH
      "error.idempotency.replay-mismatch": { en: "Idempotency-Key {0} was already used with a different request", sn: "Idempotency-Key {0} yakatoshandiswa nechikumbiro chakasiyana" },
      // IDEMPOTENCY_IN_PROGRESS
      "error.idempotency.in-progress": { en: "A request with Idempotency-Key {0} is already in progress", sn: "Chikumbiro chine Idempotency-Key {0} chiri kutoitwa" },
    },
    en: "Idempotency-Key {0} could not be resolved",
    sn: "Idempotency-Key {0} haina kugona kuwanikwa",
  },
  VALIDATION_FAILED: { en: "Request validation failed", sn: "Kuongororwa kwechikumbiro kwakundikana" },
  MISSING_HEADER: { en: "Required header '{0}' is missing", sn: "Musoro unodiwa '{0}' haupo" },
  INVALID_PARAMETER: { en: "Parameter '{0}' has an invalid value", sn: "Paramita '{0}' ine kukosha kusiriko" },
  UNSUPPORTED_API_VERSION: { en: "API version '{0}' is not supported", sn: "Vhezheni ye-API '{0}' haitsigirwe" },
  MISSING_API_VERSION: { en: "An API version is required", sn: "Vhezheni ye-API inodiwa" },
  MALFORMED_BODY: { en: "Malformed request body", sn: "Muviri wechikumbiro wakakanganisika" },
  CONCURRENT_MODIFICATION: { en: "The resource was modified concurrently; retry", sn: "Chinhu chakachinjwa panguva imwe chete; edza zvakare" },
  DATA_INTEGRITY_VIOLATION: { en: "The request conflicts with existing data", sn: "Chikumbiro chinopesana neruzivo rwuripo" },
  RESOURCE_NOT_FOUND: { en: "No resource at the requested path", sn: "Hapana chinhu panzira yakakumbirwa" },
  INTERNAL_ERROR: { en: "An unexpected error occurred", sn: "Pane chikanganiso chisingatarisirwi chakaitika" },
  AMOUNT_REQUIRED: { en: "Amount is required", sn: "Mari inodiwa" },
  AMOUNT_POSITIVE: { en: "Amount must be greater than zero", sn: "Mari inofanira kupfuura ziro" },
  AMOUNT_DIGITS: { en: "Amount must have at most {integer} integer digits and {fraction} fraction digits", sn: "Mari inofanira kuva nemanhamba asingapfuuri {integer} pamberi pepoindi ne{fraction} mushure" },
  SORT_UNSUPPORTED: { en: "must be one of: {list}", sn: "inofanira kuva imwe ye: {list}" },
} as const

export type Locale = 'en' | 'sn'

/**
 * Look up a localized BE message by wire code + locale.
 *
 * For collapsed wire codes (with variants), pass the raw BE `error.message` as
 * `beMessage` — when it matches a variant key the exact localized text is returned.
 * Falls back to the top-level en/sn when no variant matches or beMessage is omitted.
 * Returns undefined when the wire code is not in the catalogue.
 */
export function getBeMessage(code: string, locale: Locale, beMessage?: string): string | undefined {
  if (!(code in beMessages)) return undefined
  const entry = beMessages[code as BeMessageKey] as BeMessageEntry
  if ('variants' in entry && beMessage !== undefined) {
    const variant = (entry as { variants: Record<string, { en: string; sn: string }> }).variants[beMessage]
    if (variant) return variant[locale] ?? variant.en
  }
  return entry[locale] ?? entry.en
}
