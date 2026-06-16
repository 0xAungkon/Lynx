import { Card } from '../components/Card'
import { PageHeader } from '../components/PageHeader'
import { ProgressBar } from '../components/ProgressBar'
import { Ring } from '../components/Ring'
import { Icon } from '../components/Icon'
import { usePoll } from '../lib/usePoll'
import { useInterval } from '../app/SettingsProvider'
import { formatBytes, formatFreq, formatPercent } from '../lib/format'
import type { GpuDevice, GpuProcess } from '@shared/ipc'

/** A labelled spec row in the details grid; renders nothing when value is absent. */
function Spec({ label, value }: { label: string; value?: string }): JSX.Element | null {
  if (value === undefined || value === '') return null
  return (
    <div className="flex items-center justify-between gap-3 border-b border-outline-variant/20 py-0.5">
      <span className="shrink-0 font-body-md text-body-md text-on-surface-variant">{label}</span>
      <span className="truncate text-right font-data-mono text-data-mono text-on-surface" title={value}>
        {value}
      </span>
    </div>
  )
}

function UsageBar({
  label,
  used,
  total,
  colorClass
}: {
  label: string
  used?: number
  total?: number
  colorClass: string
}): JSX.Element | null {
  if (!total || used === undefined) return null
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="font-body-md text-body-md text-on-surface-variant">{label}</span>
        <span className="font-data-mono text-data-mono text-on-surface">
          {formatBytes(used)} / {formatBytes(total)} ({formatPercent((used / total) * 100)})
        </span>
      </div>
      <ProgressBar percent={(used / total) * 100} colorClass={colorClass} />
    </div>
  )
}

function GpuCard({ gpu }: { gpu: GpuDevice }): JSX.Element {
  const temp =
    gpu.tempC !== undefined
      ? `${Math.round(gpu.tempC)}°C`
      : gpu.tempHotspotC !== undefined
        ? `${Math.round(gpu.tempHotspotC)}°C (hotspot)`
        : undefined

  const power =
    gpu.powerW !== undefined
      ? gpu.powerLimitW !== undefined
        ? `${gpu.powerW.toFixed(1)} W / ${Math.round(gpu.powerLimitW)} W`
        : `${gpu.powerW.toFixed(1)} W`
      : undefined

  const fan =
    gpu.fanRpm !== undefined
      ? `${gpu.fanRpm} RPM`
      : gpu.fanPercent !== undefined
        ? `${Math.round(gpu.fanPercent)}%`
        : undefined

  const coreClock =
    gpu.clockMhz !== undefined
      ? gpu.clockMaxMhz
        ? `${formatFreq(gpu.clockMhz)} / ${formatFreq(gpu.clockMaxMhz)}`
        : formatFreq(gpu.clockMhz)
      : undefined

  const memClock =
    gpu.memClockMhz !== undefined
      ? gpu.memClockMaxMhz
        ? `${formatFreq(gpu.memClockMhz)} / ${formatFreq(gpu.memClockMaxMhz)}`
        : formatFreq(gpu.memClockMhz)
      : undefined

  const pcie =
    gpu.pcieSpeed && gpu.pcieWidth
      ? `${gpu.pcieSpeed} ×${gpu.pcieWidth}`
      : gpu.pcieSpeed ?? (gpu.pcieWidth ? `×${gpu.pcieWidth}` : undefined)

  return (
    <Card
      title={`GPU ${gpu.index}: ${gpu.name}`}
      icon="videogame_asset"
      className="md:col-span-6"
      action={
        <span className="rounded bg-tertiary/10 px-2 py-0.5 font-label-caps text-label-caps uppercase text-tertiary">
          {gpu.vendor}
        </span>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Top: utilization ring + key live metrics */}
        <div className="flex items-center gap-6">
          <Ring
            percent={gpu.utilization ?? 0}
            label={formatPercent(gpu.utilization ?? 0)}
            sublabel="GPU"
            colorClass="stroke-tertiary"
            sublabelClass="text-tertiary"
            size={120}
          />
          <div className="flex flex-1 flex-col gap-3">
            <UsageBar label="VRAM" used={gpu.memUsedBytes} total={gpu.memTotalBytes} colorClass="bg-secondary" />
            <UsageBar
              label="Shared (GTT)"
              used={gpu.gttUsedBytes}
              total={gpu.gttTotalBytes}
              colorClass="bg-primary-container"
            />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-data-mono text-data-mono text-on-surface">
              {temp && <Metric icon="device_thermostat" value={temp} />}
              {fan && <Metric icon="mode_fan" value={fan} />}
              {power && <Metric icon="bolt" value={power} />}
              {gpu.voltageMv !== undefined && <Metric icon="electric_bolt" value={`${gpu.voltageMv} mV`} />}
            </div>
          </div>
        </div>

        {/* Secondary utilizations, when reported */}
        {(gpu.memUtilization !== undefined ||
          gpu.encUtilization !== undefined ||
          gpu.decUtilization !== undefined) && (
          <div className="grid grid-cols-3 gap-4">
            {gpu.memUtilization !== undefined && <MiniStat label="Mem Ctlr" value={formatPercent(gpu.memUtilization)} />}
            {gpu.encUtilization !== undefined && <MiniStat label="Encoder" value={formatPercent(gpu.encUtilization)} />}
            {gpu.decUtilization !== undefined && <MiniStat label="Decoder" value={formatPercent(gpu.decUtilization)} />}
          </div>
        )}

        {/* Full spec sheet, two columns */}
        <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          <Spec label="Vendor" value={gpu.vendorName} />
          <Spec label="Driver" value={joinDefined([gpu.driver, gpu.driverVersion])} />
          <Spec label="VBIOS" value={gpu.vbiosVersion} />
          <Spec label="Bus ID" value={gpu.busId} />
          <Spec label="Core Clock" value={coreClock} />
          <Spec label="Memory Clock" value={memClock} />
          <Spec label="Temperature" value={gpu.tempC !== undefined ? `${Math.round(gpu.tempC)}°C` : undefined} />
          <Spec
            label="Hotspot"
            value={gpu.tempHotspotC !== undefined ? `${Math.round(gpu.tempHotspotC)}°C` : undefined}
          />
          <Spec label="Mem Temp" value={gpu.tempMemC !== undefined ? `${Math.round(gpu.tempMemC)}°C` : undefined} />
          <Spec label="PCIe Link" value={pcie} />
          <Spec label="Perf Level" value={gpu.perfLevel} />
          <Spec label="VRAM Total" value={gpu.memTotalBytes ? formatBytes(gpu.memTotalBytes) : undefined} />
        </div>
      </div>
    </Card>
  )
}

function joinDefined(parts: (string | undefined)[]): string | undefined {
  const j = parts.filter(Boolean).join(' ').trim()
  return j.length ? j : undefined
}

function Metric({ icon, value }: { icon: string; value: string }): JSX.Element {
  return (
    <span className="flex items-center gap-1.5">
      <Icon name={icon} className="text-on-surface-variant" />
      {value}
    </span>
  )
}

function MiniStat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-lg bg-surface-container-high p-2 text-center">
      <div className="font-data-mono text-data-mono text-on-surface">{value}</div>
      <div className="font-label-caps text-label-caps uppercase text-on-surface-variant">{label}</div>
    </div>
  )
}

/**
 * Top processes using the GPU. Works for NVIDIA (nvidia-smi) and AMD/Intel
 * (DRM fdinfo); multi-GPU rows are tagged with their GPU index when >1 exists.
 */
export function GpuProcessTable({
  processes,
  multiGpu
}: {
  processes: GpuProcess[]
  multiGpu: boolean
}): JSX.Element {
  if (processes.length === 0) {
    return (
      <p className="font-data-mono text-data-mono text-on-surface-variant">
        No active GPU processes detected.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-outline-variant text-left font-label-caps text-label-caps uppercase text-on-surface-variant">
            <th className="py-1 pr-3">Process</th>
            <th className="py-1 pr-3 text-right">PID</th>
            {multiGpu && <th className="py-1 pr-3 text-right">GPU</th>}
            <th className="py-1 pr-3 text-right">Type</th>
            <th className="py-1 pr-3 text-right">GPU %</th>
            <th className="py-1 text-right">Memory</th>
          </tr>
        </thead>
        <tbody className="font-data-mono text-data-mono">
          {processes.map((p) => (
            <tr key={`${p.gpuIndex}-${p.pid}`} className="border-b border-outline-variant/30">
              <td className="max-w-[14rem] truncate py-1 pr-3 text-on-surface" title={p.name}>
                {p.name}
              </td>
              <td className="py-1 pr-3 text-right text-on-surface-variant">{p.pid}</td>
              {multiGpu && <td className="py-1 pr-3 text-right text-on-surface-variant">{p.gpuIndex}</td>}
              <td className="py-1 pr-3 text-right text-on-surface-variant">
                {p.type === 'compute' ? 'Compute' : p.type === 'graphics' ? 'Graphics' : '—'}
              </td>
              <td className="py-1 pr-3 text-right text-tertiary">
                {p.utilization !== undefined ? formatPercent(p.utilization) : '—'}
              </td>
              <td className="py-1 text-right text-secondary">
                {p.memBytes !== undefined ? formatBytes(p.memBytes) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function GpuMonitor(): JSX.Element {
  const { data, error } = usePoll(() => window.lynx.getGpu(), useInterval(2000))

  return (
    <section>
      <PageHeader
        title="GPU Monitor"
        subtitle={
          data?.supported
            ? `${data.gpus.length} GPU${data.gpus.length > 1 ? 's' : ''} detected`
            : 'Utilization, VRAM, clocks, temperature & power'
        }
      />

      {error && <p className="mb-4 font-data-mono text-data-mono text-error">{error}</p>}

      {data && !data.supported && (
        <Card title="No GPU Telemetry" icon="info">
          <p className="font-data-mono text-data-mono text-on-surface-variant">{data.note}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-grid_gutter md:grid-cols-12">
        {data?.supported && data.gpus.map((gpu) => <GpuCard key={gpu.index} gpu={gpu} />)}
        {!data && <p className="font-data-mono text-data-mono text-on-surface-variant">Detecting GPUs…</p>}

        {data?.supported && (
          <Card title="Top GPU Processes" icon="memory" className="md:col-span-12">
            <GpuProcessTable processes={data.processes} multiGpu={data.gpus.length > 1} />
          </Card>
        )}
      </div>

      {data?.supported && (
        <p className="mt-3 font-body-md text-body-md text-on-surface-variant">
          Some fields (fan RPM, voltage, per-DIMM clocks) depend on the driver and may be unavailable. Fan and
          clock control arrive in a later phase (privileged, per-vendor).
        </p>
      )}
    </section>
  )
}
