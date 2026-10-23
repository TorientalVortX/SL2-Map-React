import React, { useEffect, useMemo, useRef, useState } from 'react'

const IDLE_STATE = { running: false, completed: 0, total: 0, failed: 0, error: '' }
const FOCUSABLE_SELECTOR = 'button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])'

export default function OfflineModal({ onClose }) {
  const [manifest, setManifest] = useState(null)
  const [cacheCurrent, setCacheCurrent] = useState(false)
  const [preloadState, setPreloadState] = useState(IDLE_STATE)
  const confirmedRef = useRef(false)
  const modalRef = useRef(null)
  const preloadRunningRef = useRef(false)
  preloadRunningRef.current = preloadState.running

  useEffect(() => {
    const controller = new AbortController()
    fetch('/cache-manifest.json', { cache: 'no-cache', signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      })
      .then((nextManifest) => {
        setManifest(nextManifest)
        setCacheCurrent(localStorage.getItem('sl2-cache-version') === nextManifest.version)
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setPreloadState((state) => ({ ...state, error: 'Offline download details are unavailable. The online map is unaffected.' }))
        }
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined
    const handler = (evt) => {
      const msg = evt.data || {}
      if (msg.type === 'PRECACHE_START') {
        setPreloadState({ ...IDLE_STATE, running: true, total: msg.total || 0 })
      } else if (msg.type === 'PRECACHE_PROGRESS') {
        setPreloadState((s) => ({ ...s, running: true, completed: msg.completed ?? s.completed, total: msg.total ?? s.total, failed: msg.failed ?? s.failed }))
      } else if (msg.type === 'PRECACHE_DONE') {
        const failed = msg.failed || 0
        setPreloadState((s) => ({ ...s, running: false, completed: msg.completed ?? s.total, failed, error: failed ? `${failed} files could not be cached. You can retry.` : '' }))
        if (manifest && failed === 0 && !confirmedRef.current) {
          confirmedRef.current = true
          localStorage.setItem('sl2-cache-version', manifest.version)
          setCacheCurrent(true)
          onClose()
        }
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [manifest, onClose])

  const totalMB = useMemo(() => (manifest ? (manifest.totalBytes / (1024 * 1024)).toFixed(1) : '0.0'), [manifest])

  const startPreload = async () => {
    if (!manifest) return
    if (!('serviceWorker' in navigator)) {
      setPreloadState((s) => ({ ...s, error: 'Offline caching is not supported by this browser.' }))
      return
    }
    confirmedRef.current = false
    setPreloadState({ ...IDLE_STATE, running: true, total: manifest.tiles.length })
    try {
      const reg = await navigator.serviceWorker.ready
      if (!reg.active) throw new Error('Service worker is not active')
      reg.active.postMessage({ type: 'PRECACHE_TILES', urls: manifest.tiles.map((tile) => tile.url), version: manifest.version, concurrency: 4 })
    } catch {
      setPreloadState((s) => ({ ...s, running: false, error: 'Offline preload could not start. The map remains available online.' }))
    }
  }

  useEffect(() => {
    const returnFocus = document.activeElement
    const modal = modalRef.current
    const getFocusable = () => Array.from(modal?.querySelectorAll(FOCUSABLE_SELECTOR) || [])
    getFocusable()[0]?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !preloadRunningRef.current) {
        event.preventDefault()
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = getFocusable()
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus()
    }
  }, [onClose])

  useEffect(() => {
    if (preloadState.running) modalRef.current?.focus({ preventScroll: true })
  }, [preloadState.running])

  return (
    <div className="modal-overlay" role="presentation">
      <div ref={modalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="preloadTitle" aria-describedby={preloadState.running ? undefined : 'preloadDescription'} aria-busy={preloadState.running} tabIndex="-1">
        <h2 id="preloadTitle">Preload Map for Offline/Low-Data</h2>
        {manifest && !preloadState.running && (
          <p id="preloadDescription">{cacheCurrent ? 'This map version is already cached. ' : ''}Downloading will store approximately <b>{totalMB} MB</b> ({manifest.totalFiles} files) on this device.</p>
        )}
        {!manifest && <p id="preloadDescription">Preparing the offline download details…</p>}
        {preloadState.error && <p className="error-message" role="alert">{preloadState.error}</p>}
        {!preloadState.running ? (
          <div className="modal-actions">
            <button onClick={startPreload} disabled={!manifest}>Download for Offline Use</button>
            <button className="secondary" onClick={onClose}>Close</button>
          </div>
        ) : (
          <div className="preload-progress">
            <div className="spinner" aria-hidden="true"></div>
            <div className="progress-copy">
              <div className="progress-text" role="status" aria-live="polite">
                Caching {preloadState.completed} / {preloadState.total}
              </div>
              <progress value={preloadState.completed} max={Math.max(1, preloadState.total)} aria-label="Offline map download progress" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
