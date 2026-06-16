import type { LynxApi } from '@shared/ipc'

declare global {
  interface Window {
    lynx: LynxApi
  }
}

export {}
