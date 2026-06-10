#!/usr/bin/env node
/**
 * gen-i18n.mjs — Generates src/i18n/generated/beMessages.ts from the BE
 * messages*.properties bundle.
 *
 * Usage:  node scripts/gen-i18n.mjs
 *         BE_I18N_DIR=/custom/path node scripts/gen-i18n.mjs
 *
 * When the BE directory is absent the committed file is left in place and
 * the script exits 0 (clean-clone rule: FE builds without the BE repo).
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..') // fe/react/fe-bank-withdrawal → env/repo

const DEFAULT_BE_I18N = resolve(REPO_ROOT, 'be/java/spring/bank-withdrawal/src/main/resources/i18n')
const BE_I18N_DIR = process.env.BE_I18N_DIR ?? DEFAULT_BE_I18N

const OUT_FILE = resolve(__dirname, '..', 'src', 'i18n', 'generated', 'beMessages.ts')

// ── ErrorCode enum: wire-code → message-key mappings ────────────────────────
// Derived from the BE ErrorCode.java enum (single source of truth).
// When the enum changes, regenerate by running: npm run i18n:gen
const ERROR_CODE_MAP = [
  { wireCode: 'ACCOUNT_NOT_FOUND',         messageKey: 'error.account.not-found' },
  { wireCode: 'CARD_NOT_FOUND',             messageKey: 'error.card.not-found' },
  { wireCode: 'CARD_INVALID',               messageKey: 'error.card.invalid' },
  { wireCode: 'PIN_INVALID',                messageKey: 'error.pin.invalid' },
  { wireCode: 'PIN_INVALID_FORMAT',         messageKey: 'error.pin.invalid-format' },
  { wireCode: 'TRANSACTION_NOT_FOUND',      messageKey: 'error.transaction.not-found' },
  { wireCode: 'INSUFFICIENT_FUNDS',         messageKey: 'error.funds.insufficient' },
  { wireCode: 'IDEMPOTENCY_CONFLICT',       messageKey: 'error.idempotency.in-progress' },
  { wireCode: 'VALIDATION_FAILED',          messageKey: 'error.validation.failed' },
  { wireCode: 'MISSING_HEADER',             messageKey: 'error.header.missing' },
  { wireCode: 'INVALID_PARAMETER',          messageKey: 'error.parameter.invalid' },
  { wireCode: 'UNSUPPORTED_API_VERSION',    messageKey: 'error.api-version.unsupported' },
  { wireCode: 'MISSING_API_VERSION',        messageKey: 'error.api-version.missing' },
  { wireCode: 'MALFORMED_BODY',             messageKey: 'error.body.malformed' },
  { wireCode: 'CONCURRENT_MODIFICATION',    messageKey: 'error.concurrency.conflict' },
  { wireCode: 'DATA_INTEGRITY_VIOLATION',   messageKey: 'error.data.integrity' },
  { wireCode: 'RESOURCE_NOT_FOUND',         messageKey: 'error.resource.not-found' },
  { wireCode: 'INTERNAL_ERROR',             messageKey: 'error.internal' },
  // Constraint violations (used as field-level violation codes)
  { wireCode: 'AMOUNT_REQUIRED',            messageKey: 'error.amount.required' },
  { wireCode: 'AMOUNT_POSITIVE',            messageKey: 'error.amount.positive' },
  { wireCode: 'AMOUNT_DIGITS',              messageKey: 'error.amount.digits' },
  { wireCode: 'SORT_UNSUPPORTED',           messageKey: 'error.sort.unsupported' },
]

// ── Properties parser ────────────────────────────────────────────────────────
/** @param {string} content raw .properties file text */
function parseProperties(content) {
  /** @type {Map<string, string>} */
  const map = new Map()
  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    // Java MessageFormat uses '' for a literal single-quote; normalise to '
    const value = line.slice(eq + 1).trim().replace(/''/g, "'")
    map.set(key, value)
  }
  return map
}

// ── Main ─────────────────────────────────────────────────────────────────────
if (!existsSync(BE_I18N_DIR)) {
  console.warn(
    `[gen-i18n] WARNING: BE i18n directory not found at:\n  ${BE_I18N_DIR}\n` +
    `  Leaving committed src/i18n/generated/beMessages.ts in place.\n` +
    `  To regenerate, set BE_I18N_DIR or clone the BE repo alongside this one.`
  )
  process.exit(0)
}

const enPath = resolve(BE_I18N_DIR, 'messages.properties')
const snPath = resolve(BE_I18N_DIR, 'messages_sn.properties')

if (!existsSync(enPath)) {
  console.error(`[gen-i18n] ERROR: messages.properties not found at ${enPath}`)
  process.exit(1)
}

const enBundle = parseProperties(readFileSync(enPath, 'utf8'))
const snBundle = existsSync(snPath) ? parseProperties(readFileSync(snPath, 'utf8')) : new Map()

if (!existsSync(snPath)) {
  console.warn(`[gen-i18n] WARNING: messages_sn.properties not found — sn locale will be empty`)
}

// Build per-wireCode locale entries
/** @type {Array<{wireCode: string, en: string, sn: string}>} */
const entries = ERROR_CODE_MAP.map(({ wireCode, messageKey }) => {
  const en = enBundle.get(messageKey) ?? `[missing: ${messageKey}]`
  const sn = snBundle.get(messageKey) ?? en // fall back to en if sn missing
  if (!enBundle.has(messageKey)) {
    console.warn(`[gen-i18n] WARNING: key "${messageKey}" not found in messages.properties`)
  }
  return { wireCode, en, sn }
})

// Emit typed TS
const wireCodeUnion = entries.map(e => `'${e.wireCode}'`).join('\n  | ')

const entriesTs = entries
  .map(e => `  ${e.wireCode}: { en: ${JSON.stringify(e.en)}, sn: ${JSON.stringify(e.sn)} },`)
  .join('\n')

const output = `// GENERATED from the BE i18n bundle (single source of truth) — DO NOT EDIT
// Run \`npm run i18n:gen\` to regenerate when messages*.properties changes.
// Source: be/java/spring/bank-withdrawal/src/main/resources/i18n/messages*.properties

export type BeMessageKey =
  | ${wireCodeUnion}

export const beMessages = {
${entriesTs}
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
`

writeFileSync(OUT_FILE, output, 'utf8')
console.log(`[gen-i18n] Generated ${OUT_FILE} (${entries.length} wire codes, locales: en, sn)`)
