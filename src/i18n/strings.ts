// FE-OWN-DOMAIN strings only (labels/navigation). BE-originated messages derive
// from src/i18n/generated/beMessages.ts (npm run i18n:gen).
import { useLocaleStore } from '../stores/localeStore'

const DICT = {
  en: {
    welcome: 'Welcome', insertCard: 'Insert your card', enterPin: 'Enter your PIN',
    balance: 'Balance', withdraw: 'Withdraw', deposit: 'Deposit', statement: 'Mini-statement',
    exit: 'End session', confirm: 'Confirm', cancel: 'Cancel', another: 'Another transaction',
    takeCard: 'Please take your card', amount: 'Amount', yourCards: 'Your cards',
    // Passkey / WebAuthn strings (FE-OWN labels — not BE-originated)
    tapToAuth: 'Tap to authenticate',
    tapToAuthHint: 'Use your device passkey — no card needed',
    enablePasskey: 'Enable passkey on this ATM',
    enablePasskeyHint: 'Next time, just tap — no card entry.',
    passkeyReady: 'Passkey enabled!',
    passkeyReadyHint: 'You can now tap to sign in on your next visit.',
    passkeyNotSupported: 'Passkey not available on this device',
    passkeyAuthenticating: 'Authenticating…',
    passkeyAuthenticatingHint: 'Complete the prompt on your device',
    passkeyCancelled: 'Authentication cancelled',
    passkeyError: 'Passkey authentication failed',
    passkeyEnrollError: 'Passkey registration failed',
    enableNow: 'Enable now',
    skipForNow: 'Maybe later',
  },
  sn: {
    welcome: 'Mauya', insertCard: 'Isa kadhi rako', enterPin: 'Isa PIN yako',
    balance: 'Mari iripo', withdraw: 'Bvisa mari', deposit: 'Isa mari', statement: 'Chitsauko chemari',
    exit: 'Pedza', confirm: 'Simbisa', cancel: 'Kanzura', another: 'Imwe basa',
    takeCard: 'Tora kadhi rako', amount: 'Mari', yourCards: 'Makadhi ako',
    // Passkey / WebAuthn strings (sn — Shona)
    tapToAuth: 'Bata kuti upinde',
    tapToAuthHint: 'Shandisa passkey yako — hapana kadhi rinodikanwa',
    enablePasskey: 'Gonesa passkey pa ATM iyi',
    enablePasskeyHint: 'Kanhi kunotevera, bata bedzi — pasina kukanda kadhi.',
    passkeyReady: 'Passkey yagadzirwa!',
    passkeyReadyHint: 'Unogona kubata kupinda wega rwendo rwako rwunotevera.',
    passkeyNotSupported: 'Passkey haiwanikwi pane mudziyo uyu',
    passkeyAuthenticating: 'Kupinda mukati…',
    passkeyAuthenticatingHint: 'Pedza chiratidzo pane mudziyo wako',
    passkeyCancelled: 'Kupinda mukati kwakanzurwa',
    passkeyError: 'Kupinda neicho chakandikira kushandisa passkey',
    passkeyEnrollError: 'Kugadzira passkey kushandisike',
    enableNow: 'Gonesa iye zvino',
    skipForNow: 'Pamwe gare',
  },
} as const

export type StringKey = keyof (typeof DICT)['en']
export function useT() {
  const locale = useLocaleStore((s) => s.locale)
  return (key: StringKey) => DICT[locale][key]
}
