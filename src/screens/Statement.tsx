import { useState } from 'react'
import { ScreenFrame } from '../components/ScreenFrame'
import { Money } from '../components/Money'
import { Pager } from '../components/Pager'
import { useStatement } from '../hooks/useStatement'
import { useSessionStore } from '../stores/sessionStore'
import type { Transaction } from '../api/types'

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function Row({ tx, currency }: { tx: Transaction; currency: string }) {
  const emoji = tx.type === 'DEBIT' ? '💸' : '💵'
  return (
    <li className="glass p-3 flex items-center justify-between text-sm">
      <span className="flex items-center gap-2">
        <span className="text-lg">{emoji}</span>
        <span className="text-slate-400">{dateFmt.format(new Date(tx.occurredAt))}</span>
      </span>
      <span className="text-right">
        <span className={tx.type === 'DEBIT' ? 'text-rose-300' : 'text-emerald-300'}>
          {tx.type === 'DEBIT' ? '−' : '+'}
          <Money amount={tx.amount} currency={currency} />
        </span>
        <span className="block text-slate-500 font-mono text-xs">
          <Money amount={tx.balanceAfter} currency={currency} />
        </span>
      </span>
    </li>
  )
}

export function Statement() {
  const account = useSessionStore((s) => s.account)
  const currency = account?.currency ?? 'EUR'
  const [page, setPage] = useState(0)
  const { data, isLoading, isPlaceholderData } = useStatement(account?.accountId ?? null, page)

  const rows = data?.content ?? []
  const totalPages = data?.page.totalPages ?? 0

  return (
    <ScreenFrame>
      {isLoading && rows.length === 0 ? (
        <p className="text-slate-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-400 text-center py-6">🧾 No transactions yet</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((tx) => (
            <Row key={tx.transactionId} tx={tx} currency={currency} />
          ))}
        </ul>
      )}
      {totalPages > 1 && (
        <Pager page={page} totalPages={totalPages} onPage={setPage} disabled={isPlaceholderData} />
      )}
    </ScreenFrame>
  )
}
