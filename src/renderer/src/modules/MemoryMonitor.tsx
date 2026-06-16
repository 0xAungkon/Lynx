import { Card } from '../components/Card'
import { PageHeader } from '../components/PageHeader'
import { AreaChart } from '../components/AreaChart'
import { ProgressBar } from '../components/ProgressBar'
import { Ring } from '../components/Ring'
import { usePoll, useHistory } from '../lib/usePoll'
import { useInterval } from '../app/SettingsProvider'
import { formatGiB, formatPercent } from '../lib/format'

export function MemoryMonitor(): JSX.Element {
  const { data, error } = usePoll(() => window.lynx.getMemory(), useInterval(1000))
  const usageHistory = useHistory(data?.percent, 60)

  const swapPercent = data && data.swapTotalBytes ? (data.swapUsedBytes / data.swapTotalBytes) * 100 : 0

  return (
    <section>
      <PageHeader title="Memory Monitor" subtitle="Physical memory & swap usage" />

      {error && <p className="mb-4 font-data-mono text-data-mono text-error">{error}</p>}

      <div className="grid grid-cols-1 gap-grid_gutter md:grid-cols-12">
        <Card className="items-center justify-center md:col-span-4">
          <h3 className="mb-2 w-full text-center font-title-sm text-title-sm text-on-surface">
            Physical Memory
          </h3>
          <Ring
            percent={data?.percent ?? 0}
            label={formatPercent(data?.percent ?? 0)}
            sublabel={data ? `${formatGiB(data.usedBytes)} / ${formatGiB(data.totalBytes)}` : '—'}
            colorClass="stroke-tertiary"
            sublabelClass="text-tertiary"
            size={180}
          />
        </Card>

        <Card title="Usage History" icon="show_chart" className="md:col-span-8">
          <AreaChart
            data={usageHistory}
            max={100}
            colorClass="text-tertiary"
            height={180}
            format={(v) => formatPercent(v)}
          />
        </Card>

        <Card title="Breakdown" icon="data_usage" className="md:col-span-6">
          <div className="flex flex-grow flex-col justify-between gap-4">
            <Row label="Total" value={data ? formatGiB(data.totalBytes) : '—'} />
            <Row label="Used" value={data ? formatGiB(data.usedBytes) : '—'} accent="text-tertiary" />
            <Row label="Available" value={data ? formatGiB(data.availableBytes) : '—'} />
            <Row label="Cached" value={data ? formatGiB(data.cachedBytes) : '—'} />
            <Row label="Buffers" value={data ? formatGiB(data.buffersBytes) : '—'} />
            <Row label="Free" value={data ? formatGiB(data.freeBytes) : '—'} />
          </div>
        </Card>

        <Card title="Swap" icon="swap_horiz" className="md:col-span-6">
          {data && data.swapTotalBytes > 0 ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="font-body-md text-body-md text-on-surface-variant">Used</span>
                <span className="font-data-mono text-data-mono text-on-surface">
                  {formatGiB(data.swapUsedBytes)} / {formatGiB(data.swapTotalBytes)}
                </span>
              </div>
              <ProgressBar percent={swapPercent} colorClass="bg-primary" />
              <p className="font-data-mono text-data-mono text-on-surface-variant">
                {formatPercent(swapPercent)} of swap in use
              </p>
            </div>
          ) : (
            <p className="font-data-mono text-data-mono text-on-surface-variant">No swap configured.</p>
          )}
        </Card>
      </div>
    </section>
  )
}

function Row({
  label,
  value,
  accent = 'text-on-surface'
}: {
  label: string
  value: string
  accent?: string
}): JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className="font-body-md text-body-md text-on-surface-variant">{label}</span>
      <span className={`font-data-mono text-data-mono ${accent}`}>{value}</span>
    </div>
  )
}
