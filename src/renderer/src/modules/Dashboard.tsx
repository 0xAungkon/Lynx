import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SystemInfo } from '@shared/ipc'
import { Card } from '../components/Card'
import { Ring } from '../components/Ring'
import { ProgressBar } from '../components/ProgressBar'
import { Icon } from '../components/Icon'
import { usePoll } from '../lib/usePoll'
import { useInterval } from '../app/SettingsProvider'
import {
  formatBytes,
  formatFreq,
  formatGiB,
  formatPercent,
  formatRate,
  formatUptime
} from '../lib/format'

/** Card whose whole surface is a link to a monitor page. */
function LinkCard({
  to,
  title,
  className = '',
  children
}: {
  to: string
  title: string
  className?: string
  children: ReactNode
}): JSX.Element {
  const navigate = useNavigate()
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(to)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') navigate(to)
      }}
      className={`group flex cursor-pointer flex-col rounded-xl border border-outline-variant bg-surface-container p-card_padding transition-colors hover:border-primary/60 hover:bg-surface-container-high ${className}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-title-sm text-title-sm text-on-surface">{title}</h3>
        <Icon
          name="arrow_forward"
          className="text-[18px] text-on-surface-variant opacity-0 transition-opacity group-hover:opacity-100"
        />
      </div>
      {children}
    </div>
  )
}

function MiniBar({
  label,
  value,
  percent,
  colorClass
}: {
  label: string
  value: string
  percent: number
  colorClass: string
}): JSX.Element {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">{label}</span>
        <span className="font-data-mono text-data-mono text-on-surface">{value}</span>
      </div>
      <ProgressBar percent={percent} colorClass={colorClass} />
    </div>
  )
}

function coreColor(pct: number): string {
  if (pct >= 85) return 'bg-error'
  if (pct >= 50) return 'bg-primary'
  return 'bg-tertiary'
}

export function Dashboard(): JSX.Element {
  const [sys, setSys] = useState<SystemInfo | null>(null)
  const [sysError, setSysError] = useState<string | null>(null)

  const cpu = usePoll(() => window.lynx.getCpu(), useInterval(1500))
  const mem = usePoll(() => window.lynx.getMemory(), useInterval(1500))
  const disk = usePoll(() => window.lynx.getDisk(), useInterval(3000))
  const net = usePoll(() => window.lynx.getNetwork(), useInterval(1500))
  const gpu = usePoll(() => window.lynx.getGpu(), useInterval(2000))

  useEffect(() => {
    window.lynx
      .getSystemInfo()
      .then(setSys)
      .catch((e: unknown) => setSysError(e instanceof Error ? e.message : String(e)))
  }, [])

  const root = disk.data?.filesystems.find((f) => f.target === '/') ?? disk.data?.filesystems[0]
  // Top filesystems by size for the per-fs bars.
  const topFs = (disk.data?.filesystems ?? []).slice(0, 4)
  // Active, non-loopback interfaces sorted by current throughput.
  const topIfaces = (net.data?.interfaces ?? [])
    .filter((i) => i.name !== 'lo')
    .sort((a, b) => b.rxBytesPerSec + b.txBytesPerSec - (a.rxBytesPerSec + a.txBytesPerSec))
    .slice(0, 5)

  const swapPercent =
    mem.data && mem.data.swapTotalBytes ? (mem.data.swapUsedBytes / mem.data.swapTotalBytes) * 100 : 0
  const gpus = gpu.data?.supported ? gpu.data.gpus : []
  const gpuProcs = gpu.data?.supported ? gpu.data.processes : []

  return (
    <section>
      <div className="mb-8">
        <h1 className="font-display-lg text-display-lg text-on-surface">System Dashboard</h1>
        <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
          Real-time performance overview
        </p>
      </div>

      <div className="grid grid-cols-1 gap-grid_gutter md:grid-cols-12">
        {/* CPU — ring + per-core bars */}
        <LinkCard to="/cpu" title="CPU" className="md:col-span-6">
          <div className="flex items-center gap-4">
            <Ring
              percent={cpu.data?.usage ?? 0}
              label={formatPercent(cpu.data?.usage ?? 0)}
              sublabel={cpu.data ? formatFreq(cpu.data.freqMhz) : '—'}
              colorClass="stroke-primary"
              sublabelClass="text-primary"
              size={104}
            />
            <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-1.5">
              {(cpu.data?.perCore ?? []).map((pct, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-7 shrink-0 font-data-mono text-[10px] text-on-surface-variant">
                    {i}
                  </span>
                  <ProgressBar percent={pct} colorClass={coreColor(pct)} />
                </div>
              ))}
              {!cpu.data && (
                <span className="font-data-mono text-data-mono text-on-surface-variant">Loading…</span>
              )}
            </div>
          </div>
          <p className="mt-3 truncate font-label-caps text-label-caps uppercase text-on-surface-variant">
            {cpu.data?.model ?? '—'}
          </p>
        </LinkCard>

        {/* Memory — ring + RAM & swap bars */}
        <LinkCard to="/memory" title="Memory" className="md:col-span-6">
          <div className="flex items-center gap-4">
            <Ring
              percent={mem.data?.percent ?? 0}
              label={formatPercent(mem.data?.percent ?? 0)}
              sublabel={mem.data ? formatGiB(mem.data.usedBytes) : '—'}
              colorClass="stroke-tertiary"
              sublabelClass="text-tertiary"
              size={104}
            />
            <div className="flex flex-1 flex-col justify-center gap-3">
              <MiniBar
                label="RAM"
                value={mem.data ? `${formatGiB(mem.data.usedBytes)} / ${formatGiB(mem.data.totalBytes)}` : '—'}
                percent={mem.data?.percent ?? 0}
                colorClass="bg-tertiary"
              />
              <MiniBar
                label="Swap"
                value={
                  mem.data && mem.data.swapTotalBytes
                    ? `${formatGiB(mem.data.swapUsedBytes)} / ${formatGiB(mem.data.swapTotalBytes)}`
                    : 'none'
                }
                percent={swapPercent}
                colorClass="bg-primary-container"
              />
            </div>
          </div>
        </LinkCard>

        {/* Disk — ring + per-filesystem bars */}
        <LinkCard to="/storage" title="Disk" className="md:col-span-6">
          <div className="flex items-center gap-4">
            <Ring
              percent={root?.percent ?? 0}
              label={formatPercent(root?.percent ?? 0)}
              sublabel={root ? formatBytes(root.usedBytes) : '—'}
              colorClass="stroke-secondary"
              sublabelClass="text-secondary"
              size={104}
            />
            <div className="flex flex-1 flex-col justify-center gap-2">
              {topFs.map((fs) => (
                <MiniBar
                  key={fs.source + fs.target}
                  label={fs.target}
                  value={`${formatBytes(fs.usedBytes)} / ${formatBytes(fs.sizeBytes)}`}
                  percent={fs.percent}
                  colorClass={fs.percent >= 90 ? 'bg-error' : 'bg-secondary'}
                />
              ))}
              {!disk.data && (
                <span className="font-data-mono text-data-mono text-on-surface-variant">Loading…</span>
              )}
            </div>
          </div>
        </LinkCard>

        {/* Network — table of top interfaces */}
        <LinkCard to="/network" title="Network" className="md:col-span-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-outline-variant text-left font-label-caps text-label-caps uppercase text-on-surface-variant">
                  <th className="py-1 pr-3">Iface</th>
                  <th className="py-1 pr-3 text-right">↓ Down</th>
                  <th className="py-1 pr-3 text-right">↑ Up</th>
                  <th className="py-1 pr-3 text-right">RX</th>
                  <th className="py-1 text-right">TX</th>
                </tr>
              </thead>
              <tbody className="font-data-mono text-data-mono">
                {topIfaces.map((i) => (
                  <tr key={i.name} className="border-b border-outline-variant/30">
                    <td className="py-1 pr-3 text-on-surface">
                      <span
                        className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${i.up ? 'bg-tertiary' : 'bg-outline'}`}
                      />
                      {i.name}
                    </td>
                    <td className="py-1 pr-3 text-right text-tertiary">{formatRate(i.rxBytesPerSec)}</td>
                    <td className="py-1 pr-3 text-right text-primary">{formatRate(i.txBytesPerSec)}</td>
                    <td className="py-1 pr-3 text-right text-on-surface-variant">{formatBytes(i.rxBytes)}</td>
                    <td className="py-1 text-right text-on-surface-variant">{formatBytes(i.txBytes)}</td>
                  </tr>
                ))}
                {topIfaces.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-2 text-on-surface-variant">
                      {net.data ? 'No active interfaces' : 'Loading…'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </LinkCard>

        {/* System info — double column, comprehensive */}
        <Card title="System Information" icon="info" className="md:col-span-8">
          {sysError && <p className="font-data-mono text-data-mono text-error">{sysError}</p>}
          {!sys && !sysError && (
            <p className="font-data-mono text-data-mono text-on-surface-variant">Loading…</p>
          )}
          {sys && (
            <div className="grid grid-cols-1 gap-x-10 gap-y-2 sm:grid-cols-2">
              <InfoRow label="Hostname" value={sys.hostname} />
              <InfoRow label="OS" value={sys.platform} />
              <InfoRow label="OS Version" value={sys.osVersion} />
              <InfoRow label="Kernel" value={sys.kernel} />
              <InfoRow label="Architecture" value={sys.arch} />
              <InfoRow label="Init System" value={sys.initSystem} />
              <InfoRow label="Desktop" value={sys.desktop} />
              <InfoRow label="Session" value={sys.sessionType} />
              <InfoRow label="Shell" value={sys.shell} />
              <InfoRow label="Uptime" value={formatUptime(sys.uptimeSec)} />

              <InfoRow label="Manufacturer" value={sys.sysVendor} />
              <InfoRow label="Product" value={sys.productName} />
              <InfoRow label="Motherboard" value={joinDefined([sys.boardVendor, sys.boardName])} />
              <InfoRow label="Board Rev" value={sys.boardVersion} />
              <InfoRow label="Chassis" value={sys.chassis} />
              <InfoRow label="BIOS" value={joinDefined([sys.biosVendor, sys.biosVersion])} />
              <InfoRow label="BIOS Date" value={sys.biosDate} />

              <InfoRow label="CPU" value={sys.cpuModel} />
              <InfoRow label="CPU Vendor" value={sys.cpuVendor} />
              <InfoRow
                label="Cores / Threads"
                value={
                  sys.cpuPhysicalCores
                    ? `${sys.cpuPhysicalCores} cores / ${sys.cpuCount} threads`
                    : `${sys.cpuCount} threads`
                }
              />
              <InfoRow
                label="Clock Range"
                value={
                  sys.cpuMinMhz && sys.cpuMaxMhz
                    ? `${formatFreq(sys.cpuMinMhz)} – ${formatFreq(sys.cpuMaxMhz)}`
                    : undefined
                }
              />
              <InfoRow label="Sockets" value={sys.cpuSockets ? String(sys.cpuSockets) : undefined} />
              <InfoRow label="Memory" value={formatGiB(sys.totalMemBytes, 0)} />
              <InfoRow
                label="Swap"
                value={sys.swapTotalBytes ? formatGiB(sys.swapTotalBytes, 0) : 'none'}
              />
              <InfoRow label="Machine ID" value={sys.machineId} />
              <InfoRow label="Lynx Version" value={sys.appVersion} />
            </div>
          )}
        </Card>

        {/* Right column — GPU status with load average stacked beneath */}
        <div className="flex flex-col gap-grid_gutter md:col-span-4">
          {/* GPU summary — all GPUs + top processes */}
          <LinkCard to="/gpu" title="GPU Status">
          {!gpu.data?.supported && (
            <p className="font-data-mono text-data-mono text-on-surface-variant">
              {gpu.data?.note ?? 'Detecting GPU…'}
            </p>
          )}
          {gpus.length > 0 && (
            <div className="flex flex-col gap-4">
              {gpus.map((g) => (
                <div key={g.index} className="flex flex-col gap-2">
                  <p className="truncate font-data-mono text-data-mono text-tertiary" title={g.name}>
                    {gpus.length > 1 && <span className="text-on-surface-variant">[{g.index}] </span>}
                    {g.name}
                  </p>
                  <MiniBar
                    label="Util"
                    value={formatPercent(g.utilization ?? 0)}
                    percent={g.utilization ?? 0}
                    colorClass="bg-tertiary"
                  />
                  {g.memTotalBytes ? (
                    <MiniBar
                      label="VRAM"
                      value={`${formatBytes(g.memUsedBytes ?? 0)} / ${formatBytes(g.memTotalBytes)}`}
                      percent={((g.memUsedBytes ?? 0) / g.memTotalBytes) * 100}
                      colorClass="bg-secondary"
                    />
                  ) : null}
                  <div className="flex items-center gap-3 font-data-mono text-data-mono text-on-surface-variant">
                    {g.tempC !== undefined && <span>{Math.round(g.tempC)}°C</span>}
                    {g.fanPercent !== undefined && <span>{Math.round(g.fanPercent)}% fan</span>}
                    {g.powerW !== undefined && <span>{Math.round(g.powerW)}W</span>}
                  </div>
                </div>
              ))}

              {gpuProcs.length > 0 && (
                <div className="border-t border-outline-variant/30 pt-2">
                  <p className="mb-1 font-label-caps text-label-caps uppercase text-on-surface-variant">
                    Top Processes
                  </p>
                  <div className="flex flex-col gap-1 font-data-mono text-data-mono">
                    {gpuProcs.map((p) => (
                      <div key={`${p.gpuIndex}-${p.pid}`} className="flex items-center justify-between gap-2">
                        <span className="truncate text-on-surface" title={`${p.name} (pid ${p.pid})`}>
                          {p.name}
                        </span>
                        <span className="shrink-0 text-on-surface-variant">
                          {p.utilization !== undefined && p.utilization > 0
                            ? formatPercent(p.utilization)
                            : p.memBytes !== undefined
                              ? formatBytes(p.memBytes)
                              : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          </LinkCard>

          {/* Load average — stacked under GPU in the right column */}
          <Card title="Load Average" icon="speed">
            {cpu.data ? (
              <div className="flex items-center justify-between gap-2">
                {(['1 min', '5 min', '15 min'] as const).map((lbl, i) => (
                  <div key={lbl} className="flex flex-1 flex-col items-center gap-0.5">
                    <span className="font-display-lg text-display-lg text-primary">
                      {cpu.data!.loadAvg[i].toFixed(2)}
                    </span>
                    <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                      {lbl}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-data-mono text-data-mono text-on-surface-variant">Loading…</p>
            )}
          </Card>
        </div>
      </div>
    </section>
  )
}

/** Join the defined, non-empty parts with a space (for vendor + model pairs). */
function joinDefined(parts: (string | undefined)[]): string | undefined {
  const joined = parts.filter(Boolean).join(' ').trim()
  return joined.length ? joined : undefined
}

function InfoRow({ label, value }: { label: string; value?: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-outline-variant/20 py-0.5">
      <span className="shrink-0 font-body-md text-body-md text-on-surface-variant">{label}</span>
      <span className="truncate text-right font-data-mono text-data-mono text-on-surface" title={value}>
        {value ?? '—'}
      </span>
    </div>
  )
}
