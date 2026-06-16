/** Human-readable byte size (binary units). */
export function formatBytes(bytes: number, fractionDigits = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** i
  return `${value.toFixed(i === 0 ? 0 : fractionDigits)} ${units[i]}`
}

/** Throughput, e.g. "12.4 MB/s". */
export function formatRate(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`
}

/** Compact GB string used in rings, e.g. "26.2 GB". */
export function formatGiB(bytes: number, fractionDigits = 1): string {
  return `${(bytes / 1024 ** 3).toFixed(fractionDigits)} GB`
}

/** Uptime as "14d 6h 32m". */
export function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return `${d}d ${h}h ${m}m`
}

/** Percent rounded to a whole number with a trailing %. */
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

/** Frequency in MHz rendered as GHz when large enough. */
export function formatFreq(mhz: number): string {
  if (mhz <= 0) return '—'
  return mhz >= 1000 ? `${(mhz / 1000).toFixed(2)} GHz` : `${Math.round(mhz)} MHz`
}
