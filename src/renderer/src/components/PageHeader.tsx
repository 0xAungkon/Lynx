import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  /** Optional controls rendered on the right (e.g. filters, actions). */
  action?: ReactNode
}

/** Consistent module page heading used across all Phase 1 monitors. */
export function PageHeader({ title, subtitle, action }: PageHeaderProps): JSX.Element {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <h1 className="font-display-lg text-display-lg text-on-surface">{title}</h1>
        {subtitle && (
          <p className="mt-1 font-body-md text-body-md text-on-surface-variant">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  )
}
