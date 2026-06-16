import { useEffect, useState, type ReactNode } from 'react'
import type { PrivilegePrompt } from '@shared/ipc'
import { RootPasswordDialog } from '../components/RootPasswordDialog'
import { hasBridge } from '../lib/lynx'

/**
 * Bridges main-process privilege prompts to the on-screen Root Password dialog.
 * Mounted once near the app root. Each prompt attempt arrives as its own event
 * (the main-process retry loop re-emits with an incremented attempt + error),
 * so we simply render the latest prompt; submitting closes the dialog until the
 * next attempt (if the password was wrong) re-opens it with the error.
 */
export function PrivilegeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [prompt, setPrompt] = useState<PrivilegePrompt | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // No bridge (e.g. opened as a plain browser tab) — nothing to subscribe to.
    if (!hasBridge()) return
    const unsubscribe = window.lynx.onPrivilegePrompt((p) => {
      setBusy(false)
      setPrompt(p)
    })
    return unsubscribe
  }, [])

  const respond = async (password: string | null): Promise<void> => {
    if (!prompt) return
    setBusy(true)
    try {
      await window.lynx.respondPrivilege({ requestId: prompt.requestId, password })
    } finally {
      // Close; a wrong password triggers a fresh prompt event that re-opens us.
      setPrompt(null)
      setBusy(false)
    }
  }

  return (
    <>
      {children}
      {prompt && (
        <RootPasswordDialog
          prompt={prompt}
          busy={busy}
          onAuthenticate={(pw) => void respond(pw)}
          onCancel={() => void respond(null)}
        />
      )}
    </>
  )
}
