import { readFile, statfs } from 'node:fs/promises'
import { basename } from 'node:path'
import type { DiskSnapshot, Filesystem } from '@shared/ipc'

/** Pseudo/virtual filesystems we never want to surface as real storage. */
const VIRTUAL_FS = new Set([
  'proc', 'sysfs', 'devtmpfs', 'devpts', 'tmpfs', 'securityfs', 'cgroup', 'cgroup2',
  'pstore', 'efivarfs', 'bpf', 'autofs', 'mqueue', 'hugetlbfs', 'debugfs', 'tracefs',
  'fusectl', 'configfs', 'ramfs', 'binfmt_misc', 'rpc_pipefs', 'nsfs', 'squashfs',
  'overlay', 'fuse.portal', 'fuse.gvfsd-fuse'
])

interface MountEntry {
  source: string
  target: string
  fsType: string
}

/** Real, mounted block filesystems from /proc/mounts (deduped by device). */
async function readMounts(): Promise<MountEntry[]> {
  const text = await readFile('/proc/mounts', 'utf8')
  const seen = new Set<string>()
  const out: MountEntry[] = []
  for (const line of text.split('\n')) {
    const [rawSource, rawTarget, fsType] = line.split(' ')
    if (!rawSource || !rawTarget || !fsType) continue
    if (VIRTUAL_FS.has(fsType)) continue
    if (!rawSource.startsWith('/dev/')) continue
    if (seen.has(rawSource)) continue
    seen.add(rawSource)
    // /proc/mounts octal-escapes spaces etc. as \040.
    const target = rawTarget.replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
    out.push({ source: rawSource, target, fsType })
  }
  return out
}

/** Per-device read/write byte counters from /proc/diskstats. */
interface DiskstatsIO {
  /** Aggregate across whole-disk devices (excludes partitions/dm/loop). */
  aggregate: { read: number; write: number }
  /** Every device line keyed by name (partitions included), for per-fs rates. */
  perDevice: Map<string, { read: number; write: number }>
}

/** Read /proc/diskstats: aggregate over whole disks + a per-device map. */
async function readDiskstats(): Promise<DiskstatsIO> {
  const text = await readFile('/proc/diskstats', 'utf8')
  const perDevice = new Map<string, { read: number; write: number }>()
  let read = 0
  let write = 0
  for (const line of text.split('\n')) {
    const f = line.trim().split(/\s+/)
    if (f.length < 14) continue
    const name = f[2]
    const devRead = Number(f[5]) * 512 // sectors read → bytes
    const devWrite = Number(f[9]) * 512 // sectors written → bytes
    perDevice.set(name, { read: devRead, write: devWrite })

    // Aggregate only whole disks; skip partitions, loop, ram and dm noise.
    if (/^(loop|ram|dm-|sr|fd)/.test(name)) continue
    if (/\d$/.test(name) && /^(sd|hd|vd)/.test(name)) continue // sda1, vdb2 …
    if (/p\d+$/.test(name)) continue // nvme0n1p1 …
    read += devRead
    write += devWrite
  }
  return { aggregate: { read, write }, perDevice }
}

export class DiskCollector {
  private prev: { read: number; write: number; t: number } | null = null
  /** Previous per-device counters keyed by device name, for per-fs rates. */
  private prevDev = new Map<string, { read: number; write: number; t: number }>()

  async snapshot(): Promise<DiskSnapshot> {
    const mounts = await readMounts()
    const io = await readDiskstats()
    const now = Date.now()

    const filesystems: Filesystem[] = []
    for (const mnt of mounts) {
      try {
        const fs = await statfs(mnt.target)
        const bsize = Number(fs.bsize)
        const blocks = Number(fs.blocks)
        const bfree = Number(fs.bfree)
        const bavail = Number(fs.bavail)
        if (blocks === 0) continue
        const sizeBytes = blocks * bsize
        const availBytes = bavail * bsize
        const usedBytes = (blocks - bfree) * bsize
        const denom = usedBytes + availBytes

        // Per-device I/O rate for this filesystem's backing block device.
        const dev = basename(mnt.source)
        const cur = io.perDevice.get(dev)
        let readBytesPerSec = 0
        let writeBytesPerSec = 0
        if (cur) {
          const prev = this.prevDev.get(dev)
          if (prev) {
            const dt = (now - prev.t) / 1000
            if (dt > 0) {
              readBytesPerSec = Math.max(0, (cur.read - prev.read) / dt)
              writeBytesPerSec = Math.max(0, (cur.write - prev.write) / dt)
            }
          }
        }

        filesystems.push({
          source: mnt.source,
          target: mnt.target,
          fsType: mnt.fsType,
          sizeBytes,
          usedBytes,
          availBytes,
          percent: denom ? (usedBytes / denom) * 100 : 0,
          readBytesPerSec,
          writeBytesPerSec
        })
      } catch {
        // mount disappeared or permission denied — skip it
      }
    }
    filesystems.sort((a, b) => b.sizeBytes - a.sizeBytes)

    // Update per-device history for next delta (all devices, partitions too).
    for (const [dev, c] of io.perDevice) {
      this.prevDev.set(dev, { read: c.read, write: c.write, t: now })
    }

    let readBytesPerSec = 0
    let writeBytesPerSec = 0
    if (this.prev) {
      const dt = (now - this.prev.t) / 1000
      if (dt > 0) {
        readBytesPerSec = Math.max(0, (io.aggregate.read - this.prev.read) / dt)
        writeBytesPerSec = Math.max(0, (io.aggregate.write - this.prev.write) / dt)
      }
    }
    this.prev = { read: io.aggregate.read, write: io.aggregate.write, t: now }

    return { filesystems, readBytesPerSec, writeBytesPerSec }
  }
}
