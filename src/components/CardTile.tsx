import type { SavedCard } from '../stores/cardsStore'

export function CardTile({ card, onSelect }: { card: SavedCard; onSelect: () => void }) {
  const last4 = card.cardNumber.slice(-4)
  return (
    <button
      type="button"
      onClick={onSelect}
      className="glass w-full p-4 flex items-center justify-between active:scale-[0.98] transition"
    >
      <span className="font-display">💳 {card.label}</span>
      <span className="font-mono text-slate-400">•••• {last4}</span>
    </button>
  )
}
