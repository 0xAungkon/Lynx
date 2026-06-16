import os from 'node:os'
import { readFile } from 'node:fs/promises'
import type { NetInterface, NetSnapshot } from '@shared/ipc'

interface RawCounters {
  rx: number
  tx: number
}

/** Per-interface cumulative byte counters from /proc/net/dev. */
async function readNetDev(): Promise<Map<string, RawCounters>> {
  const text = await readFile('/proc/net/dev', 'utf8')
  const out = new Map<string, RawCounters>()
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([^:]+):\s*(.*)$/)
    if (!m) continue
    const name = m[1].trim()
    const cols = m[2].trim().split(/\s+/).map(Number)
    // rx bytes is the first column, tx bytes is the ninth.
    if (cols.length < 9) continue
    out.set(name, { rx: cols[0], tx: cols[8] })
  }
  return out
}

/** operstate from sysfs ("up"/"down"/"unknown"). */
async function isUp(name: string): Promise<boolean> {
  try {
    const state = (await readFile(`/sys/class/net/${name}/operstate`, 'utf8')).trim()
    return state === 'up' || state === 'unknown'
  } catch {
    return false
  }
}

/** First non-internal address assigned to an interface. */
function addressFor(name: string): string | undefined {
  const addrs = os.networkInterfaces()[name]
  const v4 = addrs?.find((a) => a.family === 'IPv4' && !a.internal)
  const v6 = addrs?.find((a) => a.family === 'IPv6' && !a.internal)
  return v4?.address ?? v6?.address
}

export class NetCollector {
  private prev: Map<string, RawCounters> | null = null
  private prevTime = 0

  async snapshot(): Promise<NetSnapshot> {
    const raw = await readNetDev()
    const now = Date.now()
    const dt = this.prev ? (now - this.prevTime) / 1000 : 0

    const interfaces: NetInterface[] = []
    let totalRxPerSec = 0
    let totalTxPerSec = 0

    for (const [name, cur] of raw) {
      const prev = this.prev?.get(name)
      let rxBytesPerSec = 0
      let txBytesPerSec = 0
      if (prev && dt > 0) {
        rxBytesPerSec = Math.max(0, (cur.rx - prev.rx) / dt)
        txBytesPerSec = Math.max(0, (cur.tx - prev.tx) / dt)
      }
      if (name !== 'lo') {
        totalRxPerSec += rxBytesPerSec
        totalTxPerSec += txBytesPerSec
      }
      interfaces.push({
        name,
        address: addressFor(name),
        rxBytes: cur.rx,
        txBytes: cur.tx,
        rxBytesPerSec,
        txBytesPerSec,
        up: name === 'lo' ? true : await isUp(name)
      })
    }

    interfaces.sort((a, b) => (a.name === 'lo' ? 1 : b.name === 'lo' ? -1 : a.name.localeCompare(b.name)))
    this.prev = raw
    this.prevTime = now

    return { interfaces, totalRxPerSec, totalTxPerSec }
  }
}
