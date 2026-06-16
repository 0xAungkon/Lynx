/**
 * @lynx/ipc — the single source of truth for the typed IPC contract between the
 * Electron main process, the preload bridge, and the React renderer.
 *
 * Every channel is declared here with a zod schema for its result (and payload,
 * where applicable). Main-process handlers validate against these schemas before
 * returning; the renderer consumes the inferred TypeScript types via `window.lynx`.
 *
 * Channel naming: `<domain>:<verb>`. Queries return data; commands mutate and
 * return an ActionResult carrying `usedPrivilege` (see idea.md §5).
 */
import { z } from 'zod'
export { PRIVILEGE_PROMPT_CHANNEL } from './channels'

/* ------------------------------------------------------------------ *
 * Common
 * ------------------------------------------------------------------ */

/** Whether an action ultimately ran elevated or fell back to user privileges. */
export const PrivilegeLevel = z.enum(['root', 'user'])
export type PrivilegeLevel = z.infer<typeof PrivilegeLevel>

/** Standard result for any command that may require elevation. */
export const ActionResult = z.object({
  ok: z.boolean(),
  usedPrivilege: PrivilegeLevel,
  note: z.string().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  error: z.string().optional()
})
export type ActionResult = z.infer<typeof ActionResult>

/* ------------------------------------------------------------------ *
 * system:info  (read-only, no privilege)
 * ------------------------------------------------------------------ */

export const SystemInfo = z.object({
  hostname: z.string(),
  /** PRETTY_NAME from /etc/os-release, e.g. "Ubuntu 24.04 LTS" / "Arch Linux". */
  platform: z.string(),
  /** os-release ID, e.g. "ubuntu", "arch", "debian". */
  distroId: z.string(),
  /** os-release ID_LIKE tokens, e.g. ["debian"] or ["arch"]. */
  distroLike: z.array(z.string()),
  /** Detected backend family used to pick package/service adapters later. */
  family: z.enum(['debian', 'arch', 'unknown']),
  /** os-release VERSION (e.g. "24.04 LTS (Noble Numbat)"), when present. */
  osVersion: z.string().optional(),
  kernel: z.string(),
  arch: z.string(),
  uptimeSec: z.number(),

  // CPU / topology
  cpuModel: z.string(),
  /** Logical CPU count (threads). */
  cpuCount: z.number(),
  cpuVendor: z.string().optional(),
  cpuPhysicalCores: z.number().optional(),
  cpuSockets: z.number().optional(),
  cpuMinMhz: z.number().optional(),
  cpuMaxMhz: z.number().optional(),
  virtualization: z.string().optional(),

  // Memory / swap
  totalMemBytes: z.number(),
  swapTotalBytes: z.number().optional(),

  // Hardware (DMI — readable without root)
  boardVendor: z.string().optional(),
  boardName: z.string().optional(),
  boardVersion: z.string().optional(),
  productName: z.string().optional(),
  sysVendor: z.string().optional(),
  chassis: z.string().optional(),
  biosVendor: z.string().optional(),
  biosVersion: z.string().optional(),
  biosDate: z.string().optional(),

  // Software / session
  desktop: z.string().optional(),
  sessionType: z.string().optional(),
  shell: z.string().optional(),
  initSystem: z.string().optional(),
  machineId: z.string().optional(),

  appVersion: z.string()
})
export type SystemInfo = z.infer<typeof SystemInfo>

/* ------------------------------------------------------------------ *
 * cpu:snapshot  (read-only)
 * ------------------------------------------------------------------ */

export const CpuSnapshot = z.object({
  /** Aggregate utilization across all cores, 0–100. */
  usage: z.number(),
  /** Per-logical-core utilization, 0–100. */
  perCore: z.array(z.number()),
  /** Average current frequency in MHz (0 if unavailable). */
  freqMhz: z.number(),
  /** 1/5/15-minute load averages. */
  loadAvg: z.tuple([z.number(), z.number(), z.number()]),
  model: z.string(),
  /** Logical CPU count (threads). */
  cores: z.number(),
  /** Highest core temperature in °C, if a sensor is exposed. */
  tempC: z.number().optional()
})
export type CpuSnapshot = z.infer<typeof CpuSnapshot>

/* ------------------------------------------------------------------ *
 * mem:snapshot  (read-only)
 * ------------------------------------------------------------------ */

export const MemSnapshot = z.object({
  totalBytes: z.number(),
  usedBytes: z.number(),
  freeBytes: z.number(),
  availableBytes: z.number(),
  cachedBytes: z.number(),
  buffersBytes: z.number(),
  swapTotalBytes: z.number(),
  swapUsedBytes: z.number(),
  /** usedBytes / totalBytes * 100. */
  percent: z.number()
})
export type MemSnapshot = z.infer<typeof MemSnapshot>

/* ------------------------------------------------------------------ *
 * disk:snapshot  (read-only)
 * ------------------------------------------------------------------ */

export const Filesystem = z.object({
  /** Backing device, e.g. /dev/nvme0n1p2. */
  source: z.string(),
  /** Mount point, e.g. /. */
  target: z.string(),
  fsType: z.string(),
  sizeBytes: z.number(),
  usedBytes: z.number(),
  availBytes: z.number(),
  percent: z.number(),
  /** Per-device I/O for this filesystem's backing device, bytes/sec (delta-based). */
  readBytesPerSec: z.number(),
  writeBytesPerSec: z.number()
})
export type Filesystem = z.infer<typeof Filesystem>

export const DiskSnapshot = z.object({
  filesystems: z.array(Filesystem),
  /** Aggregate I/O across all block devices, bytes/sec (delta-based). */
  readBytesPerSec: z.number(),
  writeBytesPerSec: z.number()
})
export type DiskSnapshot = z.infer<typeof DiskSnapshot>

/* ------------------------------------------------------------------ *
 * disk:scan / disk:delete  (ncdu-style usage browser; delete may need root)
 * ------------------------------------------------------------------ */

/** A single child (file or directory) within a scanned directory. */
export const ScanEntry = z.object({
  name: z.string(),
  /** Absolute path, for drill-in and deletion. */
  path: z.string(),
  /** Total bytes — own size for files, recursive subtree size for directories. */
  sizeBytes: z.number(),
  isDir: z.boolean(),
  /** Number of immediate children, for directories. */
  entryCount: z.number().optional(),
  /** Set when this entry couldn't be fully sized (e.g. permission denied). */
  error: z.string().optional()
})
export type ScanEntry = z.infer<typeof ScanEntry>

export const DirScan = z.object({
  path: z.string(),
  /** Sum of entry sizes (bytes). */
  totalBytes: z.number(),
  /** Children, sorted largest-first. */
  entries: z.array(ScanEntry),
  /** Set when the scan was partial (e.g. some children unreadable). */
  note: z.string().optional()
})
export type DirScan = z.infer<typeof DirScan>

export const ScanRequest = z.object({ path: z.string() })
export type ScanRequest = z.infer<typeof ScanRequest>

export const DeleteRequest = z.object({ path: z.string() })
export type DeleteRequest = z.infer<typeof DeleteRequest>

/* ------------------------------------------------------------------ *
 * net:snapshot  (read-only)
 * ------------------------------------------------------------------ */

export const NetInterface = z.object({
  name: z.string(),
  /** Primary IPv4/IPv6 address, if assigned. */
  address: z.string().optional(),
  rxBytes: z.number(),
  txBytes: z.number(),
  rxBytesPerSec: z.number(),
  txBytesPerSec: z.number(),
  up: z.boolean()
})
export type NetInterface = z.infer<typeof NetInterface>

export const NetSnapshot = z.object({
  interfaces: z.array(NetInterface),
  /** Sum of per-interface throughput (excludes loopback). */
  totalRxPerSec: z.number(),
  totalTxPerSec: z.number()
})
export type NetSnapshot = z.infer<typeof NetSnapshot>

/* ------------------------------------------------------------------ *
 * proc:list  (read-only)
 * ------------------------------------------------------------------ */

export const ProcessState = z.enum(['running', 'sleeping', 'stopped', 'zombie', 'idle', 'unknown'])
export type ProcessState = z.infer<typeof ProcessState>

export const ProcessInfo = z.object({
  pid: z.number(),
  ppid: z.number(),
  name: z.string(),
  cmdline: z.string(),
  user: z.string(),
  state: ProcessState,
  /** Instantaneous CPU usage 0–100 (can exceed 100 across multiple cores). */
  cpuPercent: z.number(),
  memBytes: z.number(),
  memPercent: z.number()
})
export type ProcessInfo = z.infer<typeof ProcessInfo>

export const ProcessList = z.object({
  processes: z.array(ProcessInfo),
  /** Logical core count — lets the UI normalize cpuPercent if desired. */
  cpuCount: z.number()
})
export type ProcessList = z.infer<typeof ProcessList>

/* ------------------------------------------------------------------ *
 * gpu:snapshot  (read-only)
 * ------------------------------------------------------------------ */

export const GpuDevice = z.object({
  index: z.number(),
  name: z.string(),
  vendor: z.enum(['nvidia', 'amd', 'intel', 'unknown']),
  /** Marketing vendor string, e.g. "NVIDIA Corporation" / "AMD/ATI". */
  vendorName: z.string().optional(),
  /** Kernel driver in use, e.g. "nvidia" / "amdgpu". */
  driver: z.string().optional(),
  driverVersion: z.string().optional(),
  vbiosVersion: z.string().optional(),
  /** PCI bus id, e.g. "0000:01:00.0". */
  busId: z.string().optional(),

  /** Core/graphics utilization 0–100, if reported. */
  utilization: z.number().optional(),
  /** Memory-controller / VRAM bandwidth utilization 0–100. */
  memUtilization: z.number().optional(),
  /** Video encoder / decoder utilization 0–100 (NVIDIA). */
  encUtilization: z.number().optional(),
  decUtilization: z.number().optional(),

  /** Dedicated video memory (VRAM). */
  memUsedBytes: z.number().optional(),
  memTotalBytes: z.number().optional(),
  /** Shared system memory the GPU can use (AMD GTT / NVIDIA shared). */
  gttUsedBytes: z.number().optional(),
  gttTotalBytes: z.number().optional(),

  /** Edge/core temperature, °C. */
  tempC: z.number().optional(),
  /** Hotspot/junction temperature, °C (AMD). */
  tempHotspotC: z.number().optional(),
  /** Memory temperature, °C. */
  tempMemC: z.number().optional(),

  fanPercent: z.number().optional(),
  fanRpm: z.number().optional(),

  /** Current power draw, watts. */
  powerW: z.number().optional(),
  /** Configured power cap, watts. */
  powerLimitW: z.number().optional(),

  /** Current core/graphics clock, MHz. */
  clockMhz: z.number().optional(),
  /** Maximum core/graphics clock, MHz. */
  clockMaxMhz: z.number().optional(),
  /** Current memory clock, MHz. */
  memClockMhz: z.number().optional(),
  /** Maximum memory clock, MHz. */
  memClockMaxMhz: z.number().optional(),

  /** Core voltage, millivolts. */
  voltageMv: z.number().optional(),

  /** PCIe link, e.g. "16.0 GT/s" and lane width. */
  pcieSpeed: z.string().optional(),
  pcieWidth: z.number().optional(),

  /** Performance/power state, e.g. "auto", "P0". */
  perfLevel: z.string().optional()
})
export type GpuDevice = z.infer<typeof GpuDevice>

/** A process consuming GPU resources, attributed to a device by index. */
export const GpuProcess = z.object({
  pid: z.number(),
  /** Process / command name. */
  name: z.string(),
  /** Index of the GPU it's running on (matches GpuDevice.index). */
  gpuIndex: z.number(),
  /** Compute (C) vs graphics (G) client, when the source distinguishes. */
  type: z.enum(['compute', 'graphics', 'unknown']).optional(),
  /** GPU (engine) utilization 0–100, when reported. */
  utilization: z.number().optional(),
  /** GPU memory in use by this process, bytes. */
  memBytes: z.number().optional()
})
export type GpuProcess = z.infer<typeof GpuProcess>

export const GpuSnapshot = z.object({
  /** False when no GPU telemetry source (nvidia-smi / amd sysfs) is available. */
  supported: z.boolean(),
  /** Reason shown to the user when supported is false. */
  note: z.string().optional(),
  gpus: z.array(GpuDevice),
  /** Processes currently using a GPU, sorted by usage (best-effort, may be empty). */
  processes: z.array(GpuProcess)
})
export type GpuSnapshot = z.infer<typeof GpuSnapshot>

/* ------------------------------------------------------------------ *
 * Commands — process actions  (may require root, idea.md §5)
 * ------------------------------------------------------------------ */

export const Signal = z.enum(['TERM', 'KILL', 'HUP', 'INT'])
export type Signal = z.infer<typeof Signal>

export const KillRequest = z.object({ pid: z.number().int().positive(), signal: Signal })
export type KillRequest = z.infer<typeof KillRequest>

/** Target niceness, -20 (highest priority) … 19 (lowest). */
export const ReniceRequest = z.object({
  pid: z.number().int().positive(),
  priority: z.number().int().min(-20).max(19)
})
export type ReniceRequest = z.infer<typeof ReniceRequest>

/* ------------------------------------------------------------------ *
 * Services — systemd  (list read-only; control requires root)
 * ------------------------------------------------------------------ */

export const ServiceOp = z.enum(['start', 'stop', 'restart', 'enable', 'disable'])
export type ServiceOp = z.infer<typeof ServiceOp>

export const ServiceUnit = z.object({
  name: z.string(),
  description: z.string(),
  /** loaded / not-found / masked / error */
  loadState: z.string(),
  /** active / inactive / failed / activating … */
  activeState: z.string(),
  /** running / dead / exited / failed … */
  subState: z.string(),
  /** enabled / disabled / static / masked / generated / '' (unknown). */
  unitFileState: z.string()
})
export type ServiceUnit = z.infer<typeof ServiceUnit>

export const ServiceList = z.object({ units: z.array(ServiceUnit) })
export type ServiceList = z.infer<typeof ServiceList>

export const ServiceControlRequest = z.object({ unit: z.string(), op: ServiceOp })
export type ServiceControlRequest = z.infer<typeof ServiceControlRequest>

export const ServiceLogsRequest = z.object({
  unit: z.string(),
  lines: z.number().int().positive().max(1000).optional()
})
export type ServiceLogsRequest = z.infer<typeof ServiceLogsRequest>

export const JournalLine = z.object({
  /** Epoch milliseconds. */
  timestamp: z.number(),
  message: z.string(),
  /** syslog priority 0 (emerg) … 7 (debug). */
  priority: z.number(),
  identifier: z.string().optional(),
  pid: z.number().optional()
})
export type JournalLine = z.infer<typeof JournalLine>

export const JournalResult = z.object({
  lines: z.array(JournalLine),
  /** Set when logs are unavailable/partial (e.g. needs journal group). */
  note: z.string().optional()
})
export type JournalResult = z.infer<typeof JournalResult>

/* ------------------------------------------------------------------ *
 * Privilege prompt round-trip  (idea.md §5.2 / §5.4)
 * ------------------------------------------------------------------ */

export const PrivilegePrompt = z.object({
  requestId: z.string(),
  /** What is being attempted, e.g. "Restart postgresql.service". */
  action: z.string(),
  /** Why root is needed, shown under the action. */
  reason: z.string(),
  /** 1-based attempt counter for the re-prompt loop. */
  attempt: z.number(),
  /** Error from the previous attempt (e.g. "Incorrect password"). */
  error: z.string().optional()
})
export type PrivilegePrompt = z.infer<typeof PrivilegePrompt>

/** Renderer → main: the collected secret, or null to continue without root. */
export const PrivilegeResponse = z.object({
  requestId: z.string(),
  password: z.string().nullable()
})
export type PrivilegeResponse = z.infer<typeof PrivilegeResponse>

export const Ack = z.object({ ok: z.boolean() })
export type Ack = z.infer<typeof Ack>

/* ------------------------------------------------------------------ *
 * Settings  (only the main-enforced privilege prefs cross IPC; the
 * renderer-only prefs — refresh rate, theme — live in localStorage)
 * ------------------------------------------------------------------ */

/** How aggressively Lynx elevates (idea.md §5.3). */
export const PrivilegeMode = z.enum(['always', 'ask', 'never'])
export type PrivilegeMode = z.infer<typeof PrivilegeMode>

export const AppSettings = z.object({
  /** always = reuse a cached credential; ask = re-prompt every time; never = user-only. */
  privilegeMode: PrivilegeMode,
  /** How long a successful credential is cached, minutes. 0 = never cache. */
  cacheTtlMinutes: z.number().int().min(0).max(60)
})
export type AppSettings = z.infer<typeof AppSettings>

/** A partial update — any subset of fields. */
export const SettingsPatch = AppSettings.partial()
export type SettingsPatch = z.infer<typeof SettingsPatch>

/* ------------------------------------------------------------------ *
 * Channel registry
 * ------------------------------------------------------------------ */

/**
 * Maps each IPC channel to its payload/result types. Handlers and the preload
 * bridge are both checked against this single map.
 */
export interface IpcContract {
  'system:info': { payload: void; result: SystemInfo }
  'cpu:snapshot': { payload: void; result: CpuSnapshot }
  'mem:snapshot': { payload: void; result: MemSnapshot }
  'disk:snapshot': { payload: void; result: DiskSnapshot }
  'disk:scan': { payload: ScanRequest; result: DirScan }
  'disk:delete': { payload: DeleteRequest; result: ActionResult }
  'net:snapshot': { payload: void; result: NetSnapshot }
  'proc:list': { payload: void; result: ProcessList }
  'gpu:snapshot': { payload: void; result: GpuSnapshot }
  'proc:kill': { payload: KillRequest; result: ActionResult }
  'proc:renice': { payload: ReniceRequest; result: ActionResult }
  'service:list': { payload: void; result: ServiceList }
  'service:control': { payload: ServiceControlRequest; result: ActionResult }
  'service:logs': { payload: ServiceLogsRequest; result: JournalResult }
  'settings:get': { payload: void; result: AppSettings }
  'settings:set': { payload: SettingsPatch; result: AppSettings }
  'privilege:respond': { payload: PrivilegeResponse; result: Ack }
}

export type IpcChannel = keyof IpcContract

/** Result validators, keyed by channel — used by the main process before replying. */
export const resultSchemas = {
  'system:info': SystemInfo,
  'cpu:snapshot': CpuSnapshot,
  'mem:snapshot': MemSnapshot,
  'disk:snapshot': DiskSnapshot,
  'disk:scan': DirScan,
  'disk:delete': ActionResult,
  'net:snapshot': NetSnapshot,
  'proc:list': ProcessList,
  'gpu:snapshot': GpuSnapshot,
  'proc:kill': ActionResult,
  'proc:renice': ActionResult,
  'service:list': ServiceList,
  'service:control': ActionResult,
  'service:logs': JournalResult,
  'settings:get': AppSettings,
  'settings:set': AppSettings,
  'privilege:respond': Ack
} satisfies { [K in IpcChannel]: z.ZodType<IpcContract[K]['result']> }

/**
 * Payload validators for channels that take input. The main-process router
 * validates against these before dispatching — critical for the mutating
 * channels, which act on the live system.
 */
export const paramSchemas = {
  'disk:scan': ScanRequest,
  'disk:delete': DeleteRequest,
  'proc:kill': KillRequest,
  'proc:renice': ReniceRequest,
  'service:control': ServiceControlRequest,
  'service:logs': ServiceLogsRequest,
  'settings:set': SettingsPatch,
  'privilege:respond': PrivilegeResponse
} satisfies Partial<{ [K in IpcChannel]: z.ZodType<IpcContract[K]['payload']> }>

/**
 * The API surface exposed on `window.lynx` in the renderer (via contextBridge).
 * Mirrors IpcContract but as ergonomic methods.
 */
export interface LynxApi {
  getSystemInfo(): Promise<SystemInfo>
  getCpu(): Promise<CpuSnapshot>
  getMemory(): Promise<MemSnapshot>
  getDisk(): Promise<DiskSnapshot>
  /** ncdu-style: list a directory's children with recursive sizes, largest-first. */
  scanDir(req: ScanRequest): Promise<DirScan>
  /** Delete a file or directory (recursive); routes through root if needed. */
  deletePath(req: DeleteRequest): Promise<ActionResult>
  getNetwork(): Promise<NetSnapshot>
  getProcesses(): Promise<ProcessList>
  getGpu(): Promise<GpuSnapshot>

  // Commands (may require root; see idea.md §5)
  killProcess(req: KillRequest): Promise<ActionResult>
  reniceProcess(req: ReniceRequest): Promise<ActionResult>
  listServices(): Promise<ServiceList>
  controlService(req: ServiceControlRequest): Promise<ActionResult>
  getServiceLogs(req: ServiceLogsRequest): Promise<JournalResult>

  // Settings (privilege prefs persisted & enforced in main)
  getSettings(): Promise<AppSettings>
  setSettings(patch: SettingsPatch): Promise<AppSettings>

  // Privilege prompt round-trip
  /** Subscribe to root-password prompts from main. Returns an unsubscribe fn. */
  onPrivilegePrompt(handler: (prompt: PrivilegePrompt) => void): () => void
  /** Reply to a prompt with the secret, or null to continue without root. */
  respondPrivilege(res: PrivilegeResponse): Promise<Ack>
}
