import type { ActionResult } from '@shared/ipc'
import { privilegeManager } from './PrivilegeManager'
import type { ExecResult } from './sudo'

const trim = (s: string): string | undefined => {
  const t = s.trim()
  return t.length ? t.slice(0, 4000) : undefined
}

/** Map a finished elevated command's exit result to an ActionResult. */
export function resultFromExec(result: ExecResult): ActionResult {
  return {
    ok: result.code === 0,
    usedPrivilege: 'root',
    stdout: trim(result.stdout),
    stderr: trim(result.stderr),
    error: result.code === 0 ? undefined : trim(result.stderr) ?? `exited with code ${result.code}`
  }
}

/**
 * Run `argv` with elevation, honouring the §5 fallback rule: if the user
 * declines the password prompt (or auth ultimately fails), we do NOT abort —
 * `onDeclined` runs whatever subset is possible as the current user, and the
 * degraded outcome is reported with a note.
 */
export async function runPrivileged(
  argv: string[],
  meta: { action: string; reason: string },
  onDeclined: () => Promise<ActionResult>
): Promise<ActionResult> {
  const outcome = await privilegeManager.runElevated(argv, meta)
  if (outcome.elevated) return resultFromExec(outcome.result)

  const fallback = await onDeclined()
  if (outcome.reason === 'failed') {
    return { ...fallback, note: outcome.error ?? 'Elevation failed.' }
  }
  return fallback
}
