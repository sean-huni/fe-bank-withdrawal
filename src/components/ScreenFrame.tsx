import type { ReactNode } from 'react'

export function ScreenFrame({
  title,
  children,
  footer,
}: {
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <section className="glass w-full max-w-md p-6 sm:p-8 shadow-2xl">
      <h1 className="font-display text-2xl sm:text-3xl mb-5">{title}</h1>
      <div>{children}</div>
      {footer && <div className="mt-6 border-t border-surface-700/50 pt-4">{footer}</div>}
    </section>
  )
}
