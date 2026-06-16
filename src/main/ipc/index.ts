import { ipcMain } from 'electron'
import type { z } from 'zod'
import { paramSchemas, resultSchemas, type IpcChannel, type IpcContract } from '@shared/ipc'
import { collectSystemInfo } from '../platform/systemInfo'
import { collectors } from '../collectors'
import { scanDir } from '../collectors/diskUsage'
import { deletePath } from '../actions/diskDelete'
import { killProcess, reniceProcess } from '../actions/process'
import { systemd } from '../backends/service/systemd'
import { privilegeManager } from '../privilege/PrivilegeManager'
import * as settingsStore from '../settings/store'

/**
 * Register a typed `ipcMain.handle`. The incoming payload is validated against
 * the channel's param schema (where one exists) before dispatch, and the return
 * value is validated against its result schema before it leaves the main
 * process. This guarantees the renderer only ever exchanges well-formed data —
 * essential for the mutating channels, which act on the live system.
 */
function handle<C extends IpcChannel>(
  channel: C,
  handler: (payload: IpcContract[C]['payload']) => Promise<IpcContract[C]['result']>
): void {
  const params = (paramSchemas as Partial<Record<IpcChannel, z.ZodTypeAny>>)[channel]
  const resultSchema = resultSchemas[channel] as z.ZodType<IpcContract[C]['result']>
  ipcMain.handle(channel, async (_event, payload: IpcContract[C]['payload']) => {
    const input = params ? (params.parse(payload) as IpcContract[C]['payload']) : payload
    const result = await handler(input)
    return resultSchema.parse(result)
  })
}

/** Wire up every IPC handler. Called once after the app is ready. */
export function registerIpcHandlers(): void {
  // Read-only telemetry
  handle('system:info', () => collectSystemInfo())
  handle('cpu:snapshot', () => collectors.cpu.snapshot())
  handle('mem:snapshot', () => collectors.memory.snapshot())
  handle('disk:snapshot', () => collectors.disk.snapshot())
  handle('disk:scan', (req) => scanDir(req.path))
  handle('net:snapshot', () => collectors.net.snapshot())
  handle('proc:list', () => collectors.proc.snapshot())
  handle('gpu:snapshot', () => collectors.gpu.snapshot())

  // Commands (may require root, routed through PrivilegeManager)
  handle('proc:kill', (req) => killProcess(req))
  handle('proc:renice', (req) => reniceProcess(req))
  handle('disk:delete', (req) => deletePath(req))
  handle('service:list', () => systemd.list())
  handle('service:control', (req) => systemd.control(req))
  handle('service:logs', (req) => systemd.logs(req.unit, req.lines))

  // Settings (privilege prefs persisted in main; applied to the PrivilegeManager)
  handle('settings:get', async () => settingsStore.load())
  handle('settings:set', async (patch) => {
    const next = settingsStore.save(patch)
    privilegeManager.applySettings(next)
    return next
  })

  // Privilege prompt round-trip: renderer → main reply.
  handle('privilege:respond', async (res) => {
    privilegeManager.resolvePrompt(res)
    return { ok: true }
  })
}
