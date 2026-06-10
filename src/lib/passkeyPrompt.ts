/**
 * Helpers for tracking whether the one-time passkey enrollment prompt has been
 * shown and dismissed in this browser session.
 *
 * Persisted in sessionStorage (not localStorage) — clears when the browser tab
 * is closed or a new ATM session begins via a fresh page load.
 */

const DISMISSED_KEY = 'atm-passkey-prompt-dismissed'

export function hasPasskeyPromptBeenDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

export function markPasskeyPromptDismissed(): void {
  try {
    sessionStorage.setItem(DISMISSED_KEY, '1')
  } catch {
    // sessionStorage unavailable — treat as dismissed to avoid re-prompting
  }
}
