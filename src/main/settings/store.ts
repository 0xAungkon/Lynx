import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { AppSettings, type SettingsPatch } from '@shared/ipc'

/**
 * Persisted application settings. Only the privilege preferences live here —
 * they must be enforced in the main process (idea.md §5.3), so they can't be a
 * renderer-only concern. Refresh rate and theme are renderer-owned (localStorage).
 *
 * Storage is a plain JSON file under the user profile (app.getPath('userData')),
 * written with node:fs — no external dependency, nothing added to the shipped
 * binary. A missing or corrupt file falls back to DEFAULTS rather than throwing.
 */

const DEFAULTS: AppSettings = { privilegeMode: 'always', cacheTtlMinutes: 5 }

let cached: AppSettings | null = null

function file(): string {
  return join(app.getPath('userData'), 'settings.json')
}

/** Read settings from disk (cached after the first read). */
export function load(): AppSettings {
  if (cached) return cached
  try {
    cached = AppSettings.parse(JSON.parse(readFileSync(file(), 'utf8')))
  } catch {
    // Missing or corrupt — start from defaults (don't overwrite on read).
    cached = { ...DEFAULTS }
  }
  return cached
}

/** Merge a patch over the current settings, persist, and return the result. */
export function save(patch: SettingsPatch): AppSettings {
  const next = AppSettings.parse({ ...load(), ...patch })
  cached = next
  try {
    writeFileSync(file(), JSON.stringify(next, null, 2), 'utf8')
  } catch {
    // Best-effort: an unwritable profile dir shouldn't crash the app; the
    // in-memory value still takes effect for this session.
  }
  return next
}
