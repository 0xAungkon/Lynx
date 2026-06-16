import { useEffect, useRef, useState } from 'react'
import type { PrivilegePrompt } from '@shared/ipc'
import { Icon } from './Icon'

interface RootPasswordDialogProps {
  prompt: PrivilegePrompt
  /** Submit the entered password (validating state is driven by the parent). */
  onAuthenticate: (password: string) => void
  /** Cancel ≡ "continue without root" (§5.4). */
  onCancel: () => void
  busy: boolean
}

/**
 * On-screen Root Password dialog (idea.md §5.4). Material 3 modal: names the
 * action and why root is needed, masks the input, and offers "Authenticate" or
 * "Continue without root". Esc / cancel proceeds in user mode rather than
 * aborting the action.
 */
export function RootPasswordDialog({
  prompt,
  onAuthenticate,
  onCancel,
  busy
}: RootPasswordDialogProps): JSX.Element {
  const [password, setPassword] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Refocus + clear whenever a new attempt arrives.
  useEffect(() => {
    setPassword('')
    inputRef.current?.focus()
  }, [prompt.attempt, prompt.requestId])

  const submit = (): void => {
    if (busy) return
    onAuthenticate(password)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel()
      }}
    >
      <div className="w-[440px] max-w-[92vw] rounded-xl border border-outline-variant bg-surface-container-high p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
            <Icon name="admin_panel_settings" className="text-primary" />
          </div>
          <div>
            <h2 className="font-title-sm text-title-sm text-on-surface">Administrator access required</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">{prompt.action}</p>
          </div>
        </div>

        <p className="mb-4 font-body-md text-body-md text-on-surface-variant">{prompt.reason}</p>

        <label className="mb-1 block font-label-caps text-label-caps uppercase text-on-surface-variant">
          Root / sudo password
        </label>
        <input
          ref={inputRef}
          type="password"
          value={password}
          disabled={busy}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
          autoComplete="off"
          className="w-full rounded-lg border border-outline-variant bg-surface-container py-2 px-3 font-data-mono text-data-mono text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
          placeholder="••••••••"
        />

        {prompt.error && (
          <p className="mt-2 flex items-center gap-1.5 font-body-md text-body-md text-error">
            <Icon name="error" className="text-[18px]" />
            {prompt.error}
          </p>
        )}
        {prompt.attempt > 1 && !prompt.error && (
          <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
            Attempt {prompt.attempt} of 3
          </p>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg px-4 py-2 font-title-sm text-title-sm text-on-surface-variant transition-colors hover:bg-surface-variant disabled:opacity-50"
          >
            Continue without root
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-title-sm text-title-sm text-on-primary transition-colors hover:bg-primary-fixed disabled:opacity-60"
          >
            {busy && <Icon name="progress_activity" className="animate-spin text-[18px]" />}
            {busy ? 'Authenticating…' : 'Authenticate'}
          </button>
        </div>
      </div>
    </div>
  )
}
