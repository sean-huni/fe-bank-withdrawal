#!/usr/bin/env node
/**
 * gen-i18n.mjs — Generates src/i18n/generated/beMessages.ts from the BE
 * messages*.properties bundle AND the BE ErrorCode.java enum.
 *
 * Usage:  node scripts/gen-i18n.mjs
 *         BE_I18N_DIR=/custom/path node scripts/gen-i18n.mjs
 *
 * When the BE directory is absent the committed file is left in place and
 * the script exits 0 (clean-clone rule: FE builds without the BE repo).
 *
 * Wire-code collisions (e.g. the three IDEMPOTENCY_* constants that all share
 * the "IDEMPOTENCY_CONFLICT" wire code) are emitted as a variants map:
 *
 *   IDEMPOTENCY_CONFLICT: {
 *     variants: {
 *       "error.idempotency.unresolved":      { en: "...", sn: "..." },
 *       "error.idempotency.replay-mismatch": { en: "...", sn: "..." },
 *       "error.idempotency.in-progress":     { en: "...", sn: "..." },
 *     },
 *     // en/sn are the FIRST variant (enum declaration order); runtime callers
 *     // that receive a BE error with error.message can use the exact message to
 *     // pick the right variant, or fall back to en/sn here.
 *     en: "...",
 *     sn: "...",
 *   }
 *
 * Single-mapping wire codes keep the flat { en, sn } shape for backward compat.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
// scripts/ → fe-bank-withdrawal/ → fe/react/ → fe/ → env/repo/
const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..')

const DEFAULT_BE_I18N = resolve(REPO_ROOT, 'be/java/spring/bank-withdrawal/src/main/resources/i18n')
const BE_I18N_DIR = process.env.BE_I18N_DIR ?? DEFAULT_BE_I18N

const OUT_FILE = resolve(__dirname, '..', 'src', 'i18n', 'generated', 'beMessages.ts')

// ── Filesystem helpers ────────────────────────────────────────────────────────

/**
 * Recursively search for ErrorCode.java under `dir`.
 * @param {string} dir
 * @returns {string|null}
 */
function walkForErrorCode(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch { return null }
  for (const e of entries) {
    const full = resolve(dir, e.name)
    if (e.isDirectory()) {
      const found = walkForErrorCode(full)
      if (found) return found
    } else if (e.isFile() && e.name === 'ErrorCode.java') {
      return full
    }
  }
  return null
}

// ── Java enum parser ──────────────────────────────────────────────────────────

/**
 * Parse the ErrorCode.java enum body and return an ordered list of
 * { constantName, wireCode, messageKey } triples.
 *
 * Handles both constructor forms:
 *   CONSTANT("messageKey")               → wireCode = CONSTANT (name())
 *   CONSTANT("WIRE_CODE", "messageKey")  → wireCode = WIRE_CODE
 *
 * @param {string} src  raw Java source text
 * @returns {Array<{constantName: string, wireCode: string, messageKey: string}>}
 */
function parseErrorCodeEnum(src) {
  // Strip block and line comments so regex doesn't match inside them
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')

  // Find the enum constant block: everything from the first '{' up to the first ';'
  // (the ';' that terminates the constant list, before fields/methods)
  const bodyMatch = stripped.match(/enum\s+ErrorCode\s*\{([\s\S]*?);/)
  if (!bodyMatch) throw new Error('Could not locate enum constant block in ErrorCode.java')

  const body = bodyMatch[1]

  // Each constant: NAME("arg1") or NAME("arg1", "arg2")
  const constantRe = /(\w+)\s*\(\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?\s*\)/g
  /** @type {Array<{constantName: string, wireCode: string, messageKey: string}>} */
  const result = []
  let m
  while ((m = constantRe.exec(body)) !== null) {
    const constantName = m[1]
    if (m[3] !== undefined) {
      // Two-arg form: (wireCode, messageKey)
      result.push({ constantName, wireCode: m[2], messageKey: m[3] })
    } else {
      // One-arg form: (messageKey) → wireCode = constant name
      result.push({ constantName, wireCode: constantName, messageKey: m[2] })
    }
  }
  return result
}

// ── Properties parser ─────────────────────────────────────────────────────────

/**
 * Find the index of the first unescaped '=' or ':' key-value separator.
 * @param {string} line
 * @returns {number} index or -1
 */
function findSeparatorIndex(line) {
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\') { i++; continue } // skip escaped char
    if (line[i] === '=' || line[i] === ':') return i
  }
  return -1
}

/**
 * Parse a Java .properties file into a Map<key, value>.
 * Supports both '=' and ':' as separators (per .properties spec).
 * Warns loudly on malformed lines (missing separator or empty key).
 * @param {string} content raw file text
 * @returns {Map<string, string>}
 */
function parseProperties(content) {
  /** @type {Map<string, string>} */
  const map = new Map()
  let lineNum = 0
  for (const raw of content.split('\n')) {
    lineNum++
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const sep = findSeparatorIndex(line)
    if (sep === -1) {
      console.warn(`[gen-i18n] WARNING: malformed line ${lineNum} — no '=' or ':' separator: ${JSON.stringify(line)}`)
      continue
    }
    const key = line.slice(0, sep).trim()
    if (!key) {
      console.warn(`[gen-i18n] WARNING: malformed line ${lineNum} — empty key: ${JSON.stringify(line)}`)
      continue
    }
    // Java MessageFormat uses '' for a literal single-quote; normalise to '
    const value = line.slice(sep + 1).trim().replace(/''/g, "'")
    map.set(key, value)
  }
  return map
}

// ── Main ──────────────────────────────────────────────────────────────────────

if (!existsSync(BE_I18N_DIR)) {
  console.warn(
    `[gen-i18n] WARNING: BE i18n directory not found at:\n  ${BE_I18N_DIR}\n` +
    `  Leaving committed src/i18n/generated/beMessages.ts in place.\n` +
    `  To regenerate, set BE_I18N_DIR or clone the BE repo alongside this one.`
  )
  process.exit(0)
}

// Locate ErrorCode.java under the sibling java/ source root
// BE_I18N_DIR = .../bank-withdrawal/src/main/resources/i18n
// java root   = .../bank-withdrawal/src/main/java
const javaRoot = resolve(BE_I18N_DIR, '..', '..', 'java')
let enumConstants = null

if (!existsSync(javaRoot)) {
  console.warn(`[gen-i18n] WARNING: Java source root not found at ${javaRoot} — cannot parse ErrorCode enum; leaving file in place.`)
  process.exit(0)
}

const enumFilePath = walkForErrorCode(javaRoot)
if (!enumFilePath) {
  console.warn(`[gen-i18n] WARNING: ErrorCode.java not found under ${javaRoot} — leaving file in place.`)
  process.exit(0)
}

console.log(`[gen-i18n] Parsing ErrorCode enum from: ${enumFilePath}`)
try {
  const src = readFileSync(enumFilePath, 'utf8')
  enumConstants = parseErrorCodeEnum(src)
  console.log(`[gen-i18n] Found ${enumConstants.length} enum constants`)
} catch (e) {
  console.warn(`[gen-i18n] WARNING: Failed to parse ErrorCode.java — ${e.message} — leaving file in place.`)
  process.exit(0)
}

// Parse message bundles
const enPath = resolve(BE_I18N_DIR, 'messages.properties')
const snPath = resolve(BE_I18N_DIR, 'messages_sn.properties')

if (!existsSync(enPath)) {
  console.error(`[gen-i18n] ERROR: messages.properties not found at ${enPath}`)
  process.exit(1)
}

const enBundle = parseProperties(readFileSync(enPath, 'utf8'))
const snBundle = existsSync(snPath) ? parseProperties(readFileSync(snPath, 'utf8')) : new Map()

if (!existsSync(snPath)) {
  console.warn(`[gen-i18n] WARNING: messages_sn.properties not found — sn locale will fall back to en`)
}

// ── Group enum constants by wire code ─────────────────────────────────────────
/** @type {Map<string, Array<{constantName: string, messageKey: string}>>} */
const byWireCode = new Map()

for (const { constantName, wireCode, messageKey } of enumConstants) {
  if (!byWireCode.has(wireCode)) byWireCode.set(wireCode, [])
  byWireCode.get(wireCode).push({ constantName, messageKey })
}

// ── Locale resolution helper ──────────────────────────────────────────────────
/**
 * @param {string} messageKey
 * @returns {{ en: string, sn: string }}
 */
function resolveLocales(messageKey) {
  if (!enBundle.has(messageKey)) {
    console.warn(`[gen-i18n] WARNING: key "${messageKey}" not found in messages.properties`)
  }
  const en = enBundle.get(messageKey) ?? `[missing: ${messageKey}]`
  const sn = snBundle.get(messageKey) ?? en
  return { en, sn }
}

// ── Build entry lines ─────────────────────────────────────────────────────────
/** @type {string[]} */
const entryLines = []

for (const [wireCode, variants] of byWireCode) {
  if (variants.length === 1) {
    // Simple flat shape: { en, sn }
    const { en, sn } = resolveLocales(variants[0].messageKey)
    entryLines.push(`  ${wireCode}: { en: ${JSON.stringify(en)}, sn: ${JSON.stringify(sn)} },`)
  } else {
    // Collapsed wire code: multiple enum constants share one wire code.
    // Emit a variants map keyed by messageKey for runtime disambiguation via error.message.
    // Top-level en/sn are the FIRST variant (enum declaration order).
    const first = resolveLocales(variants[0].messageKey)
    const variantLines = variants.map(({ constantName, messageKey }) => {
      const { en, sn } = resolveLocales(messageKey)
      return (
        `      // ${constantName}\n` +
        `      ${JSON.stringify(messageKey)}: { en: ${JSON.stringify(en)}, sn: ${JSON.stringify(sn)} },`
      )
    })
    entryLines.push(
      `  // ${variants.map(v => v.constantName).join(', ')} all collapse to this wire code.\n` +
      `  // variants is keyed by messageKey; callers can match error.message for exact disambiguation.\n` +
      `  // Top-level en/sn = first variant (${variants[0].constantName}).\n` +
      `  ${wireCode}: {\n` +
      `    variants: {\n${variantLines.join('\n')}\n    },\n` +
      `    en: ${JSON.stringify(first.en)},\n` +
      `    sn: ${JSON.stringify(first.sn)},\n` +
      `  },`
    )
  }
}

// Constraint-violation codes that are purely FE-level wire codes (not in ErrorCode enum).
// These are the codes surfaced in VALIDATION_FAILED field violations.
const CONSTRAINT_EXTRAS = [
  { wireCode: 'AMOUNT_REQUIRED',  messageKey: 'error.amount.required' },
  { wireCode: 'AMOUNT_POSITIVE',  messageKey: 'error.amount.positive' },
  { wireCode: 'AMOUNT_DIGITS',    messageKey: 'error.amount.digits' },
  { wireCode: 'SORT_UNSUPPORTED', messageKey: 'error.sort.unsupported' },
]

const extraWireCodes = []
for (const { wireCode, messageKey } of CONSTRAINT_EXTRAS) {
  if (byWireCode.has(wireCode)) continue // already covered by enum
  const { en, sn } = resolveLocales(messageKey)
  entryLines.push(`  ${wireCode}: { en: ${JSON.stringify(en)}, sn: ${JSON.stringify(sn)} },`)
  extraWireCodes.push(wireCode)
}

// ── Emit TypeScript ───────────────────────────────────────────────────────────
const allWireCodes = [...byWireCode.keys(), ...extraWireCodes]
const fullUnion = allWireCodes.map(wc => `'${wc}'`).join('\n  | ')
const entriesTs = entryLines.join('\n')

const output = `// GENERATED from BE ErrorCode.java + i18n bundle — DO NOT EDIT
// Run \`npm run i18n:gen\` to regenerate when ErrorCode.java or messages*.properties changes.
// Source: be/java/spring/bank-withdrawal/src/main/java/.../exception/ErrorCode.java
//         be/java/spring/bank-withdrawal/src/main/resources/i18n/messages*.properties
//
// Wire-code collisions: when multiple ErrorCode enum constants share one wire code
// (e.g. IDEMPOTENCY_UNRESOLVED / IDEMPOTENCY_REPLAY_MISMATCH / IDEMPOTENCY_IN_PROGRESS
// all collapse to "IDEMPOTENCY_CONFLICT"), the entry carries a \`variants\` map keyed by
// messageKey so runtime callers can pick the right text via BE's error.message.
// Top-level en/sn hold the FIRST variant for callers that don't need disambiguation.

export type BeMessageKey =
  | ${fullUnion}

export type BeMessageEntry =
  | { en: string; sn: string }
  | { variants: Record<string, { en: string; sn: string }>; en: string; sn: string }

export const beMessages: Record<BeMessageKey, BeMessageEntry> = {
${entriesTs}
} as const

export type Locale = 'en' | 'sn'

/**
 * Look up a localized BE message by wire code + locale.
 *
 * For collapsed wire codes (with variants), pass the raw BE \`error.message\` as
 * \`beMessage\` — when it matches a variant key the exact localized text is returned.
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
`

writeFileSync(OUT_FILE, output, 'utf8')
console.log(`[gen-i18n] Generated ${OUT_FILE} (${allWireCodes.length} wire codes, locales: en, sn)`)
