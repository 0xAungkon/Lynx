import type { ReactNode } from 'react'
import { Icon } from './Icon'

interface CardProps {
  title?: string
  icon?: string
  /** Rendered on the right side of the header row. */
  action?: ReactNode
  className?: string
  children: ReactNode
}

/** Standard Material 3 surface container card with an optional titled header. */
export function Card({ title, icon, action, className = '', children }: CardProps): JSX.Element {
  return (
    <div
      className={`flex flex-col rounded-xl border border-outline-variant bg-surface-container p-card_padding ${className}`}
    >
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between border-b border-outline-variant pb-2">
          <h3 className="flex items-center gap-2 font-title-sm text-title-sm text-on-surface">
            {icon && <Icon name={icon} />}
            {title}
          </h3>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}
