import { readFile } from 'node:fs/promises'
import type { MemSnapshot } from '@shared/ipc'

/** Parse /proc/meminfo into a map of bytes (values are reported in kB). */
async function readMeminfo(): Promise<Record<string, number>> {
  const text = await readFile('/proc/meminfo', 'utf8')
  const out: Record<string, number> = {}
  for (const line of text.split('\n')) {
    const m = line.match(/^(\w+):\s+(\d+)\s*kB$/)
    if (m) out[m[1]] = Number(m[2]) * 1024
  }
  return out
}

export class MemoryCollector {
  async snapshot(): Promise<MemSnapshot> {
    const m = await readMeminfo()
    const totalBytes = m.MemTotal ?? 0
    const freeBytes = m.MemFree ?? 0
    // MemAvailable is the kernel's best estimate of allocatable memory.
    const availableBytes = m.MemAvailable ?? freeBytes + (m.Cached ?? 0) + (m.Buffers ?? 0)
    const cachedBytes = (m.Cached ?? 0) + (m.SReclaimable ?? 0)
    const buffersBytes = m.Buffers ?? 0
    // "Used" excludes reclaimable cache/buffers, matching free(1)'s used column.
    const usedBytes = Math.max(0, totalBytes - availableBytes)
    const swapTotalBytes = m.SwapTotal ?? 0
    const swapUsedBytes = Math.max(0, swapTotalBytes - (m.SwapFree ?? 0))

    return {
      totalBytes,
      usedBytes,
      freeBytes,
      availableBytes,
      cachedBytes,
      buffersBytes,
      swapTotalBytes,
      swapUsedBytes,
      percent: totalBytes ? (usedBytes / totalBytes) * 100 : 0
    }
  }
}
