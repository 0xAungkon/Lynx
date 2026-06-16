import { Card } from '../components/Card'
import { PageHeader } from '../components/PageHeader'
import { AreaChart } from '../components/AreaChart'
import { usePoll, useHistory } from '../lib/usePoll'
import { useInterval } from '../app/SettingsProvider'
import { formatBytes, formatRate } from '../lib/format'

export function Network(): JSX.Element {
  const { data, error } = usePoll(() => window.lynx.getNetwork(), useInterval(1000))
  const rxHistory = useHistory(data?.totalRxPerSec, 60)
  const txHistory = useHistory(data?.totalTxPerSec, 60)

  return (
    <section>
      <PageHeader title="Network" subtitle="Interfaces & throughput" />

      {error && <p className="mb-4 font-data-mono text-data-mono text-error">{error}</p>}

      <div className="grid grid-cols-1 gap-grid_gutter md:grid-cols-2">
        <Card title="Download" icon="download" className="md:col-span-1">
          <AreaChart
            data={rxHistory}
            colorClass="text-tertiary"
            height={140}
            format={(v) => formatRate(v)}
          />
        </Card>
        <Card title="Upload" icon="upload" className="md:col-span-1">
          <AreaChart
            data={txHistory}
            colorClass="text-primary"
            height={140}
            format={(v) => formatRate(v)}
          />
        </Card>
      </div>

      <Card title="Interfaces" icon="lan" className="mt-grid_gutter">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-outline-variant text-left font-label-caps text-label-caps uppercase text-on-surface-variant">
                <th className="py-2 pr-4">Interface</th>
                <th className="py-2 pr-4">Address</th>
                <th className="py-2 pr-4">State</th>
                <th className="py-2 pr-4 text-right">↓ Rate</th>
                <th className="py-2 pr-4 text-right">↑ Rate</th>
                <th className="py-2 pr-4 text-right">↓ Total</th>
                <th className="py-2 text-right">↑ Total</th>
              </tr>
            </thead>
            <tbody className="font-data-mono text-data-mono">
              {data?.interfaces.map((iface) => (
                <tr key={iface.name} className="border-b border-outline-variant/40">
                  <td className="py-2 pr-4 text-on-surface">{iface.name}</td>
                  <td className="py-2 pr-4 text-on-surface-variant">{iface.address ?? '—'}</td>
                  <td className="py-2 pr-4">
                    <span className={iface.up ? 'text-tertiary' : 'text-on-surface-variant'}>
                      {iface.up ? 'up' : 'down'}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right text-tertiary">{formatRate(iface.rxBytesPerSec)}</td>
                  <td className="py-2 pr-4 text-right text-primary">{formatRate(iface.txBytesPerSec)}</td>
                  <td className="py-2 pr-4 text-right text-on-surface-variant">{formatBytes(iface.rxBytes)}</td>
                  <td className="py-2 text-right text-on-surface-variant">{formatBytes(iface.txBytes)}</td>
                </tr>
              ))}
              {!data && (
                <tr>
                  <td colSpan={7} className="py-2 text-on-surface-variant">Loading…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  )
}
