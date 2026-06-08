import { useEffect } from 'react'

function isEditableTarget(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true
  return (el as HTMLElement).isContentEditable
}

export function Keypad({
  onDigit,
  onBackspace,
  onEnter,
}: {
  onDigit: (d: string) => void
  onBackspace: () => void
  onEnter: () => void
}) {
  // Hardware / Bluetooth / mobile keyboards: mirror the on-screen buttons.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't steal keys from text fields or while a modifier is held.
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isEditableTarget(document.activeElement)) return

      if (e.key >= '0' && e.key <= '9') {
        onDigit(e.key)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        onBackspace()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        onEnter()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onDigit, onBackspace, onEnter])

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']
  return (
    <div className="grid grid-cols-3 gap-3">
      {keys.map((k, i) => (
        <button
          key={i}
          type="button"
          disabled={k === ''}
          className="glass h-16 text-2xl font-display disabled:opacity-0 active:scale-95 transition"
          onClick={() => (k === '⌫' ? onBackspace() : k && onDigit(k))}
        >
          {k}
        </button>
      ))}
      <button
        type="button"
        className="glass col-span-3 h-14 text-accent-cyan font-display active:scale-95 transition"
        onClick={onEnter}
      >
        ↵ Enter
      </button>
    </div>
  )
}
