import os from 'node:os'
import { readFile } from 'node:fs/promises'
import { app } from 'electron'
import type { SystemInfo } from '@shared/ipc'

/** Parse the key=value pairs of /etc/os-release (values may be quoted). */
async function readOsRelease(): Promise<Record<string, string>> {
  for (const path of ['/etc/os-release', '/usr/lib/os-release']) {
    try {
      const text = await readFile(path, 'utf8')
      const out: Record<string, string> = {}
      for (const line of text.split('\n')) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
        if (!m) continue
        out[m[1]] = m[2].replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
      }
      return out
    } catch {
      // try next path
    }
  }
  return {}
}

/** Classify the distro into a backend family used to select adapters later. */
function classifyFamily(id: string, idLike: string[]): SystemInfo['family'] {
  const tokens = [id, ...idLike].map((t) => t.toLowerCase())
  if (tokens.some((t) => ['debian', 'ubuntu'].includes(t))) return 'debian'
  if (tokens.some((t) => ['arch', 'archlinux'].includes(t))) return 'arch'
  return 'unknown'
}

/** Read a single sysfs/proc file, trimmed; undefined if unreadable or empty. */
async function readMaybe(path: string): Promise<string | undefined> {
  try {
    const v = (await readFile(path, 'utf8')).trim()
    return v.length ? v : undefined
  } catch {
    return undefined
  }
}

/** SMBIOS chassis_type code → human label (subset of the DMI spec). */
const CHASSIS_TYPES: Record<string, string> = {
  '1': 'Other',
  '2': 'Unknown',
  '3': 'Desktop',
  '4': 'Low Profile Desktop',
  '5': 'Pizza Box',
  '6': 'Mini Tower',
  '7': 'Tower',
  '8': 'Portable',
  '9': 'Laptop',
  '10': 'Notebook',
  '11': 'Hand Held',
  '13': 'All in One',
  '14': 'Sub Notebook',
  '15': 'Space-saving',
  '16': 'Lunch Box',
  '17': 'Main Server Chassis',
  '23': 'Rack Mount Chassis',
  '30': 'Tablet',
  '31': 'Convertible',
  '32': 'Detachable'
}

/** Read motherboard / BIOS / product identifiers from DMI sysfs (no root needed). */
async function readDmi(): Promise<Partial<SystemInfo>> {
  const base = '/sys/devices/virtual/dmi/id'
  const [
    boardVendor,
    boardName,
    boardVersion,
    productName,
    sysVendor,
    chassisCode,
    biosVendor,
    biosVersion,
    biosDate
  ] = await Promise.all([
    readMaybe(`${base}/board_vendor`),
    readMaybe(`${base}/board_name`),
    readMaybe(`${base}/board_version`),
    readMaybe(`${base}/product_name`),
    readMaybe(`${base}/sys_vendor`),
    readMaybe(`${base}/chassis_type`),
    readMaybe(`${base}/bios_vendor`),
    readMaybe(`${base}/bios_version`),
    readMaybe(`${base}/bios_date`)
  ])
  return {
    boardVendor,
    boardName,
    boardVersion,
    productName,
    sysVendor,
    chassis: chassisCode ? CHASSIS_TYPES[chassisCode] ?? `Type ${chassisCode}` : undefined,
    biosVendor,
    biosVersion,
    biosDate
  }
}

/** CPU topology from /proc/cpuinfo: vendor, physical cores, socket count. */
async function readCpuTopology(): Promise<Partial<SystemInfo>> {
  const text = await readMaybe('/proc/cpuinfo')
  if (!text) return {}
  const vendor = text.match(/^vendor_id\s*:\s*(.+)$/m)?.[1]?.trim()
  const coresPerSocket = Number(text.match(/^cpu cores\s*:\s*(\d+)/m)?.[1] ?? 0)
  const physicalIds = new Set(
    [...text.matchAll(/^physical id\s*:\s*(\d+)/gm)].map((m) => m[1])
  )
  const sockets = physicalIds.size || 1
  return {
    cpuVendor: vendor,
    cpuPhysicalCores: coresPerSocket ? coresPerSocket * sockets : undefined,
    cpuSockets: sockets
  }
}

/** CPU min/max frequency (kHz → MHz) from cpufreq, if exposed. */
async function readCpuFreqRange(): Promise<{ cpuMinMhz?: number; cpuMaxMhz?: number }> {
  const base = '/sys/devices/system/cpu/cpu0/cpufreq'
  const [min, max] = await Promise.all([
    readMaybe(`${base}/cpuinfo_min_freq`),
    readMaybe(`${base}/cpuinfo_max_freq`)
  ])
  return {
    cpuMinMhz: min ? Math.round(Number(min) / 1000) : undefined,
    cpuMaxMhz: max ? Math.round(Number(max) / 1000) : undefined
  }
}

/** Swap total from /proc/meminfo (kB → bytes). */
async function readSwapTotal(): Promise<number | undefined> {
  const text = await readMaybe('/proc/meminfo')
  const m = text?.match(/^SwapTotal:\s+(\d+)\s*kB$/m)
  return m ? Number(m[1]) * 1024 : undefined
}

/** PID 1's comm name → init system (systemd / openrc / runit / …). */
async function readInitSystem(): Promise<string | undefined> {
  const comm = await readMaybe('/proc/1/comm')
  return comm
}

export async function collectSystemInfo(): Promise<SystemInfo> {
  const osRelease = await readOsRelease()
  const distroId = osRelease.ID ?? ''
  const distroLike = (osRelease.ID_LIKE ?? '').split(/\s+/).filter(Boolean)
  const cpus = os.cpus()

  const [dmi, topology, freqRange, swapTotalBytes, initSystem, machineId] = await Promise.all([
    readDmi(),
    readCpuTopology(),
    readCpuFreqRange(),
    readSwapTotal(),
    readInitSystem(),
    readMaybe('/etc/machine-id')
  ])

  return {
    hostname: os.hostname(),
    platform: osRelease.PRETTY_NAME ?? `${os.type()} ${os.release()}`,
    distroId,
    distroLike,
    family: classifyFamily(distroId, distroLike),
    osVersion: osRelease.VERSION ?? osRelease.VERSION_ID,
    kernel: os.release(),
    arch: os.arch(),
    uptimeSec: Math.floor(os.uptime()),

    cpuModel: cpus[0]?.model.trim() ?? 'Unknown CPU',
    cpuCount: cpus.length,
    ...topology,
    ...freqRange,
    virtualization: undefined, // requires lscpu; left for a later enrichment pass

    totalMemBytes: os.totalmem(),
    swapTotalBytes,

    ...dmi,

    desktop: process.env.XDG_CURRENT_DESKTOP || process.env.DESKTOP_SESSION || undefined,
    sessionType: process.env.XDG_SESSION_TYPE || undefined,
    shell: process.env.SHELL || undefined,
    initSystem,
    machineId: machineId?.slice(0, 12),

    appVersion: app.getVersion()
  }
}
