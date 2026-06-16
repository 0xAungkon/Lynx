import { contextBridge, ipcRenderer } from 'electron'
import { PRIVILEGE_PROMPT_CHANNEL } from '@shared/channels'
import type { LynxApi, PrivilegePrompt } from '@shared/ipc'

/**
 * The only bridge between the sandboxed renderer and the main process. Every
 * capability the UI is allowed to use is enumerated here; the renderer has no
 * other access to Node, the filesystem, or the system.
 */
const api: LynxApi = {
  getSystemInfo: () => ipcRenderer.invoke('system:info'),
  getCpu: () => ipcRenderer.invoke('cpu:snapshot'),
  getMemory: () => ipcRenderer.invoke('mem:snapshot'),
  getDisk: () => ipcRenderer.invoke('disk:snapshot'),
  scanDir: (req) => ipcRenderer.invoke('disk:scan', req),
  deletePath: (req) => ipcRenderer.invoke('disk:delete', req),
  getNetwork: () => ipcRenderer.invoke('net:snapshot'),
  getProcesses: () => ipcRenderer.invoke('proc:list'),
  getGpu: () => ipcRenderer.invoke('gpu:snapshot'),

  killProcess: (req) => ipcRenderer.invoke('proc:kill', req),
  reniceProcess: (req) => ipcRenderer.invoke('proc:renice', req),
  listServices: () => ipcRenderer.invoke('service:list'),
  controlService: (req) => ipcRenderer.invoke('service:control', req),
  getServiceLogs: (req) => ipcRenderer.invoke('service:logs', req),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),

  onPrivilegePrompt: (handler: (prompt: PrivilegePrompt) => void) => {
    const listener = (_e: unknown, prompt: PrivilegePrompt): void => handler(prompt)
    ipcRenderer.on(PRIVILEGE_PROMPT_CHANNEL, listener)
    return () => ipcRenderer.removeListener(PRIVILEGE_PROMPT_CHANNEL, listener)
  },
  respondPrivilege: (res) => ipcRenderer.invoke('privilege:respond', res)
}

contextBridge.exposeInMainWorld('lynx', api)
