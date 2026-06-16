import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ActionResult, DeleteRequest } from '@shared/ipc'
import { runPrivileged } from '../privilege/run'

/** Top-level paths we refuse to delete outright, regardless of privilege. */
const PROTECTED = new Set([
  '/',
  '/boot',
  '/etc',
  '/bin',
  '/sbin',
  '/lib',
  '/lib64',
  '/usr',
  '/var',
  '/proc',
  '/sys',
  '/dev',
  '/run',
  '/home',
  '/root',
  '/opt'
])

/**
 * Delete a file or directory (recursively). We try as the current user first;
 * on a permission error we route through the privilege manager (rm -rf), which
 * surfaces the root-password prompt. Declining leaves the file in place with a
 * note — matching the §5 fallback rule used by the process actions.
 */
export async function deletePath({ path }: DeleteRequest): Promise<ActionResult> {
  const target = resolve(path)

  if (!target || target === '.') {
    return { ok: false, usedPrivilege: 'user', error: 'Refusing to delete an empty path.' }
  }
  if (PROTECTED.has(target)) {
    return {
      ok: false,
      usedPrivilege: 'user',
      error: `Refusing to delete a protected system path: ${target}`
    }
  }

  const deleteUser = async (): Promise<ActionResult> => {
    try {
      await rm(target, { recursive: true, force: true })
      return { ok: true, usedPrivilege: 'user' }
    } catch (e) {
      const err = e as NodeJS.ErrnoException
      return {
        ok: false,
        usedPrivilege: 'user',
        error: err.message,
        note:
          err.code === 'EACCES' || err.code === 'EPERM'
            ? 'Ran without root; deleting this path needs administrator access.'
            : undefined
      }
    }
  }

  // Attempt as the user; only escalate when it's a permission problem.
  try {
    await rm(target, { recursive: true, force: true })
    return { ok: true, usedPrivilege: 'user' }
  } catch (e) {
    const err = e as NodeJS.ErrnoException
    if (err.code !== 'EACCES' && err.code !== 'EPERM') {
      return { ok: false, usedPrivilege: 'user', error: err.message }
    }
  }

  return runPrivileged(
    ['rm', '-rf', '--', target],
    {
      action: `Delete ${target}`,
      reason: 'This path is owned by another user or root; deleting it requires administrator access.'
    },
    deleteUser
  )
}
