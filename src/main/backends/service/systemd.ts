import type {
  ActionResult,
  JournalLine,
  JournalResult,
  ServiceControlRequest,
  ServiceList,
  ServiceUnit
} from '@shared/ipc'
import { runPrivileged } from '../../privilege/run'
import { userExec } from '../../privilege/sudo'

interface RawUnit {
  unit: string
  load: string
  active: string
  sub: string
  description: string
}
interface RawUnitFile {
  unit_file: string
  state: string
}
interface RawJournal {
  __REALTIME_TIMESTAMP?: string
  MESSAGE?: string | number[]
  PRIORITY?: string
  SYSLOG_IDENTIFIER?: string
  _COMM?: string
  _PID?: string
}

/** Journald MESSAGE may be a byte array for non-UTF8 lines; normalize to text. */
function decodeMessage(msg: string | number[] | undefined): string {
  if (typeof msg === 'string') return msg
  if (Array.isArray(msg)) return Buffer.from(msg).toString('utf8')
  return ''
}

/**
 * systemd ServiceBackend. `list` is read-only (runs as the user); `control`
 * mutates system units and is routed through the privilege manager. `logs`
 * reads journald as the user — sufficient for many units, with a note when the
 * journal is restricted.
 */
export class SystemdBackend {
  async list(): Promise<ServiceList> {
    const [unitsRaw, filesRaw] = await Promise.all([
      userExec(['systemctl', 'list-units', '--type=service', '--all', '--output=json', '--no-pager']),
      userExec(['systemctl', 'list-unit-files', '--type=service', '--output=json', '--no-pager'])
    ])

    // Map unit-file enable state (enabled/disabled/static/masked) by unit name.
    const stateByName = new Map<string, string>()
    try {
      const files = JSON.parse(filesRaw.stdout || '[]') as RawUnitFile[]
      for (const f of files) stateByName.set(f.unit_file, f.state)
    } catch {
      // tolerate missing/garbled file listing
    }

    let raw: RawUnit[] = []
    try {
      raw = JSON.parse(unitsRaw.stdout || '[]') as RawUnit[]
    } catch {
      raw = []
    }

    const units: ServiceUnit[] = raw
      .filter((u) => u.unit?.endsWith('.service'))
      .map((u) => ({
        name: u.unit,
        description: u.description ?? '',
        loadState: u.load ?? '',
        activeState: u.active ?? '',
        subState: u.sub ?? '',
        unitFileState: stateByName.get(u.unit) ?? ''
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return { units }
  }

  async control({ unit, op }: ServiceControlRequest): Promise<ActionResult> {
    // Guard: only operate on .service units we listed; reject odd input early.
    if (!/^[\w@.\-:\\]+\.service$/.test(unit)) {
      return { ok: false, usedPrivilege: 'user', error: `Refusing to operate on invalid unit "${unit}".` }
    }

    return runPrivileged(
      ['systemctl', op, unit],
      {
        action: `${op[0].toUpperCase()}${op.slice(1)} ${unit}`,
        reason: `Managing the system service "${unit}" requires administrator access.`
      },
      // No meaningful user-scoped fallback for system units — report skipped.
      async () => ({
        ok: false,
        usedPrivilege: 'user',
        note: `Ran without root; "${op} ${unit}" was skipped.`
      })
    )
  }

  async logs(unit: string, lines = 200): Promise<JournalResult> {
    if (!/^[\w@.\-:\\]+\.service$/.test(unit)) {
      return { lines: [], note: `Invalid unit "${unit}".` }
    }
    const r = await userExec([
      'journalctl',
      '-u',
      unit,
      '-n',
      String(lines),
      '-o',
      'json',
      '--no-pager'
    ])

    if (r.code !== 0) {
      return {
        lines: [],
        note: 'Could not read this unit’s journal as the current user (it may require the systemd-journal group).'
      }
    }

    const out: JournalLine[] = []
    for (const line of r.stdout.split('\n')) {
      if (!line.trim()) continue
      try {
        const e = JSON.parse(line) as RawJournal
        out.push({
          timestamp: e.__REALTIME_TIMESTAMP ? Number(e.__REALTIME_TIMESTAMP) / 1000 : 0,
          message: decodeMessage(e.MESSAGE),
          priority: e.PRIORITY ? Number(e.PRIORITY) : 6,
          identifier: e.SYSLOG_IDENTIFIER ?? e._COMM,
          pid: e._PID ? Number(e._PID) : undefined
        })
      } catch {
        // skip malformed journal line
      }
    }
    return { lines: out, note: out.length === 0 ? 'No journal entries for this unit.' : undefined }
  }
}

export const systemd = new SystemdBackend()
