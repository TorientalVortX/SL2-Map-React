import { useState } from 'react'
import { useUpdateAvailable } from '../lib/useUpdateAvailable.js'

export default function UpdateBanner() {
  const available = useUpdateAvailable()
  const [dismissed, setDismissed] = useState(false)
  if (!available || dismissed) return null

  return (
    <div className="update-banner" role="status">
      <span>A new version of the map is available.</span>
      <button onClick={() => location.reload()}>Reload</button>
      <button className="secondary" aria-label="Dismiss update notice" onClick={() => setDismissed(true)}>Later</button>
    </div>
  )
}
