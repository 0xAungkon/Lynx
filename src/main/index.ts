import { join } from 'node:path'
import { app, shell, BrowserWindow } from 'electron'
import { registerIpcHandlers } from './ipc'
import { privilegeManager } from './privilege/PrivilegeManager'
import * as settingsStore from './settings/store'

const isDev = !app.isPackaged

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    show: false,
    backgroundColor: '#121221',
    autoHideMenuBar: true,
    title: 'Lynx',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      // Security baseline (idea.md §4.1): the renderer is fully sandboxed and
      // never touches Node/system APIs directly — only the curated window.lynx
      // surface exposed by the preload bridge.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  window.once('ready-to-show', () => window.show())

  // The privilege manager surfaces the root-password dialog through whichever
  // window is currently focused (or the first one).
  privilegeManager.setWindowProvider(
    () => BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
  )

  // Open external links in the user's browser, never in-app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Apply persisted privilege preferences before any window can request elevation.
  privilegeManager.applySettings(settingsStore.load())
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // Drop any cached root credential the moment the UI is gone (idea.md §5.3).
  privilegeManager.clearCache()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => privilegeManager.clearCache())
