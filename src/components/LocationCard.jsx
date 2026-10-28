import { useEffect, useRef, useState } from 'react'

export default function LocationCard({ location, onClose, getShareUrl }) {
  const headingRef = useRef(null)
  const [copyStatus, setCopyStatus] = useState('')
  const lastLocationRef = useRef(location)
  if (location) lastLocationRef.current = location
  const shown = lastLocationRef.current

  useEffect(() => {
    setCopyStatus('')
    if (location) headingRef.current?.focus({ preventScroll: true })
  }, [location])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl(shown))
      setCopyStatus('Link copied')
    } catch {
      setCopyStatus('Copy failed')
    }
  }

  return (
    <section id="locationInfo" className={location ? '' : 'hidden'} role="region" aria-labelledby="locationName" aria-hidden={!location}>
      {shown && (
        <div id="locationContent">
          <button id="closeInfo" aria-label="Close location details" onClick={onClose}>&times;</button>
          <span className={`location-type type-${shown.type}`}>{shown.type}</span>
          <h3 id="locationName" ref={headingRef} tabIndex="-1">{shown.name}</h3>
          <p id="locationDescription" className={shown.description ? '' : 'muted'}>
            {shown.description || 'No description yet.'}
          </p>
          <div className="location-actions">
            <button className="secondary" onClick={copyLink}>Copy link</button>
            <span className="copy-status" role="status" aria-live="polite">{copyStatus}</span>
          </div>
        </div>
      )}
    </section>
  )
}
