import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ScreenFrame } from '../components/ScreenFrame'
import { Keypad } from '../components/Keypad'
import { useSessionStore } from '../stores/sessionStore'
import { useCardsStore } from '../stores/cardsStore'
import { atmMetrics } from '../telemetry'
import { useT } from '../i18n/strings'

export function Pin() {
  const t = useT()
  const navigate = useNavigate()
  const account = useSessionStore((s) => s.account)
  const cardNumber = useSessionStore((s) => s.cardNumber)
  const cards = useCardsStore((s) => s.cards)
  const save = useCardsStore((s) => s.save)
  const [pin, setPin] = useState('')

  // No card in session — bounce to Welcome.
  if (!cardNumber || !account) return <Navigate to="/" replace />

  const alreadySaved = cards.some((c) => c.cardNumber === cardNumber)

  function enter() {
    if (pin.length < 4) {
      toast.error('🔢 Enter your 4-digit PIN')
      return
    }
    atmMetrics.sessionStarted()
    // PIN is cosmetic — any 4 digits proceed. Offer to remember the card.
    if (!alreadySaved && account) {
      save(cardNumber as string, account.holderName)
    }
    navigate('/menu')
  }

  return (
    <ScreenFrame title={`🔐 ${t('enterPin')}`}>
      <p className="text-slate-400 mb-1">{account.holderName}</p>
      <div className="flex gap-3 justify-center my-5" aria-label="PIN entry">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full transition ${
              i < pin.length ? 'bg-accent-cyan' : 'bg-surface-700'
            }`}
          />
        ))}
      </div>
      <Keypad
        onDigit={(d) => setPin((p) => (p.length < 4 ? p + d : p))}
        onBackspace={() => setPin((p) => p.slice(0, -1))}
        onEnter={enter}
      />
    </ScreenFrame>
  )
}
