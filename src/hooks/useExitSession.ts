import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useSessionStore } from '../stores/sessionStore'
import { useT } from '../i18n/strings'

/** Ends the session: sign out, remind card users to take their card, return to Welcome. */
export function useExitSession() {
  const t = useT()
  const navigate = useNavigate()
  const signOut = useSessionStore((s) => s.signOut)
  const cardNumber = useSessionStore((s) => s.cardNumber)
  return () => {
    signOut()
    if (cardNumber) toast(`💳 ${t('takeCard')}`)
    navigate('/')
  }
}
