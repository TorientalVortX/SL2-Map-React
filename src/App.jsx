import React, { useEffect, useMemo, useRef, useState } from 'react'

// We'll instantiate GameMap on mount once we add it
let GameMapClass

export default function App() {
  const [readyForMap, setReadyForMap] = useState(false)
  const [showPreloadModal, setShowPreloadModal] = useState(false)
  const [manifest, setManifest] = useState(null)
  const [preloadState, setPreloadState] = useState({ running: false, completed: 0, total: 0 })
  const confirmedRef = useRef(false)

  // Instantiate GameMap only when ready
  useEffect(() => {
    if (!readyForMap) return
    (async () => {
      if (!GameMapClass) {
        const mod = await import('./lib/GameMap.js')
        GameMapClass = mod.default || mod.GameMap || mod
      }
      window.gameMap = new GameMapClass()
    })()
  }, [readyForMap])

  // Check manifest and cache version on first mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/cache-manifest.json', { cache: 'no-cache' })
        if (!res.ok) {
          setReadyForMap(true) // no manifest; proceed normally
          return
        }
        const man = await res.json()
        setManifest(man)
        const stored = localStorage.getItem('sl2-cache-version')
        const preloadParam = new URLSearchParams(location.search).get('preload')
        if (preloadParam === '1') {
          setShowPreloadModal(true)
          return
        }
        if (stored === man.version) {
          setReadyForMap(true)
          return
        }
        // Show prompt to preload
        setShowPreloadModal(true)
      } catch (e) {
        setReadyForMap(true)
      }
    })()
  }, [])

  // Listen to SW progress events
  useEffect(() => {
    if (!showPreloadModal) return
    if (!('serviceWorker' in navigator)) return
    const handler = (evt) => {
      const msg = evt.data || {}
      if (msg.type === 'PRECACHE_START') {
        setPreloadState({ running: true, completed: 0, total: msg.total || 0 })
      } else if (msg.type === 'PRECACHE_PROGRESS') {
        setPreloadState((s) => ({ running: true, completed: msg.completed || s.completed, total: msg.total || s.total }))
      } else if (msg.type === 'PRECACHE_DONE') {
        setPreloadState((s) => ({ ...s, completed: s.total }))
        if (manifest && !confirmedRef.current) {
          // ensure finalization only once
          confirmedRef.current = true
          localStorage.setItem('sl2-cache-version', manifest.version)
          setTimeout(() => {
            setShowPreloadModal(false)
            setReadyForMap(true)
          }, 300)
        }
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [showPreloadModal, manifest])

  const totalMB = useMemo(() => manifest ? (manifest.totalBytes / (1024 * 1024)).toFixed(2) : '0.00', [manifest])

  const startPreload = async () => {
    if (!manifest) return
    confirmedRef.current = false
    setPreloadState({ running: true, completed: 0, total: manifest.tiles.length + manifest.worldMaps.length + manifest.others.length })
    const urls = [...manifest.worldMaps, ...manifest.tiles, ...manifest.others].map(e => e.url)
    try {
      const reg = await navigator.serviceWorker.ready
      if (reg.active) {
        reg.active.postMessage({ type: 'PRECACHE_TILES', urls, limit: urls.length, concurrency: 8 })
      }
    } catch {}
  }

  const skipPreload = () => {
    setShowPreloadModal(false)
    setReadyForMap(true)
  }

  return (
    <div id="mapContainer">
      {showPreloadModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Preload Map for Offline/Low-Data</h2>
            {manifest && !preloadState.running && (
              <p>This will cache approximately <b>{totalMB} MB</b> ({manifest.totalFiles} files) for faster future visits. Proceed?</p>
            )}
            {!preloadState.running ? (
              <div className="modal-actions">
                <button onClick={startPreload}>Preload Now</button>
                <button className="secondary" onClick={skipPreload}>Skip</button>
              </div>
            ) : (
              <div className="preload-progress">
                <div className="spinner" aria-hidden="true"></div>
                <div className="progress-text">
                  Caching {preloadState.completed} / {preloadState.total}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <button id="toggleControls" className="toggle-btn">
        <span className="hamburger-icon">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>

      <div id="mapControls" className="controls-panel">
        <div className="control-group search-group">
          <input type="text" id="searchInput" placeholder="Search locations..." />
          <button id="searchBtn" className="search-btn" aria-label="Search">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
          </button>
        </div>
        <div className="control-group zoom-group">
          <button id="zoomIn" className="zoom-btn" aria-label="Zoom In">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
          </button>
          <button id="zoomOut" className="zoom-btn" aria-label="Zoom Out">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M19 13H5v-2h14v2z"/>
            </svg>
          </button>
          <button id="resetView" className="reset-btn" aria-label="Reset View">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
            </svg>
          </button>
        </div>
        <div className="control-group debug-group">
          <button id="debugWorldMap" className="debug-btn">Debug WM</button>
          <button id="toggleDebug" className="debug-mode-btn">Debug Mode</button>
          <button id="preloadAll" className="debug-btn" onClick={() => setShowPreloadModal(true)}>Preload Map</button>
        </div>
      </div>

      <div id="mapCanvas">
        <div id="mapGrid"></div>
        <div id="pinLayer"></div>
      </div>

      <div id="loadingIndicator">Loading...</div>

      <div id="locationInfo" className="hidden">
        <div id="locationContent">
          <button id="closeInfo">&times;</button>
          <h3 id="locationName"></h3>
          <p id="locationDescription"></p>
        </div>
      </div>
    </div>
  )
}
