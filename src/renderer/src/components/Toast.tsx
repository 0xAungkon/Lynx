import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import type { ActionResult } from '@shared/ipc'
import { Icon } from './Icon'

type ToastKind = 'success' | 'warning' | 'error'

interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastApi {
  push: (message: string, kind?: ToastKind) => void
  /** Summarize an ActionResult into a toast, applying the §5 degraded-mode wording. */
  fromAction: (label: string, result: ActionResult) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const KIND_STYLE: Record<ToastKind, { border: string; icon: string; text: string }> = {
  success: { border: 'border-tertiary', icon: 'check_circle', text: 'text-tertiary' },
  warning: { border: 'border-primary', icon: 'info', text: 'text-primary' },
  error: { border: 'border-error', icon: 'error', text: 'text-error' }
}

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const push = useCallback(
    (message: string, kind: ToastKind = 'success') => {
      const id = nextId.current++
      setToasts((t) => [...t, { id, kind, message }])
      setTimeout(() => remove(id), 6000)
    },
    [remove]
  )

  const fromAction = useCallback(
    (label: string, result: ActionResult) => {
      if (result.ok && result.usedPrivilege === 'root') push(`${label} — done (root).`, 'success')
      else if (result.ok) push(`${label} — done.`, 'success')
      else if (result.usedPrivilege === 'user')
        push(result.note ?? `${label} — performed with user privileges; some steps skipped.`, 'warning')
      else push(result.error ?? `${label} failed.`, 'error')
    },
    [push]
  )

  return (
    <ToastContext.Provider value={{ push, fromAction }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => {
          const s = KIND_STYLE[t.kind]
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-2 rounded-lg border-l-4 ${s.border} bg-surface-container-high p-3 shadow-lg`}
            >
              <Icon name={s.icon} className={`${s.text} text-[20px]`} />
              <span className="flex-1 font-body-md text-body-md text-on-surface">{t.message}</span>
              <button
                onClick={() => remove(t.id)}
                className="text-on-surface-variant hover:text-on-surface"
                aria-label="Dismiss"
              >
                <Icon name="close" className="text-[18px]" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
