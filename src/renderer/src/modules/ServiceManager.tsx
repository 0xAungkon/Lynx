import { useMemo, useState } from 'react'
import type { JournalResult, ServiceOp, ServiceUnit } from '@shared/ipc'
import { PageHeader } from '../components/PageHeader'
import { Icon } from '../components/Icon'
import { useToast } from '../components/Toast'
import { usePoll } from '../lib/usePoll'
import { useInterval } from '../app/SettingsProvider'

type StateFilter = 'all' | 'active' | 'inactive' | 'failed'

function activeChip(state: string): string {
  if (state === 'active') return 'text-tertiary bg-tertiary/10'
  if (state === 'failed') return 'text-error bg-error/10'
  if (state === 'activating' || state === 'deactivating') return 'text-primary bg-primary/10'
  return 'text-on-surface-variant bg-surface-variant'
}

function fileChip(state: string): string {
  if (state === 'enabled') return 'text-tertiary'
  if (state === 'disabled') return 'text-on-surface-variant'
  return 'text-outline'
}

const PRIORITY_COLOR = (p: number): string =>
  p <= 3 ? 'text-error' : p === 4 ? 'text-primary' : 'text-on-surface-variant'

export function ServiceManager(): JSX.Element {
  const { data, error } = usePoll(() => window.lynx.listServices(), useInterval(4000))
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<StateFilter>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [logs, setLogs] = useState<Record<string, JournalResult | 'loading'>>({})

  const units = useMemo(() => {
    let list: ServiceUnit[] = data?.units ?? []
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((u) => u.name.toLowerCase().includes(q) || u.description.toLowerCase().includes(q))
    if (filter !== 'all') list = list.filter((u) => u.activeState === filter)
    return list
  }, [data, query, filter])

  const control = async (unit: string, op: ServiceOp): Promise<void> => {
    const result = await window.lynx.controlService({ unit, op })
    toast.fromAction(`${op} ${unit}`, result)
  }

  const toggleLogs = async (unit: string): Promise<void> => {
    if (expanded === unit) {
      setExpanded(null)
      return
    }
    setExpanded(unit)
    if (!logs[unit]) {
      setLogs((l) => ({ ...l, [unit]: 'loading' }))
      const res = await window.lynx.getServiceLogs({ unit, lines: 200 })
      setLogs((l) => ({ ...l, [unit]: res }))
    }
  }

  return (
    <section className="flex h-full flex-col">
      <PageHeader
        title="Service Manager"
        subtitle={data ? `${data.units.length} systemd services` : 'systemd units, status & logs'}
      />

      {/* Toolbar */}
      <div className="mb-grid_gutter flex flex-wrap items-center gap-3">
        <div className="relative flex-1 md:max-w-md">
          <Icon
            name="search"
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services…"
            className="w-full rounded-lg border border-outline-variant bg-surface-container-high py-1.5 pl-9 pr-4 font-body-md text-body-md text-on-surface transition-colors placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'active', 'inactive', 'failed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded border px-3 py-1 font-label-caps text-label-caps uppercase transition-colors ${
                filter === f
                  ? 'border-outline-variant bg-surface-variant text-on-surface'
                  : 'border-transparent text-on-surface-variant hover:bg-surface-variant'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mb-4 font-data-mono text-data-mono text-error">{error}</p>}

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {units.map((u) => (
          <div key={u.name} className="rounded-xl border border-outline-variant bg-surface-container">
            <div className="flex items-center gap-4 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-data-mono text-data-mono text-on-surface">{u.name}</span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 font-label-caps text-label-caps uppercase ${activeChip(u.activeState)}`}>
                    {u.activeState} · {u.subState}
                  </span>
                  {u.unitFileState && (
                    <span className={`shrink-0 font-label-caps text-label-caps uppercase ${fileChip(u.unitFileState)}`}>
                      {u.unitFileState}
                    </span>
                  )}
                </div>
                <p className="truncate font-body-md text-body-md text-on-surface-variant">{u.description}</p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <IconBtn icon="play_arrow" title="Start" onClick={() => void control(u.name, 'start')} />
                <IconBtn icon="stop" title="Stop" onClick={() => void control(u.name, 'stop')} />
                <IconBtn icon="restart_alt" title="Restart" onClick={() => void control(u.name, 'restart')} />
                <span className="mx-1 h-5 w-px bg-outline-variant" />
                {u.unitFileState === 'enabled' ? (
                  <IconBtn icon="toggle_on" title="Disable at boot" tone="text-tertiary" onClick={() => void control(u.name, 'disable')} />
                ) : (
                  <IconBtn icon="toggle_off" title="Enable at boot" onClick={() => void control(u.name, 'enable')} />
                )}
                <IconBtn
                  icon={expanded === u.name ? 'expand_less' : 'subject'}
                  title="Logs"
                  onClick={() => void toggleLogs(u.name)}
                />
              </div>
            </div>

            {expanded === u.name && (
              <div className="border-t border-outline-variant bg-surface-container-lowest p-3">
                {logs[u.name] === 'loading' || !logs[u.name] ? (
                  <p className="font-code-terminal text-code-terminal text-on-surface-variant">Loading logs…</p>
                ) : (
                  <LogView result={logs[u.name] as JournalResult} />
                )}
              </div>
            )}
          </div>
        ))}
        {!data && <p className="font-data-mono text-data-mono text-on-surface-variant">Loading services…</p>}
        {data && units.length === 0 && (
          <p className="font-data-mono text-data-mono text-on-surface-variant">No matching services.</p>
        )}
      </div>

      <p className="mt-3 font-body-md text-body-md text-on-surface-variant">
        Start/stop/restart and enable/disable require administrator access — you’ll be prompted for the root
        password on first use.
      </p>
    </section>
  )
}

function LogView({ result }: { result: JournalResult }): JSX.Element {
  if (result.lines.length === 0) {
    return <p className="font-code-terminal text-code-terminal text-on-surface-variant">{result.note ?? 'No entries.'}</p>
  }
  return (
    <div className="max-h-64 overflow-y-auto font-code-terminal text-code-terminal">
      {result.lines.map((l, i) => (
        <p key={i} className={l.priority <= 3 ? 'text-error' : l.priority === 4 ? 'text-primary' : 'text-outline'}>
          <span className={PRIORITY_COLOR(l.priority)}>
            {new Date(l.timestamp).toLocaleTimeString()}{' '}
          </span>
          {l.message}
        </p>
      ))}
    </div>
  )
}

function IconBtn({
  icon,
  title,
  onClick,
  tone = 'text-on-surface-variant'
}: {
  icon: string
  title: string
  onClick: () => void
  tone?: string
}): JSX.Element {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-surface-variant hover:text-on-surface ${tone}`}
    >
      <Icon name={icon} className="text-[20px]" />
    </button>
  )
}
