import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MapView from './components/MapView.jsx'
import ControlsPanel from './components/ControlsPanel.jsx'
import LocationCard from './components/LocationCard.jsx'
import OfflineModal from './components/OfflineModal.jsx'
import { formatViewHash, parseViewHash } from './lib/viewHash.js'
import { searchLocations } from './lib/searchLocations.js'
import tileIndex from './generated/tile-index.json'
import allLocations from './data/locations.json'

const PAN_STEP = 80
const TYPES = [...new Set(allLocations.map((location) => location.type))].sort()

function isTypingTarget(element) {
  return element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)
}

export default function App() {
  const initialHash = useMemo(() => parseViewHash(location.hash), [])
  const [panelOpen, setPanelOpen] = useState(false)
  const [offlineOpen, setOfflineOpen] = useState(() => new URLSearchParams(location.search).get('preload') === '1')
  const [query, setQuery] = useState('')
  const [activeTypes, setActiveTypes] = useState(() => new Set(TYPES))
  const [selectedId, setSelectedId] = useState(initialHash.locationId)
  const [loading, setLoading] = useState(false)
  const mapRef = useRef(null)
  const searchInputRef = useRef(null)
  const toggleButtonRef = useRef(null)
  const viewRef = useRef(initialHash.view)
  const cardReturnFocusRef = useRef(null)
  const focusSearchOnOpenRef = useRef(false)

  const visibleLocations = useMemo(() => allLocations.filter((location) => activeTypes.has(location.type)), [activeTypes])
  const results = useMemo(() => searchLocations(allLocations, query), [query])
  const selectedLocation = allLocations.find((location) => String(location.id) === String(selectedId)) ?? null

  const writeHash = useCallback((view, locationId) => {
    if (view) history.replaceState(null, '', formatViewHash(view, locationId))
  }, [])

  const handleViewChange = useCallback((view) => {
    viewRef.current = view
    writeHash(view, selectedId)
  }, [selectedId, writeHash])

  useEffect(() => {
    writeHash(viewRef.current, selectedId)
  }, [selectedId, writeHash])

  useEffect(() => {
    if (initialHash.locationId && !initialHash.view && selectedLocation) mapRef.current?.flyToLocation(selectedLocation)
  }, [])

  useEffect(() => {
    const handleHashChange = () => {
      const { view, locationId } = parseViewHash(location.hash)
      if (view) mapRef.current?.setView(view)
      setSelectedId(locationId)
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const selectLocation = useCallback((location) => {
    if (!selectedId) cardReturnFocusRef.current = document.activeElement
    setSelectedId(String(location.id))
  }, [selectedId])

  const closeLocation = useCallback(() => {
    setSelectedId(null)
    const returnTo = cardReturnFocusRef.current
    cardReturnFocusRef.current = null
    if (returnTo?.isConnected && returnTo.offsetParent !== null) returnTo.focus({ preventScroll: true })
  }, [])

  const pickResult = (location) => {
    mapRef.current?.flyToLocation(location)
    selectLocation(location)
  }

  const togglePanel = useCallback((focusSearch = false) => {
    if (panelOpen && document.getElementById('mapControls')?.contains(document.activeElement)) toggleButtonRef.current?.focus()
    focusSearchOnOpenRef.current = !panelOpen && focusSearch
    setPanelOpen(!panelOpen)
  }, [panelOpen])

  useEffect(() => {
    if (!panelOpen || !focusSearchOnOpenRef.current) return
    focusSearchOnOpenRef.current = false
    searchInputRef.current?.focus({ preventScroll: true })
  }, [panelOpen])

  const toggleType = (type) => {
    setActiveTypes((current) => {
      const next = new Set(current)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const getShareUrl = useCallback((location) => {
    const zoom = mapRef.current?.getZoom() ?? tileIndex.maxNativeZoom
    return `${window.location.origin}${window.location.pathname}${formatViewHash({ x: location.x, y: location.y, z: zoom }, location.id)}`
  }, [])

  const closeOffline = useCallback(() => setOfflineOpen(false), [])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (panelOpen) togglePanel()
        if (selectedId) closeLocation()
        return
      }
      if (offlineOpen || isTypingTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return
      const onButton = event.target.tagName === 'BUTTON' || event.target.getAttribute?.('role') === 'button'
      const insideMap = mapRef.current?.contains(event.target)
      const map = mapRef.current
      switch (event.key) {
        case 'h':
        case 'H':
          event.preventDefault()
          togglePanel(true)
          break
        case ' ':
          if (onButton) return
          event.preventDefault()
          togglePanel(true)
          break
        case '0':
          event.preventDefault()
          map?.resetView()
          break
        case '+':
        case '=':
          if (insideMap) return
          event.preventDefault()
          map?.zoomIn()
          break
        case '-':
          if (insideMap) return
          event.preventDefault()
          map?.zoomOut()
          break
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown': {
          if (insideMap || onButton) return
          event.preventDefault()
          const step = event.shiftKey ? PAN_STEP * 3 : PAN_STEP
          const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
          const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0
          map?.panBy(dx, dy)
          break
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [panelOpen, selectedId, offlineOpen, togglePanel, closeLocation])

  return (
    <div id="mapContainer" className={panelOpen ? 'controls-open' : ''}>
      {offlineOpen && <OfflineModal onClose={closeOffline} />}
      <button
        ref={toggleButtonRef}
        id="toggleControls"
        className={`toggle-btn${panelOpen ? ' active' : ''}`}
        aria-label={panelOpen ? 'Close map controls' : 'Open map controls'}
        aria-expanded={panelOpen}
        aria-controls="mapControls"
        onClick={(event) => togglePanel(event.detail === 0)}
      >
        <span className="hamburger-icon">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>

      <ControlsPanel
        ref={searchInputRef}
        open={panelOpen}
        query={query}
        onQueryChange={setQuery}
        results={results}
        onPickResult={pickResult}
        types={TYPES}
        activeTypes={activeTypes}
        onToggleType={toggleType}
        onOpenOffline={() => setOfflineOpen(true)}
      />

      <div className="view-controls" aria-label="Map view controls">
        <button className="zoom-btn" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
        </button>
        <button className="zoom-btn" aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M19 13H5v-2h14v2z"/>
          </svg>
        </button>
        <button className="reset-btn" aria-label="Reset view" onClick={() => mapRef.current?.resetView()}>
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
          </svg>
        </button>
      </div>

      <MapView
        ref={mapRef}
        tileIndex={tileIndex}
        locations={visibleLocations}
        selectedId={selectedId}
        initialView={initialHash.view}
        onSelectLocation={selectLocation}
        onViewChange={handleViewChange}
        onLoadingChange={setLoading}
      />

      <div id="loadingIndicator" className={loading ? 'visible' : ''} role="status" aria-live="polite">
        {loading ? 'Loading map…' : ''}
      </div>

      <LocationCard location={selectedLocation} onClose={closeLocation} getShareUrl={getShareUrl} />
    </div>
  )
}
