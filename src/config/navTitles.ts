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
