import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

/**
 * Renderer-owned preferences (refresh cadence, theme). These never need the
 * main process, so they live in localStorage — no IPC, no persisted file.
 * Privilege preferences are separate: they're enforced in main and fetched via
 * window.lynx.getSettings/setSettings on the Settings page itself.
 */

export type RefreshRate = 'live' | 'balanced' | 'power'

/** Multiplier applied to every module's base poll interval. */
const MULTIPLIER: Record<RefreshRate, number> = {
  live: 0.5,
  balanced: 1,
  power: 3
}

interface RendererSettings {
  refreshRate: RefreshRate
}

interface SettingsApi {
  refreshRate: RefreshRate
  setRefreshRate: (rate: RefreshRate) => void
  /** Factor applied to base poll intervals (see useInterval). */
  multiplier: number
  /** Fixed for now — the app ships a dark Material 3 theme only. */
  theme: 'dark'
}

const STORAGE_KEY = 'lynx.settings'
const DEFAULTS: RendererSettings = { refreshRate: 'balanced' }

function read(): RendererSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<RendererSettings>
    const rate = parsed.refreshRate
    return { refreshRate: rate === 'live' || rate === 'power' ? rate : 'balanced' }
  } catch {
    return DEFAULTS
  }
}

const SettingsContext = createContext<SettingsApi | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }): JSX.Element {
  const [settings, setSettings] = useState<RendererSettings>(read)

  const setRefreshRate = useCallback((refreshRate: RefreshRate) => {
    setSettings((prev) => {
      const next = { ...prev, refreshRate }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Storage unavailable (private mode / quota) — keep the in-memory value.
      }
      return next
    })
  }, [])

  const value = useMemo<SettingsApi>(
    () => ({
      refreshRate: settings.refreshRate,
      setRefreshRate,
      multiplier: MULTIPLIER[settings.refreshRate],
      theme: 'dark'
    }),
    [settings.refreshRate, setRefreshRate]
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsApi {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider')
  return ctx
}

/**
 * Scale a module's base poll interval by the current refresh-rate preset.
 * Modules keep their own sensible base cadence (e.g. 1000ms for CPU); the preset
 * shifts them all together. usePoll re-subscribes when the returned value changes.
 */
export function useInterval(baseMs: number): number {
  const { multiplier } = useSettings()
  return Math.round(baseMs * multiplier)
}
