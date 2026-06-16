import { useMemo, useState } from 'react'
import type { ProcessInfo, ProcessState, Signal } from '@shared/ipc'
import { PageHeader } from '../components/PageHeader'
import { Icon } from '../components/Icon'
import { useToast } from '../components/Toast'
import { usePoll } from '../lib/usePoll'
import { useInterval } from '../app/SettingsProvider'
import { formatBytes, formatPercent } from '../lib/format'

type Filter = 'all' | 'mine' | 'system'
type SortKey = 'pid' | 'name' | 'user' | 'cpu' | 'mem'
type View = 'flat' | 'tree'

const STATE_COLOR: Record<ProcessState, string> = {
  running: 'text-tertiary',
  sleeping: 'text-on-surface-variant',
  idle: 'text-on-surface-variant',
  stopped: 'text-primary',
  zombie: 'text-error',
  unknown: 'text-on-surface-variant'
}

const SYSTEM_USERS = new Set(['root', 'systemd', 'daemon', 'messagebus', 'syslog', '?'])

const GRID = 'grid-cols-[90px_3fr_1.2fr_90px_120px_110px]'

export function ProcessManager(): JSX.Element {
  const { data, error } = usePoll(() => window.lynx.getProcesses(), useInterval(2000))
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [view, setView] = useState<View>('flat')
  const [sortKey, setSortKey] = useState<SortKey>('cpu')
  const [asc, setAsc] = useState(false)
  const [selected, setSelected] = useState<ProcessInfo | null>(null)
  const [reniceOpen, setReniceOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())

  const signalSelected = async (signal: Signal): Promise<void> => {
    if (!selected) return
    const label = `${signal === 'KILL' ? 'Kill' : 'Terminate'} ${selected.name} (PID ${selected.pid})`
    const result = await window.lynx.killProcess({ pid: selected.pid, signal })
    toast.fromAction(label, result)
    if (result.ok) setSelected(null)
  }

  const renice = async (priority: number): Promise<void> => {
    if (!selected) return
    const result = await window.lynx.reniceProcess({ pid: selected.pid, priority })
    toast.fromAction(`Renice ${selected.name} → ${priority}`, result)
    setReniceOpen(false)
  }

  // Filtered set shared by both views.
  const filtered = useMemo(() => {
    let list: ProcessInfo[] = data?.processes ?? []
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.cmdline.toLowerCase().includes(q) ||
          String(p.pid).includes(q) ||
          p.user.toLowerCase().includes(q)
      )
    }
    if (filter === 'system') list = list.filter((p) => SYSTEM_USERS.has(p.user))
    else if (filter === 'mine') list = list.filter((p) => !SYSTEM_USERS.has(p.user))
    return list
  }, [data, query, filter])

  // Flat view: sorted rows.
  const flatRows = useMemo(() => {
    const dir = asc ? 1 : -1
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'pid':
          return (a.pid - b.pid) * dir
        case 'name':
          return a.name.localeCompare(b.name) * dir
        case 'user':
          return a.user.localeCompare(b.user) * dir
        case 'mem':
          return (a.memBytes - b.memBytes) * dir
        case 'cpu':
        default:
          return (a.cpuPercent - b.cpuPercent) * dir
      }
    })
  }, [filtered, sortKey, asc])

  // Tree view: rows flattened from the ppid hierarchy, honoring collapse state.
  const treeRows = useMemo(
    () => buildTree(filtered, collapsed),
    [filtered, collapsed]
  )

  const toggleSort = (key: SortKey): void => {
    if (key === sortKey) setAsc((v) => !v)
    else {
      setSortKey(key)
      setAsc(key === 'name' || key === 'user')
    }
  }

  const toggleCollapse = (pid: number): void =>
    setCollapsed((cur) => {
      const next = new Set(cur)
      if (next.has(pid)) next.delete(pid)
      else next.add(pid)
      return next
    })

  return (
    <section className="flex h-full flex-col">
      <PageHeader
        title="Process Manager"
        subtitle={data ? `${data.processes.length} processes` : 'Process list (read-only)'}
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
            placeholder="Search processes (PID, name, user, command)…"
            className="w-full rounded-lg border border-outline-variant bg-surface-container-high py-1.5 pl-9 pr-4 font-body-md text-body-md text-on-surface transition-colors placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1">
          {(['flat', 'tree'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex items-center gap-1 rounded border px-3 py-1 font-label-caps text-label-caps uppercase transition-colors ${
                view === v
                  ? 'border-outline-variant bg-surface-variant text-on-surface'
                  : 'border-transparent text-on-surface-variant hover:bg-surface-variant'
              }`}
            >
              <Icon name={v === 'flat' ? 'list' : 'account_tree'} className="text-[16px]" />
              {v === 'flat' ? 'Flat' : 'Tree'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {(['all', 'mine', 'system'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded border px-3 py-1 font-label-caps text-label-caps uppercase transition-colors ${
                filter === f
                  ? 'border-outline-variant bg-surface-variant text-on-surface'
                  : 'border-transparent text-on-surface-variant hover:bg-surface-variant'
              }`}
            >
              {f === 'all' ? 'All' : f === 'mine' ? 'My Processes' : 'System'}
            </button>
          ))}
        </div>

        {/* Action buttons — operate on the selected row */}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <ActionButton
              icon="tune"
              label="Priority"
              disabled={!selected}
              onClick={() => setReniceOpen((v) => !v)}
            />
            {reniceOpen && selected && (
              <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-outline-variant bg-surface-container-high p-1 shadow-lg">
                {[
                  { label: 'High (−10)', value: -10 },
                  { label: 'Normal (0)', value: 0 },
                  { label: 'Low (10)', value: 10 },
                  { label: 'Lowest (19)', value: 19 }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => void renice(opt.value)}
                    className="block w-full rounded px-3 py-1.5 text-left font-body-md text-body-md text-on-surface hover:bg-surface-variant"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <ActionButton
            icon="stop_circle"
            label="Terminate"
            disabled={!selected}
            onClick={() => void signalSelected('TERM')}
          />
          <ActionButton
            icon="cancel"
            label="Kill"
            disabled={!selected}
            danger
            onClick={() => void signalSelected('KILL')}
          />
        </div>
      </div>

      {error && <p className="mb-4 font-data-mono text-data-mono text-error">{error}</p>}

      {/* Table */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container">
        <div className={`grid shrink-0 ${GRID} gap-4 border-b border-outline-variant bg-surface-container-high p-3 font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant`}>
          {view === 'flat' ? (
            <>
              <HeaderCell label="PID" active={sortKey === 'pid'} asc={asc} onClick={() => toggleSort('pid')} />
              <HeaderCell label="Process / Command" active={sortKey === 'name'} asc={asc} onClick={() => toggleSort('name')} />
              <HeaderCell label="User" active={sortKey === 'user'} asc={asc} onClick={() => toggleSort('user')} />
              <HeaderCell label="CPU %" align="right" active={sortKey === 'cpu'} asc={asc} onClick={() => toggleSort('cpu')} />
              <HeaderCell label="Memory" align="right" active={sortKey === 'mem'} asc={asc} onClick={() => toggleSort('mem')} />
              <span>Status</span>
            </>
          ) : (
            <>
              <span>PID</span>
              <span>Process / Command</span>
              <span>User</span>
              <span className="text-right">CPU %</span>
              <span className="text-right">Memory</span>
              <span>Status</span>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto font-data-mono text-data-mono">
          {view === 'flat' &&
            flatRows.map((p) => (
              <Row
                key={p.pid}
                p={p}
                selected={selected?.pid === p.pid}
                onSelect={() => setSelected((cur) => (cur?.pid === p.pid ? null : p))}
              />
            ))}

          {view === 'tree' &&
            treeRows.map(({ proc, depth, hasChildren }) => (
              <Row
                key={proc.pid}
                p={proc}
                depth={depth}
                hasChildren={hasChildren}
                collapsed={collapsed.has(proc.pid)}
                onToggle={() => toggleCollapse(proc.pid)}
                selected={selected?.pid === proc.pid}
                onSelect={() => setSelected((cur) => (cur?.pid === proc.pid ? null : proc))}
              />
            ))}

          {!data && <p className="p-3 text-on-surface-variant">Loading…</p>}
          {data && (view === 'flat' ? flatRows : treeRows).length === 0 && (
            <p className="p-3 text-on-surface-variant">No matching processes.</p>
          )}
        </div>
      </div>

      <p className="mt-3 font-body-md text-body-md text-on-surface-variant">
        {selected
          ? `Selected: ${selected.name} (PID ${selected.pid}, ${selected.user}). Acting on another user’s process prompts for the root password.`
          : 'Select a process to terminate, kill, or change its priority. Toggle Tree to see the parent/child hierarchy.'}
      </p>
    </section>
  )
}

interface TreeRow {
  proc: ProcessInfo
  depth: number
  hasChildren: boolean
}

/**
 * Flatten the process list into ordered tree rows using ppid. Processes whose
 * parent isn't in the (filtered) set become roots, so filtering never hides a
 * subtree behind a missing parent. Children are sorted by CPU desc within a
 * parent. Collapsed nodes hide their descendants.
 */
function buildTree(list: ProcessInfo[], collapsed: Set<number>): TreeRow[] {
  const byPid = new Map<number, ProcessInfo>()
  for (const p of list) byPid.set(p.pid, p)

  const children = new Map<number, ProcessInfo[]>()
  const roots: ProcessInfo[] = []
  for (const p of list) {
    if (p.ppid && byPid.has(p.ppid) && p.ppid !== p.pid) {
      const arr = children.get(p.ppid) ?? []
      arr.push(p)
      children.set(p.ppid, arr)
    } else {
      roots.push(p)
    }
  }

  const byCpu = (a: ProcessInfo, b: ProcessInfo): number => b.cpuPercent - a.cpuPercent
  roots.sort(byCpu)
  for (const arr of children.values()) arr.sort(byCpu)

  const rows: TreeRow[] = []
  const walk = (p: ProcessInfo, depth: number): void => {
    const kids = children.get(p.pid) ?? []
    rows.push({ proc: p, depth, hasChildren: kids.length > 0 })
    if (collapsed.has(p.pid)) return
    for (const kid of kids) walk(kid, depth + 1)
  }
  for (const r of roots) walk(r, 0)
  return rows
}

function Row({
  p,
  selected,
  onSelect,
  depth,
  hasChildren,
  collapsed,
  onToggle
}: {
  p: ProcessInfo
  selected: boolean
  onSelect: () => void
  depth?: number
  hasChildren?: boolean
  collapsed?: boolean
  onToggle?: () => void
}): JSX.Element {
  const isTree = depth !== undefined
  return (
    <div
      title={p.cmdline}
      onClick={onSelect}
      className={`grid cursor-pointer ${GRID} items-center gap-4 border-b border-outline-variant/30 px-3 py-2 ${
        selected ? 'bg-primary/15' : 'hover:bg-surface-variant/40'
      }`}
    >
      <span className="text-on-surface-variant">{p.pid}</span>
      <div className="flex min-w-0 items-center" style={isTree ? { paddingLeft: `${(depth ?? 0) * 16}px` } : undefined}>
        {isTree && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggle?.()
            }}
            className={`mr-1 flex h-4 w-4 shrink-0 items-center justify-center text-on-surface-variant ${
              hasChildren ? '' : 'opacity-0'
            }`}
            aria-label={collapsed ? 'Expand' : 'Collapse'}
          >
            <Icon name={collapsed ? 'arrow_right' : 'arrow_drop_down'} className="text-[18px]" />
          </button>
        )}
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-on-surface">{p.name}</span>
          <span className="truncate text-[11px] text-on-surface-variant/70">{p.cmdline}</span>
        </div>
      </div>
      <span className="truncate text-on-surface-variant">{p.user}</span>
      <span className="text-right text-on-surface">{p.cpuPercent.toFixed(1)}</span>
      <span className="text-right text-on-surface-variant">
        {formatBytes(p.memBytes)} <span className="text-on-surface-variant/60">({formatPercent(p.memPercent)})</span>
      </span>
      <span className={STATE_COLOR[p.state]}>{p.state}</span>
    </div>
  )
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  danger
}: {
  icon: string
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded px-3 py-1.5 font-title-sm text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? 'bg-error text-on-error hover:bg-error/90'
          : 'border border-outline-variant text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
      }`}
    >
      <Icon name={icon} className="text-[16px]" />
      {label}
    </button>
  )
}

function HeaderCell({
  label,
  active,
  asc,
  align = 'left',
  onClick
}: {
  label: string
  active: boolean
  asc: boolean
  align?: 'left' | 'right'
  onClick: () => void
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 hover:text-on-surface ${
        align === 'right' ? 'justify-end text-right' : ''
      } ${active ? 'text-on-surface' : ''}`}
    >
      {label}
      {active && <Icon name={asc ? 'arrow_drop_up' : 'arrow_drop_down'} className="text-[14px]" />}
    </button>
  )
}
