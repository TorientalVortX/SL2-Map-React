import { useEffect, useState } from 'react'

const CHECK_INTERVAL_MS = 10 * 60 * 1000

export function useUpdateAvailable() {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    if (!import.meta.env.PROD || available) return undefined
    let cancelled = false

    const check = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const response = await fetch('/version.json', { cache: 'no-store' })
        if (!response.ok) return
        const { buildId } = await response.json()
        if (!cancelled && buildId && buildId !== __BUILD_ID__) setAvailable(true)
      } catch {}
    }

    const interval = setInterval(check, CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', check)
    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', check)
    }
  }, [available])

  return available
}
