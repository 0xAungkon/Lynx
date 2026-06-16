import { useEffect, useState } from 'react'
import type { AppSettings, PrivilegeMode } from '@shared/ipc'
import { PageHeader } from '../components/PageHeader'
import { Card } from '../components/Card'
import { Icon } from '../components/Icon'
import { useToast } from '../components/Toast'
import { useSettings, type RefreshRate } from '../app/SettingsProvider'

interface Segment<T extends string> {
  value: T
  label: string
}

/** Filter-button-style segmented control, matching ProcessManager/ServiceManager. */
function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled
}: {
  options: Segment<T>[]
  value: T
  onChange: (v: T) => void
  disabled?: boolean
}): JSX.Element {
  return (
    <div className="flex items-center gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`rounded border px-3 py-1 font-label-caps text-label-caps uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            value === o.value
              ? 'border-outline-variant bg-surface-variant text-on-surface'
              : 'border-transparent text-on-surface-variant hover:bg-surface-variant'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const REFRESH_OPTIONS: Segment<RefreshRate>[] = [
  { value: 'live', label: 'Live' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'power', label: 'Power-saver' }
]

/** Example CPU cadence (base 1000ms) shown for each preset. */
const REFRESH_CADENCE: Record<RefreshRate, string> = {
  live: '~0.5s',
  balanced: '~1s',
  power: '~3s'
}

const PRIVILEGE_OPTIONS: Segment<PrivilegeMode>[] = [
  { value: 'always', label: 'Always try' },
  { value: 'ask', label: 'Ask each time' },
  { value: 'never', label: 'Never elevate' }
]

const PRIVILEGE_HELP: Record<PrivilegeMode, string> = {
  always:
    'Prompt for the root password when needed and reuse it for a short time so you’re not asked on every action.',
  ask: 'Prompt for the root password every time an action needs it — nothing is cached.',
  never:
    'Never prompt for root. Privileged actions run with user privileges only and report what was skipped.'
}

export function Settings(): JSX.Element {
  const toast = useToast()
  const { refreshRate, setRefreshRate } = useSettings()

  // Privilege prefs live in the main process; fetch on mount.
  const [priv, setPriv] = useState<AppSettings | null>(null)
  useEffect(() => {
    void window.lynx.getSettings().then(setPriv)
  }, [])

  const patchPriv = async (patch: Partial<AppSettings>): Promise<void> => {
    const next = await window.lynx.setSettings(patch)
    setPriv(next)
    toast.push('Settings saved.', 'success')
  }

  return (
    <section className="flex h-full flex-col">
      <PageHeader title="Settings" subtitle="Refresh cadence, privilege behavior & appearance" />

      <div className="flex flex-col gap-grid_gutter">
        {/* Refresh rate */}
        <Card title="Refresh Rate" icon="speed">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
              How often live monitors poll the system. Faster is more responsive; slower saves CPU
              and battery. CPU updates {REFRESH_CADENCE[refreshRate]} at this setting.
            </p>
            <Segmented options={REFRESH_OPTIONS} value={refreshRate} onChange={setRefreshRate} />
          </div>
        </Card>

        {/* Privilege */}
        <Card title="Privilege & Root Access" icon="admin_panel_settings">
          {!priv ? (
            <p className="font-data-mono text-data-mono text-on-surface-variant">Loading…</p>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
                  {PRIVILEGE_HELP[priv.privilegeMode]}
                </p>
                <Segmented
                  options={PRIVILEGE_OPTIONS}
                  value={priv.privilegeMode}
                  onChange={(privilegeMode) => void patchPriv({ privilegeMode })}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/40 pt-4">
                <div className="max-w-md">
                  <p className="font-body-md text-body-md text-on-surface">Credential cache timeout</p>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    How long to keep the root password after a successful prompt (0 = never cache).
                    Only applies to “Always try”.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={priv.cacheTtlMinutes}
                    disabled={priv.privilegeMode !== 'always'}
                    onChange={(e) => {
                      const n = Math.max(0, Math.min(60, Math.round(Number(e.target.value) || 0)))
                      void patchPriv({ cacheTtlMinutes: n })
                    }}
                    className="w-20 rounded-lg border border-outline-variant bg-surface-container-high px-3 py-1.5 text-right font-data-mono text-data-mono text-on-surface transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <span className="font-body-md text-body-md text-on-surface-variant">min</span>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Theme */}
        <Card title="Appearance" icon="palette">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
              Lynx currently ships a dark Material 3 theme only; a light palette is planned.
            </p>
            <Segmented
              options={[{ value: 'dark', label: 'Dark' }]}
              value="dark"
              onChange={() => {}}
              disabled
            />
          </div>
        </Card>
      </div>

      <p className="mt-3 font-body-md text-body-md text-on-surface-variant">
        <Icon name="info" className="mr-1 align-text-bottom text-[16px]" />
        Refresh rate and theme are stored on this device; privilege preferences are saved securely
        and applied to every action that needs root.
      </p>
    </section>
  )
}
