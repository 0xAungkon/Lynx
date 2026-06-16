import { lstat, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Dirent } from 'node:fs'
import type { DirScan, ScanEntry } from '@shared/ipc'

/**
 * ncdu-style directory scanner. Lists the immediate children of `path` and sizes
 * each one — files by their own size, directories by a recursive `du`-style sum.
 *
 * Safety/robustness:
 *  - Uses lstat throughout and never follows symlinks (a symlink is counted as
 *    its own small size, never traversed) — avoids cycles and escaping the tree.
 *  - Stays on the scan root's filesystem: a child directory on a different device
 *    (a separate mount) is reported but not summed, so /proc, /sys and other
 *    mounts don't inflate or hang the scan.
 *  - Per-child errors (EACCES, races) are caught and surfaced on the entry; the
 *    scan never throws because one subtree was unreadable.
 */

/** Recursively sum a directory subtree, staying on `rootDev`. Best-effort. */
async function dirSize(
  dir: string,
  rootDev: number,
  acc: { hadError: boolean }
): Promise<number> {
  let dirents: Dirent[]
  try {
    dirents = await readdir(dir, { withFileTypes: true })
  } catch {
    acc.hadError = true
    return 0
  }

  let total = 0
  // Bounded fan-out: one level at a time keeps memory/fd pressure reasonable.
  const sizes = await Promise.all(
    dirents.map(async (d) => {
      const child = join(dir, d.name)
      let st
      try {
        st = await lstat(child)
      } catch {
        acc.hadError = true
        return 0
      }
      if (st.isSymbolicLink()) return st.size
      if (st.isDirectory()) {
        if (st.dev !== rootDev) return 0 // different mount — don't descend
        return dirSize(child, rootDev, acc)
      }
      return st.size
    })
  )
  for (const s of sizes) total += s
  return total
}

export async function scanDir(path: string): Promise<DirScan> {
  let rootDev: number
  try {
    rootDev = (await lstat(path)).dev
  } catch (e) {
    return {
      path,
      totalBytes: 0,
      entries: [],
      note: e instanceof Error ? e.message : 'Path is not accessible.'
    }
  }

  let dirents: Dirent[]
  try {
    dirents = await readdir(path, { withFileTypes: true })
  } catch (e) {
    return {
      path,
      totalBytes: 0,
      entries: [],
      note: e instanceof Error ? e.message : 'Directory is not readable.'
    }
  }

  let partial = false
  const entries: ScanEntry[] = await Promise.all(
    dirents.map(async (d): Promise<ScanEntry> => {
      const child = join(path, d.name)
      let st
      try {
        st = await lstat(child)
      } catch (e) {
        partial = true
        return {
          name: d.name,
          path: child,
          sizeBytes: 0,
          isDir: false,
          error: e instanceof Error ? e.message : 'unreadable'
        }
      }

      if (st.isSymbolicLink()) {
        return { name: d.name, path: child, sizeBytes: st.size, isDir: false }
      }
      if (st.isDirectory()) {
        const acc = { hadError: false }
        // Children on another mount are listed but not recursively sized.
        const sameFs = st.dev === rootDev
        const size = sameFs ? await dirSize(child, rootDev, acc) : 0
        if (acc.hadError) partial = true
        let entryCount: number | undefined
        try {
          entryCount = (await readdir(child)).length
        } catch {
          entryCount = undefined
        }
        return {
          name: d.name,
          path: child,
          sizeBytes: size,
          isDir: true,
          entryCount,
          error: sameFs ? undefined : 'separate filesystem (not summed)'
        }
      }
      return { name: d.name, path: child, sizeBytes: st.size, isDir: false }
    })
  )

  entries.sort((a, b) => b.sizeBytes - a.sizeBytes)
  const totalBytes = entries.reduce((sum, e) => sum + e.sizeBytes, 0)

  return {
    path,
    totalBytes,
    entries,
    note: partial ? 'Some items could not be read (permission denied).' : undefined
  }
}
