import os from 'node:os'
import { readFile, readdir } from 'node:fs/promises'
import type { CpuSnapshot } from '@shared/ipc'

/** Cumulative jiffie counters from one /proc/stat cpu line. */
interface CpuTimes {
  busy: number
  total: number
}

/** Parse a `cpu …` line into busy/total jiffies (idle = idle + iowait). */
function parseCpuLine(line: string): CpuTimes | null {
  const parts = line.trim().split(/\s+/)
  if (!parts[0]?.startsWith('cpu')) return null
  const nums = parts.slice(1).map(Number)
  if (nums.length < 4 || nums.some(Number.isNaN)) return null
  const [user, nice, system, idle, iowait = 0, irq = 0, softirq = 0, steal = 0] = nums
  const idleAll = idle + iowait
  const total = user + nice + system + idleAll + irq + softirq + steal
  return { busy: total - idleAll, total }
}

/** Average current core frequency in MHz from cpufreq sysfs, falling back to os.cpus(). */
async function readFreqMhz(): Promise<number> {
  try {
    const base = '/sys/devices/system/cpu'
    const entries = await readdir(base)
    const cores = entries.filter((e) => /^cpu\d+$/.test(e))
    const reads = await Promise.allSettled(
      cores.map((c) => readFile(`${base}/${c}/cpufreq/scaling_cur_freq`, 'utf8'))
    )
    const khz = reads
      .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
      .map((r) => Number(r.value.trim()))
      .filter((n) => n > 0)
    if (khz.length) return Math.round(khz.reduce((a, b) => a + b, 0) / khz.length / 1000)
  } catch {
    // fall through
  }
  const speeds = os.cpus().map((c) => c.speed)
  return speeds.length ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : 0
}

/** Highest CPU package/core temperature (°C) from hwmon, if any sensor matches. */
async function readTempC(): Promise<number | undefined> {
  const base = '/sys/class/hwmon'
  try {
    const hwmons = await readdir(base)
    let max: number | undefined
    for (const h of hwmons) {
      let name = ''
      try {
        name = (await readFile(`${base}/${h}/name`, 'utf8')).trim()
      } catch {
        continue
      }
      if (!/coretemp|k10temp|zenpower|cpu_thermal|cpu/i.test(name)) continue
      let files: string[] = []
      try {
        files = await readdir(`${base}/${h}`)
      } catch {
        continue
      }
      for (const f of files.filter((f) => /^temp\d+_input$/.test(f))) {
        try {
          const milli = Number((await readFile(`${base}/${h}/${f}`, 'utf8')).trim())
          if (milli > 0) {
            const c = milli / 1000
            if (max === undefined || c > max) max = c
          }
        } catch {
          // skip
        }
      }
    }
    return max
  } catch {
    return undefined
  }
}

/**
 * CPU telemetry. Utilization is delta-based: each snapshot diffs /proc/stat
 * against the previous read, so the first call after construction reports 0
 * until a baseline exists.
 */
export class CpuCollector {
  private prevTotal: CpuTimes | null = null
  private prevCores: CpuTimes[] = []

  async snapshot(): Promise<CpuSnapshot> {
    const stat = await readFile('/proc/stat', 'utf8')
    const lines = stat.split('\n')

    const total = parseCpuLine(lines[0])
    const cores: CpuTimes[] = []
    for (const line of lines.slice(1)) {
      if (!/^cpu\d+ /.test(line)) break
      const t = parseCpuLine(line)
      if (t) cores.push(t)
    }

    const usage = this.delta(total, this.prevTotal)
    const perCore = cores.map((c, i) => this.delta(c, this.prevCores[i] ?? null))

    this.prevTotal = total
    this.prevCores = cores

    const [freqMhz, tempC] = await Promise.all([readFreqMhz(), readTempC()])
    const cpus = os.cpus()

    return {
      usage,
      perCore,
      freqMhz,
      loadAvg: os.loadavg() as [number, number, number],
      model: cpus[0]?.model.trim() ?? 'Unknown CPU',
      cores: cpus.length,
      tempC
    }
  }

  private delta(cur: CpuTimes | null, prev: CpuTimes | null): number {
    if (!cur || !prev) return 0
    const totalDiff = cur.total - prev.total
    if (totalDiff <= 0) return 0
    const busyDiff = cur.busy - prev.busy
    return Math.max(0, Math.min(100, (busyDiff / totalDiff) * 100))
  }
}
