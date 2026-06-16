import { useCallback, useState } from 'react'
import type { DirScan, Filesystem, ScanEntry } from '@shared/ipc'
import { Card } from '../components/Card'
import { PageHeader } from '../components/PageHeader'
import { ProgressBar } from '../components/ProgressBar'
import { Icon } from '../components/Icon'
import { useToast } from '../components/Toast'
import { usePoll } from '../lib/usePoll'
import { useInterval } from '../app/SettingsProvider'
import { formatBytes, formatPercent, formatRate } from '../lib/format'

function usageColor(pct: number): string {
  if (pct >= 90) return 'bg-error'
  if (pct >= 75) return 'bg-primary'
  return 'bg-tertiary'
}

export function StorageManager(): JSX.Element {
  const { data, error } = usePoll(() => window.lynx.getDisk(), useInterval(3000))

  return (
    <section>
      <PageHeader title="Storage & Disk" subtitle="Mounted filesystems, live I/O & usage browser" />

      {error && <p className="mb-4 font-data-mono text-data-mono text-error">{error}</p>}

      <div className="mb-grid_gutter grid grid-cols-2 gap-grid_gutter md:grid-cols-2">
        <Card title="Disk Read" icon="download" className="md:col-span-1">
          <span className="font-display-lg text-display-lg text-tertiary">
            {data ? formatRate(data.readBytesPerSec) : '—'}
          </span>
        </Card>
        <Card title="Disk Write" icon="upload" className="md:col-span-1">
          <span className="font-display-lg text-display-lg text-primary">
            {data ? formatRate(data.writeBytesPerSec) : '—'}
          </span>
        </Card>
      </div>

      <Card title="Filesystems" icon="hard_drive" className="mb-grid_gutter">
        <div className="flex flex-col gap-5">
          {data?.filesystems.map((fs) => (
            <div key={fs.source + fs.target} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-3">
                  <span className="font-data-mono text-data-mono text-on-surface">{fs.target}</span>
                  <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                    {fs.source} · {fs.fsType}
                  </span>
                </div>
                <div className="flex items-baseline gap-4 font-data-mono text-data-mono">
                  <span className="text-tertiary" title="Read">
                    ↓ {formatRate(fs.readBytesPerSec)}
                  </span>
                  <span className="text-primary" title="Write">
                    ↑ {formatRate(fs.writeBytesPerSec)}
                  </span>
                  <span className="text-on-surface-variant">
                    {formatBytes(fs.usedBytes)} / {formatBytes(fs.sizeBytes)} ({formatPercent(fs.percent)})
                  </span>
                </div>
              </div>
              <ProgressBar percent={fs.percent} colorClass={usageColor(fs.percent)} />
            </div>
          ))}
          {!data && <p className="font-data-mono text-data-mono text-on-surface-variant">Loading…</p>}
          {data && data.filesystems.length === 0 && (
            <p className="font-data-mono text-data-mono text-on-surface-variant">
              No mounted filesystems detected.
            </p>
          )}
        </div>
      </Card>

      <Card title="Disk Usage Browser" icon="folder_open">
        <p className="mb-4 font-body-md text-body-md text-on-surface-variant">
          Expand a filesystem to drill into its largest folders and files (biggest first), and delete
          to reclaim space. Deleting a system-owned path will prompt for the root password.
        </p>
        <div className="flex flex-col gap-2">
          {(data?.filesystems ?? []).map((fs) => (
            <RootNode key={fs.source + fs.target} fs={fs} />
          ))}
          {!data && <p className="font-data-mono text-data-mono text-on-surface-variant">Loading…</p>}
        </div>
      </Card>
    </section>
  )
}

/** A top-level filesystem entry, rendered as a directory node at its mount point. */
function RootNode({ fs }: { fs: Filesystem }): JSX.Element {
  const entry: ScanEntry = {
    name: fs.target,
    path: fs.target,
    sizeBytes: fs.usedBytes,
    isDir: true
  }
  return (
    <div className="rounded-lg border border-outline-variant/40">
      <UsageNode entry={entry} parentTotal={fs.sizeBytes} depth={0} onChanged={() => {}} isRoot />
    </div>
  )
}

/** A spinning Material symbol used while a directory is being scanned. */
function Spinner(): JSX.Element {
  return <Icon name="progress_activity" className="animate-spin text-[18px] text-on-surface-variant" />
}

/**
 * A single row in the usage tree. Directories expand lazily — the first time a
 * node is opened it scans its own subtree (one level), caches the result, and
 * renders the children (largest first) as further UsageNodes.
 */
function UsageNode({
  entry,
  parentTotal,
  depth,
  onChanged,
  isRoot = false
}: {
  entry: ScanEntry
  parentTotal: number
  depth: number
  onChanged: () => void
  isRoot?: boolean
}): JSX.Element {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [scan, setScan] = useState<DirScan | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      setScan(await window.lynx.scanDir({ path: entry.path }))
    } catch (e) {
      toast.push(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setLoading(false)
    }
  }, [entry.path, toast])

  const toggle = (): void => {
    if (!entry.isDir) return
    const next = !open
    setOpen(next)
    if (next && !scan) void load()
  }

  const confirmDelete = async (): Promise<void> => {
    setConfirming(false)
    setDeleting(true)
    try {
      const r = await window.lynx.deletePath({ path: entry.path })
      toast.fromAction(`Delete ${entry.name}`, r)
      if (r.ok) onChanged()
    } finally {
      setDeleting(false)
    }
  }

  const percent = parentTotal > 0 ? (entry.sizeBytes / parentTotal) * 100 : 0

  return (
    <div>
      <div
        className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-variant/40"
        style={{ paddingLeft: `${depth * 18 + 8}px` }}
      >
        {/* Expand chevron (directories only) */}
        <button
          onClick={toggle}
          disabled={!entry.isDir}
          className="flex h-5 w-5 shrink-0 items-center justify-center text-on-surface-variant disabled:opacity-0"
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          <Icon name={open ? 'arrow_drop_down' : 'arrow_right'} />
        </button>

        <Icon
          name={entry.isDir ? 'folder' : 'draft'}
          className={`shrink-0 text-[18px] ${entry.isDir ? 'text-primary' : 'text-on-surface-variant'}`}
        />

        {/* Name + size bar */}
        <button
          onClick={toggle}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          disabled={!entry.isDir}
        >
          <span
            className={`truncate font-data-mono text-data-mono ${isRoot ? 'text-on-surface' : 'text-on-surface'}`}
            title={entry.path}
          >
            {entry.name}
            {entry.isDir && entry.entryCount !== undefined && (
              <span className="ml-2 text-on-surface-variant/60">({entry.entryCount})</span>
            )}
          </span>
          <div className="hidden w-40 shrink-0 sm:block">
            <ProgressBar percent={percent} colorClass={entry.isDir ? 'bg-secondary' : 'bg-tertiary'} />
          </div>
        </button>

        <span className="w-24 shrink-0 text-right font-data-mono text-data-mono text-on-surface-variant">
          {formatBytes(entry.sizeBytes)}
        </span>

        {loading && <Spinner />}

        {/* Delete control — inline confirm to avoid an accidental wipe */}
        {!isRoot && !loading && (
          <div className="flex w-28 shrink-0 justify-end">
            {deleting ? (
              <Spinner />
            ) : confirming ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => void confirmDelete()}
                  className="rounded bg-error px-2 py-0.5 font-label-caps text-label-caps uppercase text-on-error hover:bg-error/90"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="rounded border border-outline-variant px-2 py-0.5 font-label-caps text-label-caps uppercase text-on-surface-variant hover:bg-surface-variant"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="flex items-center gap-1 text-on-surface-variant opacity-0 transition-opacity hover:text-error group-hover:opacity-100"
                title={`Delete ${entry.path}`}
              >
                <Icon name="delete" className="text-[18px]" />
              </button>
            )}
          </div>
        )}
        {isRoot && <div className="w-28 shrink-0" />}
      </div>

      {entry.error && (
        <p
          className="font-data-mono text-[11px] text-on-surface-variant/70"
          style={{ paddingLeft: `${depth * 18 + 52}px` }}
        >
          {entry.error}
        </p>
      )}

      {/* Children */}
      {open && scan && (
        <div>
          {scan.entries.length === 0 && !loading && (
            <p
              className="py-1 font-data-mono text-data-mono text-on-surface-variant"
              style={{ paddingLeft: `${(depth + 1) * 18 + 8}px` }}
            >
              {scan.note ?? 'Empty.'}
            </p>
          )}
          {scan.entries.map((child) => (
            <UsageNode
              key={child.path}
              entry={child}
              parentTotal={scan.totalBytes}
              depth={depth + 1}
              onChanged={load}
            />
          ))}
          {scan.note && scan.entries.length > 0 && (
            <p
              className="py-1 font-data-mono text-[11px] text-on-surface-variant/70"
              style={{ paddingLeft: `${(depth + 1) * 18 + 8}px` }}
            >
              {scan.note}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
