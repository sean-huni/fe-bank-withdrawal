import { useLocaleStore } from '../stores/localeStore'

const DICT = {
  en: {
    welcome: 'Welcome', insertCard: 'Insert your card', enterPin: 'Enter your PIN',
    balance: 'Balance', withdraw: 'Withdraw', deposit: 'Deposit', statement: 'Mini-statement',
    exit: 'End session', confirm: 'Confirm', cancel: 'Cancel', another: 'Another transaction',
    takeCard: 'Please take your card', amount: 'Amount', yourCards: 'Your cards',
  },
  sn: {
    welcome: 'Mauya', insertCard: 'Isa kadhi rako', enterPin: 'Isa PIN yako',
    balance: 'Mari iripo', withdraw: 'Bvisa mari', deposit: 'Isa mari', statement: 'Chitsauko chemari',
    exit: 'Pedza', confirm: 'Simbisa', cancel: 'Kanzura', another: 'Imwe basa',
    takeCard: 'Tora kadhi rako', amount: 'Mari', yourCards: 'Makadhi ako',
  },
} as const

export type StringKey = keyof (typeof DICT)['en']
export function useT() {
  const locale = useLocaleStore((s) => s.locale)
  return (key: StringKey) => DICT[locale][key]
}
