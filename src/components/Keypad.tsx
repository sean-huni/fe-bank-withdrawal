export function Keypad({
  onDigit,
  onBackspace,
  onEnter,
}: {
  onDigit: (d: string) => void
  onBackspace: () => void
  onEnter: () => void
}) {
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
