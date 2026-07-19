import React, { useEffect, useMemo, useRef, useState } from 'react'
import GameMap from './lib/GameMap.js'

export default function App() {
  const [showPreloadModal, setShowPreloadModal] = useState(false)
  const [manifest, setManifest] = useState(null)
  const [cacheCurrent, setCacheCurrent] = useState(false)
  const [preloadState, setPreloadState] = useState({ running: false, completed: 0, total: 0, failed: 0, error: '' })
  const confirmedRef = useRef(false)
  const manifestAbortRef = useRef(null)
  const modalRef = useRef(null)
  const preloadRunningRef = useRef(false)
  preloadRunningRef.current = preloadState.running

  const loadManifest = async () => {
    if (manifest) return manifest
    manifestAbortRef.current?.abort()
    const controller = new AbortController()
    manifestAbortRef.current = controller
    try {
      const response = await fetch('/cache-manifest.json', { cache: 'no-cache', signal: controller.signal })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const nextManifest = await response.json()
      setManifest(nextManifest)
      setCacheCurrent(localStorage.getItem('sl2-cache-version') === nextManifest.version)
      return nextManifest
    } catch (error) {
      if (error.name !== 'AbortError') {
        setPreloadState((state) => ({ ...state, error: 'Offline download details are unavailable. The online map is unaffected.' }))
      }
      return null
    }
  }

  const openPreload = () => {
    setShowPreloadModal(true)
    void loadManifest()
  }

  useEffect(() => {
    const map = new GameMap()
    window.gameMap = map
    return () => {
      map.destroy()
      manifestAbortRef.current?.abort()
      if (window.gameMap === map) delete window.gameMap
    }
  }, [])

  useEffect(() => {
    if (new URLSearchParams(location.search).get('preload') === '1') openPreload()
  }, [])

  // Listen to SW progress events
  useEffect(() => {
    if (!showPreloadModal) return
    if (!('serviceWorker' in navigator)) return
    const handler = (evt) => {
      const msg = evt.data || {}
      if (msg.type === 'PRECACHE_START') {
        setPreloadState({ running: true, completed: 0, total: msg.total || 0, failed: 0, error: '' })
      } else if (msg.type === 'PRECACHE_PROGRESS') {
        setPreloadState((s) => ({ ...s, running: true, completed: msg.completed ?? s.completed, total: msg.total ?? s.total, failed: msg.failed ?? s.failed }))
      } else if (msg.type === 'PRECACHE_DONE') {
        const failed = msg.failed || 0
        setPreloadState((s) => ({ ...s, running: false, completed: msg.completed ?? s.total, failed, error: failed ? `${failed} files could not be cached. You can retry.` : '' }))
        if (manifest && failed === 0 && !confirmedRef.current) {
          confirmedRef.current = true
          localStorage.setItem('sl2-cache-version', manifest.version)
          setCacheCurrent(true)
          setShowPreloadModal(false)
        }
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [showPreloadModal, manifest])

  const totalMB = useMemo(() => manifest ? (manifest.totalBytes / (1024 * 1024)).toFixed(2) : '0.00', [manifest])

  const startPreload = async () => {
    if (!manifest) return
    if (!('serviceWorker' in navigator)) {
      setPreloadState((s) => ({ ...s, error: 'Offline caching is not supported by this browser.' }))
      return
    }
    confirmedRef.current = false
    setPreloadState({ running: true, completed: 0, total: manifest.tiles.length + manifest.worldMaps.length + manifest.others.length, failed: 0, error: '' })
    const urls = [...manifest.worldMaps, ...manifest.tiles, ...manifest.others].map(e => e.url)
    try {
      const reg = await navigator.serviceWorker.ready
      if (reg.active) {
        reg.active.postMessage({ type: 'PRECACHE_TILES', urls, version: manifest.version, concurrency: 4 })
      } else {
        throw new Error('Service worker is not active')
      }
    } catch {
      setPreloadState((s) => ({ ...s, running: false, error: 'Offline preload could not start. The map remains available online.' }))
    }
  }

  const skipPreload = () => {
    setShowPreloadModal(false)
    setPreloadState({ running: false, completed: 0, total: 0, failed: 0, error: '' })
  }

  useEffect(() => {
    if (!showPreloadModal) return undefined
    const returnFocus = document.activeElement
    const modal = modalRef.current
    const focusableSelector = 'button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])'
    const getFocusable = () => Array.from(modal?.querySelectorAll(focusableSelector) || [])
    getFocusable()[0]?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !preloadRunningRef.current) {
        event.preventDefault()
        skipPreload()
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

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus()
    }
  }, [showPreloadModal])

  useEffect(() => {
    if (showPreloadModal && preloadState.running) modalRef.current?.focus({ preventScroll: true })
  }, [showPreloadModal, preloadState.running])

  return (
    <div id="mapContainer">
      {showPreloadModal && (
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
                <button className="secondary" onClick={skipPreload}>Close</button>
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
      )}
      <button id="toggleControls" className="toggle-btn" aria-label="Open map controls" aria-expanded="false" aria-controls="mapControls">
        <span className="hamburger-icon">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>

      <aside id="mapControls" className="controls-panel" aria-label="Map tools">
        <div className="controls-heading">
          <div>
            <span className="controls-eyebrow">SL2 world map</span>
            <h2>Explore</h2>
          </div>
          <span className="shortcut-badge" aria-hidden="true">H</span>
        </div>
        <div className="control-group search-group">
          <label className="visually-hidden" htmlFor="searchInput">Search locations</label>
          <input type="text" id="searchInput" placeholder="Search locations..." />
          <button id="searchBtn" className="search-btn" aria-label="Search">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
          </button>
        </div>
        <div id="searchStatus" className="search-status" role="status" aria-live="polite"></div>
        <div className="control-group offline-group">
          <div className="offline-copy">
            <strong>Offline access</strong>
            <span>Save the full map only when you choose.</span>
          </div>
          <button id="preloadAll" className="offline-btn" onClick={openPreload}>Manage</button>
        </div>
        <details className="keyboard-help">
          <summary>Keyboard help</summary>
          <div id="keyboardHelpText" className="shortcut-grid">
            <span>Pan</span><kbd>Arrow keys</kbd>
            <span>Zoom</span><kbd>+ / −</kbd>
            <span>Reset</span><kbd>0</kbd>
            <span>Tools</span><kbd>H or Space</kbd>
            <span>Close</span><kbd>Esc</kbd>
          </div>
        </details>
        {import.meta.env.DEV && <div className="control-group debug-group">
          <button id="debugWorldMap" className="debug-btn">Debug WM</button>
          <button id="toggleDebug" className="debug-mode-btn">Debug Mode</button>
        </div>}
      </aside>

      <div className="view-controls" aria-label="Map view controls">
          <button id="zoomIn" className="zoom-btn" aria-label="Zoom in">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
          </button>
          <button id="zoomOut" className="zoom-btn" aria-label="Zoom out">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M19 13H5v-2h14v2z"/>
            </svg>
          </button>
          <button id="resetView" className="reset-btn" aria-label="Reset view">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
            </svg>
          </button>
      </div>

      <div id="mapCanvas" role="application" aria-label="Interactive SL2 world map" aria-describedby="keyboardHelpText" aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight + - 0" tabIndex="0">
        <div id="mapGrid"></div>
        <div id="pinLayer"></div>
      </div>

      <div id="loadingIndicator" role="status" aria-live="polite">Loading...</div>

      <section id="locationInfo" className="hidden" role="region" aria-labelledby="locationName" aria-hidden="true">
        <div id="locationContent">
          <button id="closeInfo" aria-label="Close location details">&times;</button>
          <h3 id="locationName" tabIndex="-1"></h3>
          <p id="locationDescription"></p>
        </div>
      </section>
    </div>
  )
}
