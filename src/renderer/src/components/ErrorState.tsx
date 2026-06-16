import type { ReactNode } from 'react'
import { Icon } from './Icon'

interface ErrorStateProps {
  icon?: string
  title: string
  message: string
  /** Optional details rendered in a monospace box (e.g. a stack/trace line). */
  detail?: string
  action?: ReactNode
  /** 'page' centers full-viewport; 'inline' fills its container. */
  variant?: 'page' | 'inline'
}

/** Themed Material 3 error / empty state used for route errors and missing bridge. */
export function ErrorState({
  icon = 'error',
  title,
  message,
  detail,
  action,
  variant = 'page'
}: ErrorStateProps): JSX.Element {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 bg-background p-8 text-center ${
        variant === 'page' ? 'h-screen' : 'min-h-[50vh]'
      }`}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-error/15">
        <Icon name={icon} className="text-error" />
      </div>
      <div className="max-w-md">
        <h1 className="font-headline-md text-headline-md text-on-surface">{title}</h1>
        <p className="mt-2 font-body-md text-body-md text-on-surface-variant">{message}</p>
      </div>
      {detail && (
        <pre className="max-w-lg overflow-x-auto rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-left font-code-terminal text-code-terminal text-on-surface-variant">
          {detail}
        </pre>
      )}
      {action}
    </div>
  )
}
