import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ScreenFrame } from '../components/ScreenFrame'
import { CardTile } from '../components/CardTile'
import { useCardLookup } from '../hooks/useCardLookup'
import { usePasskeyAvailability } from '../hooks/usePasskeyAvailability'
import { isValidCardNumber, normalizeCard } from '../lib/luhn'
import { fromAxios, mapError } from '../lib/errorMap'
import { useSessionStore } from '../stores/sessionStore'
import { useCardsStore } from '../stores/cardsStore'
import { useLocaleStore } from '../stores/localeStore'
import { usePasskeyStore } from '../stores/passkeyStore'
import { atmMetrics } from '../telemetry'
import { useT } from '../i18n/strings'

export function Welcome() {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const lookup = useCardLookup()
  const setPending = useSessionStore((s) => s.setPending)
  const cards = useCardsStore((s) => s.cards)
  const submittedFor = useRef<string | null>(null)

  // Passkey availability — sets passkeyStore.passkeyAvailable once on mount
  usePasskeyAvailability()
  const passkeyAvailable = usePasskeyStore((s) => s.passkeyAvailable)

  async function insert(cardRaw: string) {
    const card = normalizeCard(cardRaw)
    if (!isValidCardNumber(card) || submittedFor.current === card || lookup.isPending) return
    submittedFor.current = card
    try {
      const summary = await lookup.mutateAsync(card)
      atmMetrics.cardLookup('success')
      setPending(card, summary.holderName)
      navigate('/pin')
    } catch (err) {
      const { status, error } = fromAxios(err)
      atmMetrics.cardLookup(status === 404 ? 'not_found' : 'error')
      const m = mapError(status, error, locale)
      toast.error(`${m.emoji} ${m.title}`)
      submittedFor.current = null // allow retry
    }
  }

  // Auto-submit the instant a valid 16-digit Luhn number is present (typed or pasted).
  useEffect(() => {
    if (isValidCardNumber(normalizeCard(value))) void insert(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <ScreenFrame title={`🏧 ${t('welcome')}`}>
      {/* Passkey button — primary CTA on return visits when platform authenticator available */}
      {passkeyAvailable && (
        <button
          type="button"
          aria-label={t('tapToAuth')}
          className="glass w-full p-4 text-accent-cyan font-display text-lg mb-4 active:scale-95 transition"
          onClick={() => navigate('/passkey-auth')}
        >
          🔐 {t('tapToAuth')}
        </button>
      )}

      <p className="text-slate-400 mb-3">{t('insertCard')}</p>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        inputMode="numeric"
        placeholder="#### #### #### ####"
        className="glass w-full p-4 font-mono text-lg tracking-widest mb-3"
      />
      <button
        type="button"
        className="glass w-full p-4 text-accent-cyan font-display mb-4 active:scale-95 transition disabled:opacity-50"
        disabled={lookup.isPending}
        onClick={() => insert(value)}
      >
        💳 {t('insertCard')}
      </button>
      {cards.length > 0 && <p className="text-slate-400 text-sm mb-2">{t('yourCards')}</p>}
      <div className="space-y-2">
        {cards.map((c) => (
          <CardTile key={c.cardNumber} card={c} onSelect={() => insert(c.cardNumber)} />
        ))}
      </div>
    </ScreenFrame>
  )
}
