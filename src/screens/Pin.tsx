import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ScreenFrame } from '../components/ScreenFrame'
import { Keypad } from '../components/Keypad'
import { useSessionStore } from '../stores/sessionStore'
import { useCardsStore } from '../stores/cardsStore'
import { useVerifyPin } from '../hooks/useVerifyPin'
import { fromAxios, mapError } from '../lib/errorMap'
import { atmMetrics } from '../telemetry'
import { useT } from '../i18n/strings'

export function Pin() {
  const t = useT()
  const navigate = useNavigate()
  const cardNumber = useSessionStore((s) => s.pendingCardNumber)
  const holderName = useSessionStore((s) => s.pendingHolderName)
  const signIn = useSessionStore((s) => s.signIn)
  const cards = useCardsStore((s) => s.cards)
  const save = useCardsStore((s) => s.save)
  const verify = useVerifyPin()
  const [pin, setPin] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const submitting = useRef(false)

  async function authenticate(entered: string) {
    if (submitting.current || !cardNumber) return
    submitting.current = true
    setErrorMsg(null)
    try {
      const account = await verify.mutateAsync({ cardNumber, pin: entered })
      atmMetrics.pinVerify('success')
      if (!cards.some((c) => c.cardNumber === cardNumber)) save(cardNumber, account.holderName)
      signIn(account, cardNumber)
      navigate('/menu')
    } catch (err) {
      const { status, error } = fromAxios(err)
      atmMetrics.pinVerify(status === 401 ? 'invalid' : 'error')
      const m = mapError(status, error)
      toast.error(`${m.emoji} ${m.title}`)
      setErrorMsg(m.detail || m.title)
      setPin('')
      submitting.current = false // re-arm for another attempt
    }
  }

  // Auto-authenticate the instant 4 digits are entered — no Enter needed.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (pin.length === 4) void authenticate(pin)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  // No pending card — bounce to Welcome. (After all hooks, to keep hook order stable.)
  if (!cardNumber) return <Navigate to="/" replace />

  return (
    <ScreenFrame title={`🔐 ${t('enterPin')}`}>
      <p className="text-slate-400 mb-1">{holderName}</p>
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
      {errorMsg && (
        <p role="alert" className="text-center text-sm text-rose-400 mb-3">
          {errorMsg}
        </p>
      )}
      <Keypad
        onDigit={(d) => setPin((p) => (p.length < 4 ? p + d : p))}
        onBackspace={() => setPin((p) => p.slice(0, -1))}
        onEnter={() => { if (pin.length === 4) void authenticate(pin) }}
      />
      <p className="text-center text-xs text-slate-500 mt-4">demo PIN 1234 · type on keypad or keyboard</p>
    </ScreenFrame>
  )
}
