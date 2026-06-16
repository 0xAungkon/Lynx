interface RingProps {
  /** 0–100. */
  percent: number
  /** Large centered text (e.g. "65%"). */
  label: string
  /** Small text under the label (e.g. "3.8 GHz"). */
  sublabel?: string
  /** Tailwind stroke-* class for the progress arc, e.g. "stroke-primary". */
  colorClass?: string
  /** Tailwind text-* class for the sublabel, matched to the arc by default. */
  sublabelClass?: string
  size?: number
}

/**
 * Circular progress ring matching the mockups' SVG arc (viewBox 0 0 36 36,
 * stroke-dasharray "<pct>, 100"). Pure SVG, no chart dependency.
 */
export function Ring({
  percent,
  label,
  sublabel,
  colorClass = 'stroke-primary',
  sublabelClass = 'text-primary',
  size = 128
}: RingProps): JSX.Element {
  const pct = Math.max(0, Math.min(100, percent))
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
        <path
          className="fill-none stroke-surface-container-high"
          strokeWidth={3.8}
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
        />
        <path
          className={`fill-none ${colorClass} transition-[stroke-dasharray] duration-500`}
          strokeWidth={2.8}
          strokeLinecap="round"
          strokeDasharray={`${pct}, 100`}
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-headline-md text-headline-md text-on-surface">{label}</span>
        {sublabel && (
          <span className={`font-data-mono text-data-mono ${sublabelClass} text-center leading-tight`}>
            {sublabel}
          </span>
        )}
      </div>
    </div>
  )
}
