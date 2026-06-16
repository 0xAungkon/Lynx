interface ProgressBarProps {
  /** 0–100. */
  percent: number
  /** Tailwind bg-* class for the filled portion. */
  colorClass?: string
  className?: string
}

/** Thin Material 3 linear progress track, matching the mockups' usage bars. */
export function ProgressBar({
  percent,
  colorClass = 'bg-primary',
  className = ''
}: ProgressBarProps): JSX.Element {
  const pct = Math.max(0, Math.min(100, percent))
  return (
    <div className={`h-2 w-full rounded-full bg-surface-bright ${className}`}>
      <div
        className={`h-2 rounded-full ${colorClass} transition-[width] duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
