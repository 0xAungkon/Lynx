import type { LynxApi } from '@shared/ipc'

/** True when running inside Electron (the renderer's user agent reports it). */
export const isElectron = (): boolean =>
  typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent)

/**
 * True when the secure preload bridge is present. It's absent if the renderer
 * is opened as a plain browser tab (e.g. visiting the Vite dev URL directly)
 * rather than through the Lynx desktop window.
 */
export const hasBridge = (): boolean =>
  typeof window !== 'undefined' && Boolean((window as { lynx?: LynxApi }).lynx)

/**
 * Access the preload bridge, throwing a clear, user-facing error when it is
 * missing. Telemetry calls run through this so `usePoll` surfaces a friendly
 * message instead of an opaque "undefined" crash.
 */
export function lynx(): LynxApi {
  const api = (window as { lynx?: LynxApi }).lynx
  if (!api) {
    throw new Error(
      'Lynx system bridge unavailable. Open the Lynx desktop app rather than a browser tab.'
    )
  }
  return api
}
