import os from 'node:os'
import { readFile, readdir } from 'node:fs/promises'
import type { ProcessInfo, ProcessList, ProcessState } from '@shared/ipc'

const PAGE_SIZE = 4096
const STATE_MAP: Record<string, ProcessState> = {
  R: 'running',
  S: 'sleeping',
  D: 'sleeping',
  T: 'stopped',
  t: 'stopped',
  Z: 'zombie',
  I: 'idle'
}

/** Build a uid → username map from /etc/passwd (best-effort, cached per call). */
async function readPasswd(): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  try {
    const text = await readFile('/etc/passwd', 'utf8')
    for (const line of text.split('\n')) {
      const f = line.split(':')
      if (f.length >= 3) {
        const uid = Number(f[2])
        if (!Number.isNaN(uid) && !map.has(uid)) map.set(uid, f[0])
      }
    }
  } catch {
    // fall back to numeric uids
  }
  return map
}

interface RawProc {
  pid: number
  ppid: number
  name: string
  state: ProcessState
  jiffies: number
  rssBytes: number
}

/** Parse /proc/<pid>/stat, handling comm fields that contain spaces or parens. */
function parseStat(pid: number, stat: string): Omit<RawProc, 'rssBytes'> | null {
  const open = stat.indexOf('(')
  const close = stat.lastIndexOf(')')
  if (open < 0 || close < 0) return null
  const name = stat.slice(open + 1, close)
  const rest = stat.slice(close + 2).split(/\s+/)
  // rest[0] = state (field 3); utime = field 14 → rest[11]; stime = field 15 → rest[12].
  const state = STATE_MAP[rest[0]] ?? 'unknown'
  const ppid = Number(rest[1])
  const utime = Number(rest[11])
  const stime = Number(rest[12])
  if (Number.isNaN(utime) || Number.isNaN(stime)) return null
  return { pid, ppid, name, state, jiffies: utime + stime }
}

/** Total CPU jiffies across all cores from /proc/stat's aggregate line. */
async function readTotalCpuJiffies(): Promise<number> {
  const text = await readFile('/proc/stat', 'utf8')
  const first = text.split('\n')[0]
  const nums = first.trim().split(/\s+/).slice(1).map(Number)
  return nums.reduce((a, b) => a + (Number.isNaN(b) ? 0 : b), 0)
}

export class ProcCollector {
  private prevJiffies = new Map<number, number>()
  private prevTotalCpu = 0
  private readonly totalMem = os.totalmem()
  private readonly cpuCount = os.cpus().length

  async snapshot(): Promise<ProcessList> {
    const [entries, passwd, totalCpu] = await Promise.all([
      readdir('/proc'),
      readPasswd(),
      readTotalCpuJiffies()
    ])
    const pids = entries.filter((e) => /^\d+$/.test(e)).map(Number)
    const totalCpuDelta = this.prevTotalCpu ? totalCpu - this.prevTotalCpu : 0

    const reads = await Promise.allSettled(pids.map((pid) => this.readOne(pid, passwd, totalCpuDelta)))
    const processes: ProcessInfo[] = []
    const nextJiffies = new Map<number, number>()

    for (const r of reads) {
      if (r.status === 'fulfilled' && r.value) {
        processes.push(r.value.info)
        nextJiffies.set(r.value.info.pid, r.value.jiffies)
      }
    }

    this.prevJiffies = nextJiffies
    this.prevTotalCpu = totalCpu

    return { processes, cpuCount: this.cpuCount }
  }

  private async readOne(
    pid: number,
    passwd: Map<number, string>,
    totalCpuDelta: number
  ): Promise<{ info: ProcessInfo; jiffies: number } | null> {
    let statText: string
    let statmText: string
    try {
      ;[statText, statmText] = await Promise.all([
        readFile(`/proc/${pid}/stat`, 'utf8'),
        readFile(`/proc/${pid}/statm`, 'utf8')
      ])
    } catch {
      return null // process exited between listing and reading
    }

    const parsed = parseStat(pid, statText)
    if (!parsed) return null

    const residentPages = Number(statmText.trim().split(/\s+/)[1] ?? 0)
    const rssBytes = residentPages * PAGE_SIZE

    // CPU% normalized so 100 == one fully-used logical core.
    const prev = this.prevJiffies.get(pid)
    let cpuPercent = 0
    if (prev !== undefined && totalCpuDelta > 0) {
      cpuPercent = Math.max(0, ((parsed.jiffies - prev) / totalCpuDelta) * this.cpuCount * 100)
    }

    const [cmdline, user] = await Promise.all([
      this.readCmdline(pid, parsed.name),
      this.readUser(pid, passwd)
    ])

    return {
      info: {
        pid,
        ppid: parsed.ppid,
        name: parsed.name,
        cmdline,
        user,
        state: parsed.state,
        cpuPercent: Math.round(cpuPercent * 10) / 10,
        memBytes: rssBytes,
        memPercent: this.totalMem ? (rssBytes / this.totalMem) * 100 : 0
      },
      jiffies: parsed.jiffies
    }
  }

  private async readCmdline(pid: number, fallback: string): Promise<string> {
    try {
      const raw = await readFile(`/proc/${pid}/cmdline`, 'utf8')
      const cmd = raw.replace(/\0/g, ' ').trim()
      return cmd || `[${fallback}]`
    } catch {
      return `[${fallback}]`
    }
  }

  private async readUser(pid: number, passwd: Map<number, string>): Promise<string> {
    try {
      const status = await readFile(`/proc/${pid}/status`, 'utf8')
      const m = status.match(/^Uid:\s+(\d+)/m)
      if (m) {
        const uid = Number(m[1])
        return passwd.get(uid) ?? String(uid)
      }
    } catch {
      // ignore
    }
    return '?'
  }
}
