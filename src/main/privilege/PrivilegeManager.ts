import type { BrowserWindow } from 'electron'
import { PRIVILEGE_PROMPT_CHANNEL, type AppSettings, type PrivilegeMode, type PrivilegeResponse } from '@shared/ipc'
import { sudoExec, isAuthFailure, isNoTtyFailure, type ExecResult } from './sudo'

/** Result of attempting to run a command with elevation. */
export type ElevationOutcome =
  | { elevated: true; result: ExecResult }
  | { elevated: false; reason: 'declined' | 'failed'; error?: string }

interface PromptMeta {
  action: string
  reason: string
}

const DEFAULT_CACHE_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 3

/**
 * The single chokepoint for privileged execution (idea.md §5). Collects the
 * root password through the renderer's on-screen dialog, runs the command via
 * `sudo -S`, and — per the required behavior — never aborts the caller when the
 * user declines: it reports `declined` so the action can fall back to user mode.
 *
 * Secret hygiene: the password is held only in this object's memory for at most
 * CACHE_MS (to avoid re-prompting on every click), is dropped on expiry/quit,
 * and is never returned to the renderer, written to disk, or logged.
 */
export class PrivilegeManager {
  private getWindow: () => BrowserWindow | null = () => null
  private cachedPassword: string | null = null
  private cacheExpires = 0
  private cacheTimer: NodeJS.Timeout | null = null
  private readonly pending = new Map<string, (res: PrivilegeResponse) => void>()
  private reqCounter = 0

  // User-configurable behaviour (idea.md §5.3), applied from persisted settings.
  private mode: PrivilegeMode = 'always'
  private cacheMs = DEFAULT_CACHE_MS

  /** Provide the window used to surface password prompts. */
  setWindowProvider(fn: () => BrowserWindow | null): void {
    this.getWindow = fn
  }

  /** Apply persisted privilege preferences. Drops any cached credential that the
   *  new mode/timeout no longer permits. */
  applySettings({ privilegeMode, cacheTtlMinutes }: AppSettings): void {
    this.mode = privilegeMode
    this.cacheMs = cacheTtlMinutes * 60 * 1000
    if (this.mode !== 'always' || this.cacheMs === 0) this.clearCache()
  }

  /** Called by the IPC router when the renderer replies to a prompt. */
  resolvePrompt(res: PrivilegeResponse): void {
    const cb = this.pending.get(res.requestId)
    if (cb) {
      this.pending.delete(res.requestId)
      cb(res)
    }
  }

  /** Drop any cached credential (on lock/quit). */
  clearCache(): void {
    this.cachedPassword = null
    this.cacheExpires = 0
    if (this.cacheTimer) {
      clearTimeout(this.cacheTimer)
      this.cacheTimer = null
    }
  }

  private cache(password: string): void {
    this.cachedPassword = password
    this.cacheExpires = Date.now() + this.cacheMs
    if (this.cacheTimer) clearTimeout(this.cacheTimer)
    this.cacheTimer = setTimeout(() => this.clearCache(), this.cacheMs)
    this.cacheTimer.unref?.()
  }

  private validCache(): string | null {
    if (this.cachedPassword && Date.now() < this.cacheExpires) return this.cachedPassword
    if (this.cachedPassword) this.clearCache()
    return null
  }

  async runElevated(argv: string[], meta: PromptMeta): Promise<ElevationOutcome> {
    // 0. User-only mode (§5.3): never prompt, never elevate — the caller falls
    //    back to user-scoped execution and reports the degraded outcome.
    if (this.mode === 'never') return { elevated: false, reason: 'declined' }

    // 1. Reuse a still-valid cached credential to avoid re-prompting — only in
    //    'always' mode; 'ask' re-prompts for every action.
    if (this.mode === 'always') {
      const cached = this.validCache()
      if (cached) {
        const result = await sudoExec(argv, cached)
        if (!isAuthFailure(result.stderr)) return { elevated: true, result }
        this.clearCache() // stale/changed password — fall through to prompt
      }
    }

    // 2. Prompt loop with bounded retries.
    let error: string | undefined
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const password = await this.prompt({ ...meta, attempt, error })
      // null (cancel) or empty == "continue without root" (§5.4).
      if (!password) return { elevated: false, reason: 'declined' }

      const result = await sudoExec(argv, password)
      if (isNoTtyFailure(result.stderr) && !isAuthFailure(result.stderr)) {
        return {
          elevated: false,
          reason: 'failed',
          error: 'sudo requires a terminal on this system; cannot elevate.'
        }
      }
      if (isAuthFailure(result.stderr)) {
        error = 'Incorrect password — try again.'
        continue
      }
      // Cache only when the mode allows it and a timeout is configured.
      if (this.mode === 'always' && this.cacheMs > 0) this.cache(password)
      return { elevated: true, result }
    }

    return { elevated: false, reason: 'failed', error: 'Authentication failed.' }
  }

  private prompt(p: PromptMeta & { attempt: number; error?: string }): Promise<string | null> {
    const win = this.getWindow()
    if (!win || win.isDestroyed()) return Promise.resolve(null)
    const requestId = `pv-${++this.reqCounter}`
    return new Promise((resolve) => {
      this.pending.set(requestId, (res) => resolve(res.password))
      // If the window goes away mid-prompt, resolve as declined so we never hang.
      win.once('closed', () => {
        if (this.pending.delete(requestId)) resolve(null)
      })
      win.webContents.send(PRIVILEGE_PROMPT_CHANNEL, {
        requestId,
        action: p.action,
        reason: p.reason,
        attempt: p.attempt,
        error: p.error
      })
    })
  }
}

/** Process-wide singleton. */
export const privilegeManager = new PrivilegeManager()
