interface AreaChartProps {
  /** Time-ordered samples (oldest first). */
  data: number[]
  /** Upper bound for the y-axis. Auto-scales to the max sample when omitted. */
  max?: number
  /** Tailwind stroke/fill color class, e.g. "text-primary". */
  colorClass?: string
  height?: number
  /** Optional unit suffix for the floating "latest value" readout. */
  unit?: string
  /** Format the latest-value readout. Overrides `unit`. */
  format?: (v: number) => string
}

const WIDTH = 100 // viewBox units; chart is responsive via preserveAspectRatio

/**
 * Lightweight filled line chart for telemetry history. Renders as a stretched
 * SVG path so it fills its container width; pure SVG, no dependency.
 */
export function AreaChart({
  data,
  max,
  colorClass = 'text-primary',
  height = 120,
  unit,
  format
}: AreaChartProps): JSX.Element {
  const ceiling = max ?? Math.max(1, ...data)
  const n = data.length
  const latest = n ? data[n - 1] : 0

  const points = data.map((v, i) => {
    const x = n <= 1 ? 0 : (i / (n - 1)) * WIDTH
    const y = 100 - Math.max(0, Math.min(100, (v / ceiling) * 100))
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })

  const linePath = points.length ? `M ${points.join(' L ')}` : ''
  const areaPath = points.length ? `${linePath} L ${WIDTH},100 L 0,100 Z` : ''
  const readout = format ? format(latest) : `${latest.toFixed(1)}${unit ?? ''}`

  return (
    <div className={`relative w-full ${colorClass}`} style={{ height }}>
      <svg
        className="h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {areaPath && <path d={areaPath} fill="currentColor" fillOpacity={0.12} />}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {n > 0 && (
        <span className="absolute right-1 top-1 font-data-mono text-data-mono text-on-surface">
          {readout}
        </span>
      )}
    </div>
  )
}
