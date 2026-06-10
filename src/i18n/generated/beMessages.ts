// GENERATED from the BE i18n bundle (single source of truth) — DO NOT EDIT
// Run `npm run i18n:gen` to regenerate when messages*.properties changes.
// Source: be/java/spring/bank-withdrawal/src/main/resources/i18n/messages*.properties

export type BeMessageKey =
  | 'ACCOUNT_NOT_FOUND'
  | 'CARD_NOT_FOUND'
  | 'CARD_INVALID'
  | 'PIN_INVALID'
  | 'PIN_INVALID_FORMAT'
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

export const beMessages = {
  ACCOUNT_NOT_FOUND: { en: "Account {0} not found", sn: "Akaundi {0} haina kuwanikwa" },
  CARD_NOT_FOUND: { en: "Card not recognised", sn: "Kadhi harizivikanwi" },
  CARD_INVALID: { en: "Card number must be 16 digits", sn: "Nhamba yekadhi inofanira kuva nemadhijiti gumi nematanhatu" },
  PIN_INVALID: { en: "Incorrect PIN", sn: "PIN isina kururama" },
  PIN_INVALID_FORMAT: { en: "PIN must be 4 digits", sn: "PIN inofanira kuva nemadhijiti mana" },
  TRANSACTION_NOT_FOUND: { en: "Transaction {0} not found", sn: "Kutengeserana {0} hakuna kuwanikwa" },
  INSUFFICIENT_FUNDS: { en: "Insufficient funds for withdrawal", sn: "Mari haikwane kubvisa" },
  IDEMPOTENCY_CONFLICT: { en: "A request with Idempotency-Key {0} is already in progress", sn: "Chikumbiro chine Idempotency-Key {0} chiri kutoitwa" },
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
} as const satisfies Record<BeMessageKey, { en: string; sn: string }>

export type Locale = keyof (typeof beMessages)[BeMessageKey]

/**
 * Look up a localized BE message by wire code + locale.
 * Falls back to the English message when the locale has no entry.
 */
export function getBeMessage(code: string, locale: Locale): string | undefined {
  if (!(code in beMessages)) return undefined
  return beMessages[code as BeMessageKey][locale] ?? beMessages[code as BeMessageKey].en
}
