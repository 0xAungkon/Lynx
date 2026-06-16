import { readFile } from 'node:fs/promises'
import type { ActionResult, KillRequest, ReniceRequest } from '@shared/ipc'
import { runPrivileged } from '../privilege/run'
import { userExec } from '../privilege/sudo'

/** Real uid that owns a process, from /proc/<pid>/status. null if it's gone. */
async function ownerUid(pid: number): Promise<number | null> {
  try {
    const status = await readFile(`/proc/${pid}/status`, 'utf8')
    const m = status.match(/^Uid:\s+(\d+)/m)
    return m ? Number(m[1]) : null
  } catch {
    return null
  }
}

/** Best-effort process name for human-readable prompt/labels. */
async function procName(pid: number): Promise<string> {
  try {
    const comm = await readFile(`/proc/${pid}/comm`, 'utf8')
    return comm.trim() || String(pid)
  } catch {
    return String(pid)
  }
}

const myUid = (): number => (typeof process.getuid === 'function' ? process.getuid() : -1)

/**
 * Send a signal to a process. If we own it, signal directly as the user; if it
 * belongs to another user, route through the privilege manager. When elevation
 * is declined we still attempt the user-scoped signal and report the degraded
 * result (it will simply fail with EPERM for a foreign process).
 */
export async function killProcess({ pid, signal }: KillRequest): Promise<ActionResult> {
  const uid = await ownerUid(pid)
  if (uid === null) {
    return { ok: false, usedPrivilege: 'user', error: `Process ${pid} no longer exists.` }
  }

  const name = await procName(pid)
  const signalUser = (): ActionResult => {
    try {
      process.kill(pid, `SIG${signal}`)
      return { ok: true, usedPrivilege: 'user' }
    } catch (e) {
      return {
        ok: false,
        usedPrivilege: 'user',
        error: e instanceof Error ? e.message : String(e),
        note: 'Ran without root; could not signal this process.'
      }
    }
  }

  if (uid === myUid()) return signalUser()

  return runPrivileged(
    ['kill', `-${signal}`, String(pid)],
    {
      action: `Send SIG${signal} to ${name} (PID ${pid})`,
      reason: `This process is owned by another user (uid ${uid}); signalling it requires administrator access.`
    },
    async () => signalUser()
  )
}

/**
 * Change a process's scheduling priority (niceness). Raising priority (negative
 * niceness) or renicing a foreign process needs root; lowering our own
 * process's priority is allowed as the user.
 */
export async function reniceProcess({ pid, priority }: ReniceRequest): Promise<ActionResult> {
  const uid = await ownerUid(pid)
  if (uid === null) {
    return { ok: false, usedPrivilege: 'user', error: `Process ${pid} no longer exists.` }
  }
  const name = await procName(pid)
  const argv = ['renice', '-n', String(priority), '-p', String(pid)]

  const reniceUser = async (): Promise<ActionResult> => {
    const r = await userExec(argv)
    if (r.code === 0) return { ok: true, usedPrivilege: 'user' }
    return {
      ok: false,
      usedPrivilege: 'user',
      error: r.stderr.trim() || `renice exited with code ${r.code}`,
      note: 'Ran without root; raising priority or renicing another user’s process needs administrator access.'
    }
  }

  const needsRoot = uid !== myUid() || priority < 0
  if (!needsRoot) return reniceUser()

  return runPrivileged(
    argv,
    {
      action: `Set priority of ${name} (PID ${pid}) to ${priority}`,
      reason:
        priority < 0
          ? 'Raising scheduling priority (negative niceness) requires administrator access.'
          : `This process is owned by another user (uid ${uid}); renicing it requires administrator access.`
    },
    reniceUser
  )
}
