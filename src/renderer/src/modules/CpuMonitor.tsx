import { Card } from '../components/Card'
import { PageHeader } from '../components/PageHeader'
import { AreaChart } from '../components/AreaChart'
import { ProgressBar } from '../components/ProgressBar'
import { usePoll, useHistory } from '../lib/usePoll'
import { useInterval } from '../app/SettingsProvider'
import { formatFreq, formatPercent } from '../lib/format'

/** Color a per-core bar by load: green → primary → error. */
function coreColor(pct: number): string {
  if (pct >= 85) return 'bg-error'
  if (pct >= 50) return 'bg-primary'
  return 'bg-tertiary'
}

export function CpuMonitor(): JSX.Element {
  const { data, error } = usePoll(() => window.lynx.getCpu(), useInterval(1000))
  const usageHistory = useHistory(data?.usage, 60)

  return (
    <section>
      <PageHeader
        title="CPU Monitor"
        subtitle={data?.model ?? 'Per-core utilization, frequency & load'}
      />

      {error && <p className="mb-4 font-data-mono text-data-mono text-error">{error}</p>}

      <div className="grid grid-cols-1 gap-grid_gutter md:grid-cols-12">
        <Card title="Total Utilization" icon="speed" className="md:col-span-8">
          <AreaChart
            data={usageHistory}
            max={100}
            colorClass="text-primary"
            height={160}
            format={(v) => formatPercent(v)}
          />
        </Card>

        <Card title="At a Glance" icon="insights" className="md:col-span-4">
          <div className="flex flex-grow flex-col justify-between gap-4">
            <Stat label="Usage" value={formatPercent(data?.usage ?? 0)} />
            <Stat label="Frequency" value={data ? formatFreq(data.freqMhz) : '—'} />
            <Stat label="Cores / Threads" value={data ? String(data.cores) : '—'} />
            <Stat
              label="Temperature"
              value={data?.tempC !== undefined ? `${Math.round(data.tempC)}°C` : 'n/a'}
            />
            <Stat
              label="Load (1/5/15m)"
              value={data ? data.loadAvg.map((l) => l.toFixed(2)).join('  ') : '—'}
            />
          </div>
        </Card>

        <Card title="Per-Core Utilization" icon="grid_view" className="md:col-span-12">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
            {(data?.perCore ?? []).map((pct, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-12 shrink-0 font-data-mono text-data-mono text-on-surface-variant">
                  CPU{i}
                </span>
                <ProgressBar percent={pct} colorClass={coreColor(pct)} />
                <span className="w-10 shrink-0 text-right font-data-mono text-data-mono text-on-surface">
                  {formatPercent(pct)}
                </span>
              </div>
            ))}
            {!data && (
              <p className="font-data-mono text-data-mono text-on-surface-variant">Loading…</p>
            )}
          </div>
        </Card>
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className="font-body-md text-body-md text-on-surface-variant">{label}</span>
      <span className="font-data-mono text-data-mono text-on-surface">{value}</span>
    </div>
  )
}
