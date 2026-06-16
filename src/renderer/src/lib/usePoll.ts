import { useEffect, useRef, useState } from 'react'

export interface PollState<T> {
  data: T | null
  error: string | null
  /** True only before the first successful response. */
  loading: boolean
}

/**
 * Poll an async source on a fixed interval. The fetcher is called immediately
 * on mount and then every `intervalMs`. Overlapping calls are prevented; if a
 * fetch is still in flight when the timer fires, that tick is skipped.
 */
export function usePoll<T>(fetcher: () => Promise<T>, intervalMs = 1000): PollState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    let active = true
    let inFlight = false

    const tick = async (): Promise<void> => {
      if (inFlight) return
      inFlight = true
      try {
        const result = await fetcherRef.current()
        if (!active) return
        setData(result)
        setError(null)
      } catch (e) {
        if (!active) return
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        inFlight = false
        if (active) setLoading(false)
      }
    }

    void tick()
    const id = setInterval(() => void tick(), intervalMs)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [intervalMs])

  return { data, error, loading }
}

/**
 * Maintain a rolling history of the latest value for time-series charts.
 * Returns the most recent `size` samples (oldest first).
 */
export function useHistory<T>(value: T | null | undefined, size = 60): T[] {
  const [history, setHistory] = useState<T[]>([])
  useEffect(() => {
    if (value === null || value === undefined) return
    setHistory((prev) => {
      const next = [...prev, value]
      return next.length > size ? next.slice(next.length - size) : next
    })
  }, [value, size])
  return history
}
