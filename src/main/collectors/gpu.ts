import { execFile } from 'node:child_process'
import { readFile, readdir, readlink } from 'node:fs/promises'
import { basename } from 'node:path'
import { promisify } from 'node:util'
import type { GpuDevice, GpuProcess, GpuSnapshot } from '@shared/ipc'

const exec = promisify(execFile)
const MIB = 1024 * 1024

function num(s: string | undefined): number | undefined {
  if (s === undefined || s === null) return undefined
  const t = String(s).trim()
  if (!t || /^\[?n\/?a\]?$/i.test(t) || t === '[Not Supported]') return undefined
  const v = Number(t)
  return Number.isFinite(v) ? v : undefined
}

async function readStr(path: string): Promise<string | undefined> {
  try {
    const v = (await readFile(path, 'utf8')).trim()
    return v.length ? v : undefined
  } catch {
    return undefined
  }
}

async function readNum(path: string): Promise<number | undefined> {
  return num(await readStr(path))
}

/* ------------------------------------------------------------------ *
 * NVIDIA — nvidia-smi CSV
 * ------------------------------------------------------------------ */

const NVIDIA_FIELDS = [
  'index',
  'name',
  'pci.bus_id',
  'driver_version',
  'vbios_version',
  'utilization.gpu',
  'utilization.memory',
  'utilization.encoder',
  'utilization.decoder',
  'memory.used',
  'memory.total',
  'temperature.gpu',
  'fan.speed',
  'power.draw',
  'enforced.power.limit',
  'clocks.current.graphics',
  'clocks.max.graphics',
  'clocks.current.memory',
  'clocks.max.memory',
  'pstate'
].join(',')

async function readNvidia(): Promise<GpuDevice[]> {
  try {
    const { stdout } = await exec(
      'nvidia-smi',
      [`--query-gpu=${NVIDIA_FIELDS}`, '--format=csv,noheader,nounits'],
      { timeout: 4000 }
    )
    const gpus: GpuDevice[] = []
    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue
      const c = line.split(',').map((x) => x.trim())
      const memUsed = num(c[9])
      const memTotal = num(c[10])
      gpus.push({
        index: num(c[0]) ?? gpus.length,
        name: c[1] || 'NVIDIA GPU',
        vendor: 'nvidia',
        vendorName: 'NVIDIA Corporation',
        driver: 'nvidia',
        busId: c[2]?.toLowerCase() || undefined,
        driverVersion: c[3] || undefined,
        vbiosVersion: c[4] || undefined,
        utilization: num(c[5]),
        memUtilization: num(c[6]),
        encUtilization: num(c[7]),
        decUtilization: num(c[8]),
        memUsedBytes: memUsed !== undefined ? memUsed * MIB : undefined,
        memTotalBytes: memTotal !== undefined ? memTotal * MIB : undefined,
        tempC: num(c[11]),
        fanPercent: num(c[12]),
        powerW: num(c[13]),
        powerLimitW: num(c[14]),
        clockMhz: num(c[15]),
        clockMaxMhz: num(c[16]),
        memClockMhz: num(c[17]),
        memClockMaxMhz: num(c[18]),
        perfLevel: c[19] || undefined
      })
    }
    return gpus
  } catch {
    return [] // nvidia-smi not installed / no NVIDIA GPU
  }
}

/* ------------------------------------------------------------------ *
 * DRM sysfs — works for any card exposed under /sys/class/drm.
 * AMD (amdgpu) and Intel (i915/xe) publish rich telemetry here; the NVIDIA
 * proprietary driver does not, so those are read via nvidia-smi instead.
 * ------------------------------------------------------------------ */

/** PCI vendor id → our vendor tag + a default marketing string. */
const PCI_VENDORS: Record<string, { vendor: GpuDevice['vendor']; vendorName: string }> = {
  '0x1002': { vendor: 'amd', vendorName: 'Advanced Micro Devices, Inc. [AMD/ATI]' },
  '0x8086': { vendor: 'intel', vendorName: 'Intel Corporation' },
  '0x10de': { vendor: 'nvidia', vendorName: 'NVIDIA Corporation' }
}

/** Parse a pp_dpm_*clk table; returns the current (*) and the max level in MHz. */
function parseDpm(text: string | undefined): { current?: number; max?: number } {
  if (!text) return {}
  let current: number | undefined
  let max: number | undefined
  for (const line of text.split('\n')) {
    const m = line.match(/(\d+)\s*Mhz/i)
    if (!m) continue
    const mhz = Number(m[1])
    if (max === undefined || mhz > max) max = mhz
    if (line.includes('*')) current = mhz
  }
  return { current, max }
}

/** Find the first hwmon directory under a card's device node. */
async function findHwmon(dev: string): Promise<string | undefined> {
  try {
    const entries = await readdir(`${dev}/hwmon`)
    const hw = entries.find((e) => /^hwmon\d+$/.test(e))
    return hw ? `${dev}/hwmon/${hw}` : undefined
  } catch {
    return undefined
  }
}

interface HwmonReadout {
  tempC?: number
  tempHotspotC?: number
  tempMemC?: number
  powerW?: number
  powerLimitW?: number
  fanRpm?: number
  voltageMv?: number
}

/**
 * Read a hwmon node generically: discover every temp*_input present (count and
 * numbering vary by driver), resolve each by its *_label, and pick up power,
 * fan and voltage from whichever standard nodes the driver exposes.
 */
async function readHwmon(hwmon: string): Promise<HwmonReadout> {
  let entries: string[]
  try {
    entries = await readdir(hwmon)
  } catch {
    return {}
  }

  const out: HwmonReadout = {}

  // Temperatures: one entry per temp<N>_input file actually present.
  const tempIdx = [...new Set(entries.map((e) => e.match(/^temp(\d+)_input$/)?.[1]).filter(Boolean))]
  const temps = await Promise.all(
    tempIdx.map(async (i) => ({
      label: (await readStr(`${hwmon}/temp${i}_label`))?.toLowerCase(),
      val: await readNum(`${hwmon}/temp${i}_input`)
    }))
  )
  for (const { label, val } of temps) {
    if (val === undefined) continue
    const c = val / 1000 // millidegrees → °C
    if (label === 'junction' || label === 'hotspot') out.tempHotspotC = c
    else if (label === 'mem' || label === 'vram') out.tempMemC = c
    else out.tempC ??= c // edge, "Composite", GPU, or unlabelled → primary
  }

  // Power: power1_average preferred over power1_input; cap may be plain or _max.
  const [pAvg, pInput, pCap, pCapMax, fan, volt] = await Promise.all([
    readNum(`${hwmon}/power1_average`),
    readNum(`${hwmon}/power1_input`),
    readNum(`${hwmon}/power1_cap`),
    readNum(`${hwmon}/power1_cap_max`),
    readNum(`${hwmon}/fan1_input`),
    readNum(`${hwmon}/in0_input`)
  ])
  const microW = pAvg ?? pInput
  if (microW !== undefined) out.powerW = microW / 1_000_000
  const capMicroW = pCap ?? pCapMax
  if (capMicroW !== undefined) out.powerLimitW = capMicroW / 1_000_000
  out.fanRpm = fan
  out.voltageMv = volt // already millivolts

  return out
}

/** AMD amdgpu nodes: utilization, VRAM/GTT, clocks, PCIe link, perf level. */
async function readAmdCard(dev: string, base: Partial<GpuDevice>): Promise<GpuDevice> {
  const [busy, memBusy, vramUsed, vramTotal, gttUsed, gttTotal, linkSpeed, linkWidth, perfLevel, sclk, mclk] =
    await Promise.all([
      readNum(`${dev}/gpu_busy_percent`),
      readNum(`${dev}/mem_busy_percent`),
      readNum(`${dev}/mem_info_vram_used`),
      readNum(`${dev}/mem_info_vram_total`),
      readNum(`${dev}/mem_info_gtt_used`),
      readNum(`${dev}/mem_info_gtt_total`),
      readStr(`${dev}/current_link_speed`),
      readNum(`${dev}/current_link_width`),
      readStr(`${dev}/power_dpm_force_performance_level`),
      readStr(`${dev}/pp_dpm_sclk`),
      readStr(`${dev}/pp_dpm_mclk`)
    ])

  const core = parseDpm(sclk)
  const memC = parseDpm(mclk)
  const hwmon = await findHwmon(dev)
  const hw = hwmon ? await readHwmon(hwmon) : {}

  return {
    ...base,
    name: base.name ?? 'AMD GPU',
    vendor: 'amd',
    driver: 'amdgpu',
    utilization: busy,
    memUtilization: memBusy,
    memUsedBytes: vramUsed,
    memTotalBytes: vramTotal,
    gttUsedBytes: gttUsed,
    gttTotalBytes: gttTotal,
    clockMhz: core.current,
    clockMaxMhz: core.max,
    memClockMhz: memC.current,
    memClockMaxMhz: memC.max,
    pcieSpeed: linkSpeed,
    pcieWidth: linkWidth,
    perfLevel,
    ...hw
  } as GpuDevice
}

/** Intel i915/xe nodes: render-engine clocks; power/temp via hwmon if present. */
async function readIntelCard(dev: string, base: Partial<GpuDevice>): Promise<GpuDevice> {
  const [cur, max, act] = await Promise.all([
    readNum(`${dev}/gt_cur_freq_mhz`),
    readNum(`${dev}/gt_max_freq_mhz`),
    readNum(`${dev}/gt_act_freq_mhz`)
  ])
  const hwmon = await findHwmon(dev)
  const hw = hwmon ? await readHwmon(hwmon) : {}

  return {
    ...base,
    name: base.name ?? 'Intel GPU',
    vendor: 'intel',
    driver: 'i915',
    clockMhz: act ?? cur,
    clockMaxMhz: max,
    ...hw
  } as GpuDevice
}

/**
 * Walk /sys/class/drm and read every card the kernel exposes telemetry for.
 * NVIDIA cards are skipped here — nvidia-smi is their richer source and is
 * merged separately; the `skipBusIds` set prevents duplicating them.
 */
async function readDrm(skipBusIds: Set<string>): Promise<GpuDevice[]> {
  const root = '/sys/class/drm'
  let cards: string[]
  try {
    cards = (await readdir(root)).filter((c) => /^card\d+$/.test(c))
  } catch {
    return []
  }

  const gpus: GpuDevice[] = []
  for (const card of cards.sort()) {
    const dev = `${root}/${card}/device`
    const vendorId = (await readStr(`${dev}/vendor`))?.toLowerCase()
    const known = vendorId ? PCI_VENDORS[vendorId] : undefined
    if (!known) continue // not a GPU we understand (or a render-only node)

    const busId = await pciBusId(dev)
    if (busId && skipBusIds.has(fullBusId(busId) ?? busId)) continue

    const index = Number(card.replace(/\D/g, '')) || gpus.length
    const base: Partial<GpuDevice> = { index, busId, vendorName: known.vendorName }

    if (known.vendor === 'amd') gpus.push(await readAmdCard(dev, base))
    else if (known.vendor === 'intel') gpus.push(await readIntelCard(dev, base))
    // NVIDIA with no nvidia-smi: surface a bare entry so it isn't invisible.
    else gpus.push({ ...base, name: 'NVIDIA GPU', vendor: 'nvidia', driver: 'nouveau' } as GpuDevice)
  }
  return gpus
}

/** Resolve a card's PCI bus id (e.g. "0000:05:00.0") from its device symlink. */
async function pciBusId(dev: string): Promise<string | undefined> {
  try {
    const target = await readlink(dev)
    return basename(target)
  } catch {
    return undefined
  }
}

/* ------------------------------------------------------------------ *
 * lspci — human-readable model names, keyed by bus id
 * ------------------------------------------------------------------ */

async function readLspciNames(): Promise<Map<string, { name: string; vendorName: string }>> {
  const out = new Map<string, { name: string; vendorName: string }>()
  try {
    const { stdout } = await exec('lspci', ['-mm', '-D'], { timeout: 3000 })
    for (const line of stdout.split('\n')) {
      if (!/VGA|3D|Display/i.test(line)) continue
      // Format: "0000:01:00.0" "VGA compatible controller" "Vendor" "Device" …
      const parts = line.match(/"[^"]*"|\S+/g)
      if (!parts || parts.length < 4) continue
      const busId = parts[0].replace(/"/g, '').toLowerCase()
      const vendorName = parts[2].replace(/"/g, '')
      const device = parts[3].replace(/"/g, '')
      out.set(busId, { name: device, vendorName })
    }
  } catch {
    // lspci absent — names stay generic
  }
  return out
}

/** Normalize a bus id to lspci's "0000:bb:dd.f" form for map lookup. */
function fullBusId(busId?: string): string | undefined {
  if (!busId) return undefined
  const b = busId.toLowerCase()
  // NVIDIA reports an 8-hex-digit domain ("00000000:01:00.0"); lspci uses 4.
  const m = b.match(/^([0-9a-f]+):([0-9a-f]{2}:[0-9a-f]{2}\.[0-9a-f])$/)
  if (m) return `${m[1].slice(-4).padStart(4, '0')}:${m[2]}`
  return /^[0-9a-f]{4}:/.test(b) ? b : `0000:${b}`
}

/* ------------------------------------------------------------------ *
 * Per-process GPU usage
 *   NVIDIA: `nvidia-smi pmon` (instantaneous sm%) + compute-apps (memory).
 *   AMD/Intel: DRM fdinfo (engine-time counters → delta %, VRAM/GTT memory).
 * ------------------------------------------------------------------ */

/** Read a process's command name from /proc/<pid>/comm. */
async function procName(pid: number): Promise<string> {
  return (await readStr(`/proc/${pid}/comm`)) ?? String(pid)
}

/** Parse a "<value> <unit>" memory line (KiB/MiB/GiB) into bytes. */
function parseMem(s: string | undefined): number | undefined {
  if (!s) return undefined
  const m = s.trim().match(/^(\d+(?:\.\d+)?)\s*([KMG]i?B)?/)
  if (!m) return undefined
  const v = Number(m[1])
  const unit = (m[2] ?? 'B').toUpperCase()
  const mult = unit.startsWith('G') ? 1024 ** 3 : unit.startsWith('M') ? MIB : unit.startsWith('K') ? 1024 : 1
  return v * mult
}

/** NVIDIA per-process usage from `nvidia-smi pmon` + memory from compute-apps. */
async function readNvidiaProcs(nvIdxToFinal: Map<number, number>): Promise<GpuProcess[]> {
  const procs: GpuProcess[] = []
  try {
    // Memory per pid (compute clients expose used_memory in MiB).
    const mem = new Map<number, number>()
    try {
      const { stdout } = await exec(
        'nvidia-smi',
        ['--query-compute-apps=pid,used_memory', '--format=csv,noheader,nounits'],
        { timeout: 4000 }
      )
      for (const line of stdout.split('\n')) {
        const [pid, used] = line.split(',').map((x) => x.trim())
        const p = num(pid)
        const u = num(used)
        if (p !== undefined && u !== undefined) mem.set(p, u * MIB)
      }
    } catch {
      // compute-apps unavailable — memory stays undefined
    }

    const { stdout } = await exec('nvidia-smi', ['pmon', '-c', '1'], { timeout: 4000 })
    for (const line of stdout.split('\n')) {
      if (!line.trim() || line.startsWith('#')) continue
      // Columns: gpu pid type sm mem enc dec [jpg ofa] command
      const c = line.trim().split(/\s+/)
      const gpuIdx = num(c[0])
      const pid = num(c[1])
      if (gpuIdx === undefined || pid === undefined) continue
      const typeCol = c[2]
      const sm = num(c[3])
      const name = c[c.length - 1] || (await procName(pid))
      procs.push({
        pid,
        name,
        gpuIndex: nvIdxToFinal.get(gpuIdx) ?? gpuIdx,
        type: typeCol === 'C' ? 'compute' : typeCol === 'G' ? 'graphics' : 'unknown',
        utilization: sm,
        memBytes: mem.get(pid)
      })
    }
  } catch {
    // nvidia-smi pmon unsupported (e.g. some laptop GPUs) — skip
  }
  return procs
}

interface DrmClient {
  pid: number
  clientId: string
  busId?: string
  engineNs: number
  memBytes: number
}

/** Enumerate DRM fdinfo clients across all processes (AMD/Intel). */
async function readDrmClients(): Promise<DrmClient[]> {
  let pids: string[]
  try {
    pids = (await readdir('/proc')).filter((e) => /^\d+$/.test(e))
  } catch {
    return []
  }

  const seen = new Set<string>() // dedupe by client-id (a pid dups fds)
  const clients: DrmClient[] = []

  await Promise.all(
    pids.map(async (pid) => {
      let fds: string[]
      try {
        fds = await readdir(`/proc/${pid}/fdinfo`)
      } catch {
        return // gone, or not ours to read
      }
      for (const fd of fds) {
        const text = await readStr(`/proc/${pid}/fdinfo/${fd}`)
        if (!text || !text.includes('drm-client-id')) continue
        const clientId = text.match(/^drm-client-id:\s*(\d+)/m)?.[1]
        if (!clientId || seen.has(clientId)) continue
        seen.add(clientId)

        let engineNs = 0
        for (const m of text.matchAll(/^drm-engine-\w+:\s*(\d+)\s*ns/gm)) engineNs += Number(m[1])
        // Sum VRAM + GTT actually resident to this client.
        let memBytes = 0
        for (const m of text.matchAll(/^drm-memory-(?:vram|gtt):\s*(.+)$/gm)) memBytes += parseMem(m[1]) ?? 0

        clients.push({
          pid: Number(pid),
          clientId,
          busId: text.match(/^drm-pdev:\s*(\S+)/m)?.[1]?.toLowerCase(),
          engineNs,
          memBytes
        })
      }
    })
  )
  return clients
}

/* ------------------------------------------------------------------ */

export class GpuCollector {
  /** Previous fdinfo engine-time readings, keyed by client-id, for delta %. */
  private prevEngine = new Map<string, number>()
  private prevAt = 0

  async snapshot(): Promise<GpuSnapshot> {
    // nvidia-smi is NVIDIA's richer source; DRM sysfs covers AMD + Intel (and
    // any NVIDIA card running nouveau). Read everything in parallel.
    const [nvidia, names, drmClients] = await Promise.all([
      readNvidia(),
      readLspciNames(),
      readDrmClients()
    ])

    // Don't let readDrm re-add NVIDIA cards nvidia-smi already reported.
    const nvBusIds = new Set(
      nvidia.map((g) => fullBusId(g.busId)).filter((b): b is string => b !== undefined)
    )
    const drm = await readDrm(nvBusIds)

    const gpus = [...nvidia, ...drm]

    // Enrich names from lspci where the driver gave only a generic label.
    for (const g of gpus) {
      const lookup = names.get(fullBusId(g.busId) ?? '')
      if (lookup) {
        if (/^(AMD|NVIDIA|Intel)? ?GPU$/.test(g.name) || !g.name) g.name = lookup.name
        g.vendorName ??= lookup.vendorName
      }
    }

    // Stable ordering: nvidia-smi devices first, then sysfs; reindex for the UI.
    // Capture each card's original nvidia-smi index → final index before reindex.
    const nvIdxToFinal = new Map<number, number>()
    nvidia.forEach((g, i) => nvIdxToFinal.set(g.index, i))
    gpus.forEach((g, i) => (g.index = i))

    if (gpus.length === 0) {
      this.prevEngine.clear()
      return {
        supported: false,
        note: 'No GPU telemetry source found (install nvidia-smi for NVIDIA, or use an AMD/Intel GPU with the amdgpu/i915 driver).',
        gpus: [],
        processes: []
      }
    }

    const processes = await this.collectProcesses(gpus, drmClients, nvIdxToFinal)
    return { supported: true, gpus, processes }
  }

  /** Merge NVIDIA pmon and DRM-fdinfo process usage; sort and cap to the top 5. */
  private async collectProcesses(
    gpus: GpuDevice[],
    drmClients: DrmClient[],
    nvIdxToFinal: Map<number, number>
  ): Promise<GpuProcess[]> {
    const nv = await readNvidiaProcs(nvIdxToFinal)

    // DRM engine-time is cumulative ns; convert to % over the sampling interval.
    const now = Date.now()
    const elapsedNs = this.prevAt ? (now - this.prevAt) * 1e6 : 0
    const busIdToIndex = new Map<string, number>()
    for (const g of gpus) {
      const b = fullBusId(g.busId)
      if (b) busIdToIndex.set(b, g.index)
    }

    // Aggregate clients per pid (a process may hold several DRM clients).
    const byPid = new Map<number, { util: number; mem: number; gpuIndex: number }>()
    const nextEngine = new Map<string, number>()
    for (const c of drmClients) {
      nextEngine.set(c.clientId, c.engineNs)
      const prev = this.prevEngine.get(c.clientId)
      const busyNs = prev !== undefined ? Math.max(0, c.engineNs - prev) : 0
      const util = elapsedNs > 0 ? Math.min(100, (busyNs / elapsedNs) * 100) : 0
      const idx = c.busId ? busIdToIndex.get(fullBusId(c.busId) ?? c.busId) ?? -1 : -1
      const e = byPid.get(c.pid) ?? { util: 0, mem: 0, gpuIndex: idx }
      e.util += util
      e.mem += c.memBytes
      if (idx >= 0) e.gpuIndex = idx
      byPid.set(c.pid, e)
    }
    this.prevEngine = nextEngine
    this.prevAt = now

    const drmProcs: GpuProcess[] = await Promise.all(
      [...byPid.entries()].map(async ([pid, e]) => ({
        pid,
        name: await procName(pid),
        gpuIndex: e.gpuIndex >= 0 ? e.gpuIndex : 0,
        type: 'graphics' as const,
        utilization: Math.round(Math.min(100, e.util) * 10) / 10,
        memBytes: e.mem || undefined
      }))
    )

    const all = [...nv, ...drmProcs].filter((p) => (p.utilization ?? 0) > 0 || (p.memBytes ?? 0) > 0)
    all.sort(
      (a, b) => (b.utilization ?? 0) - (a.utilization ?? 0) || (b.memBytes ?? 0) - (a.memBytes ?? 0)
    )
    return all.slice(0, 5)
  }
}
