import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { createMapCrs } from '../lib/mapTiles.js'
import './arranger.css'

const API = '/__regions'
const DEFAULT_GRID = { block: 4800, cell: 48, originX: 0, originY: 0 }
const SNAP_MODES = [
  { id: 'block', label: 'Block grid' },
  { id: 'cell', label: '48px cells' },
  { id: 'tile', label: '800px tiles' },
  { id: 'free', label: 'Free (1px)' },
]

function regionBounds({ x, y, width, height }) {
  return L.latLngBounds([y, x], [y + height, x + width])
}

function overlaps(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

function isBlockSized(item, grid) {
  return Math.abs(item.width - grid.block) <= 16 && Math.abs(item.height - grid.block) <= 16
}

function snapStep(mode, item, grid, tileSize) {
  if (mode === 'block' && isBlockSized(item, grid)) return grid.block
  if (mode === 'block' || mode === 'cell') return grid.cell
  if (mode === 'tile') return tileSize
  return 1
}

function snapValue(value, step, origin) {
  return Math.max(0, origin + Math.round((value - origin) / step) * step)
}

function mergeState({ layout, regions }) {
  const meta = new Map(regions.map((region) => [region.file, region]))
  const placed = layout.regions.filter((region) => meta.has(region.file)).map((region) => ({ ...meta.get(region.file), ...region, placed: true }))
  const placedFiles = new Set(placed.map((region) => region.file))
  const unplaced = regions.filter((region) => !placedFiles.has(region.file)).map((region) => ({ ...region, x: 0, y: 0, enabled: false, placed: false }))
  return [...placed, ...unplaced]
}

const shortName = (file) => file.replace(/\.png$/i, '')

export default function RegionArranger({ tileIndex }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const overlaysRef = useRef(new Map())
  const [tileSize, setTileSize] = useState(800)
  const [reference, setReference] = useState(null)
  const [grid, setGrid] = useState(DEFAULT_GRID)
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [snapMode, setSnapMode] = useState('block')
  const [opacity, setOpacity] = useState(0.85)
  const [showReference, setShowReference] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [reviewOnly, setReviewOnly] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState('Loading regions…')
  const [busy, setBusy] = useState(false)
  const itemsRef = useRef(items)
  itemsRef.current = items

  const snapPosition = useCallback((item, x, y) => {
    const step = snapStep(snapMode, item, grid, tileSize)
    const useOrigin = step === grid.block
    return { x: snapValue(x, step, useOrigin ? grid.originX : 0), y: snapValue(y, step, useOrigin ? grid.originY : 0) }
  }, [snapMode, grid, tileSize])

  const updateItem = useCallback((file, changes) => {
    setItems((current) => current.map((item) => (item.file === file ? { ...item, ...changes } : item)))
    setDirty(true)
  }, [])

  const moveItem = useCallback((file, position) => updateItem(file, { ...position, review: false }), [updateItem])

  useEffect(() => {
    fetch(`${API}/state`)
      .then((response) => response.json())
      .then((state) => {
        setTileSize(state.tileSize)
        setReference(state.hasReference ? state.layout.reference ?? null : null)
        setGrid({ ...DEFAULT_GRID, ...state.layout.grid })
        setItems(mergeState(state))
        setStatus(state.regions.length ? `${state.regions.length} regions loaded.` : 'No regions found. Run npm run regions:fetch first.')
      })
      .catch((error) => setStatus(`Could not load regions: ${error.message}`))
  }, [])

  useEffect(() => {
    const map = L.map(containerRef.current, {
      crs: createMapCrs(tileIndex),
      minZoom: -2,
      maxZoom: tileIndex.maxNativeZoom,
      zoomSnap: 0.25,
      zoomControl: false,
      attributionControl: false,
    })
    map.fitBounds(L.latLngBounds([0, 0], [tileIndex.height, tileIndex.width]))
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      overlaysRef.current.clear()
    }
  }, [tileIndex])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !reference || !showReference) return undefined
    const overlay = L.imageOverlay(`${API}/reference.webp`, [[0, 0], [reference.height, reference.width]], { opacity: 0.55 }).addTo(map)
    overlay.bringToBack()
    return () => overlay.remove()
  }, [reference, showReference])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !showGrid) return undefined
    const width = Math.max(tileIndex.width, reference?.width ?? 0) + grid.block
    const height = Math.max(tileIndex.height, reference?.height ?? 0) + grid.block
    const lines = []
    for (let x = grid.originX % grid.block; x <= width; x += grid.block) lines.push([[0, x], [height, x]])
    for (let y = grid.originY % grid.block; y <= height; y += grid.block) lines.push([[y, 0], [y, width]])
    const layer = L.polyline(lines, { color: '#76b7ff', weight: 1, opacity: 0.4, interactive: false }).addTo(map)
    return () => layer.remove()
  }, [showGrid, reference, tileIndex, grid])

  const startDrag = useCallback((file, event) => {
    const map = mapRef.current
    const item = itemsRef.current.find((candidate) => candidate.file === file)
    const overlay = overlaysRef.current.get(file)
    if (!map || !item || !overlay) return
    L.DomEvent.stop(event.originalEvent)
    setSelected(file)
    map.dragging.disable()
    const start = event.latlng
    let next = { x: item.x, y: item.y }
    const move = (moveEvent) => {
      next = snapPosition(item, item.x + moveEvent.latlng.lng - start.lng, item.y + moveEvent.latlng.lat - start.lat)
      overlay.setBounds(regionBounds({ ...item, ...next }))
    }
    const end = () => {
      map.off('mousemove', move)
      document.removeEventListener('mouseup', end)
      map.dragging.enable()
      if (next.x !== item.x || next.y !== item.y) moveItem(file, next)
    }
    map.on('mousemove', move)
    document.addEventListener('mouseup', end)
  }, [snapPosition, moveItem])
  const startDragRef = useRef(startDrag)
  startDragRef.current = startDrag

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const overlays = overlaysRef.current
    const visible = new Set()
    items.forEach((item) => {
      if (!item.placed) return
      visible.add(item.file)
      let overlay = overlays.get(item.file)
      if (!overlay) {
        overlay = L.imageOverlay(`${API}/preview/${encodeURIComponent(item.file)}`, regionBounds(item), { interactive: true, className: 'arranger-region' })
        overlay.on('mousedown', (event) => startDragRef.current(item.file, event))
        overlay.addTo(map)
        overlays.set(item.file, overlay)
      }
      overlay.setBounds(regionBounds(item))
      overlay.setOpacity(item.enabled ? opacity : opacity * 0.3)
      const element = overlay.getElement()
      element?.classList.toggle('selected', item.file === selected)
      element?.classList.toggle('disabled', !item.enabled)
      element?.classList.toggle('review', Boolean(item.review) && item.enabled)
      overlay.bringToFront()
    })
    overlays.forEach((overlay, file) => {
      if (visible.has(file)) return
      overlay.remove()
      overlays.delete(file)
    })
  }, [items, opacity, selected])

  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return
      if (event.key === 'Escape') setSelected(null)
      const item = itemsRef.current.find((candidate) => candidate.file === selected)
      const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
      if (!item?.placed || !direction) return
      event.preventDefault()
      const step = snapStep(snapMode, item, grid, tileSize) * (event.shiftKey ? 10 : 1)
      moveItem(item.file, { x: Math.max(0, item.x + direction[0] * step), y: Math.max(0, item.y + direction[1] * step) })
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selected, snapMode, grid, tileSize, moveItem])

  const overlapsByFile = useMemo(() => {
    const enabled = items.filter((item) => item.placed && item.enabled)
    return new Map(enabled.map((item) => [item.file, enabled.filter((other) => other !== item && overlaps(item, other)).map((other) => other.file)]))
  }, [items])

  const reviewCount = items.filter((item) => item.placed && item.enabled && item.review).length
  const listed = reviewOnly ? items.filter((item) => !item.placed || (item.enabled && (item.review || overlapsByFile.get(item.file)?.length))) : items

  const focusItem = (item) => {
    setSelected(item.file)
    if (item.placed) mapRef.current?.flyToBounds(regionBounds(item).pad(0.5), { duration: 0.5 })
  }

  const placeAtCenter = (item) => {
    const center = mapRef.current.getCenter()
    updateItem(item.file, { placed: true, enabled: true, review: false, ...snapPosition(item, center.lng - item.width / 2, center.lat - item.height / 2) })
    setSelected(item.file)
  }

  const bringToFront = (file) => {
    setItems((current) => [...current.filter((item) => item.file !== file), current.find((item) => item.file === file)])
    setDirty(true)
  }

  const save = async () => {
    const regions = items
      .filter((item) => item.placed)
      .map(({ file, x, y, enabled, review, matchScore, modified }) => ({ file, x, y, enabled, review: Boolean(review), matchScore, modified }))
    const response = await fetch(`${API}/layout`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reference, grid, regions }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error)
    setDirty(false)
  }

  const run = async (task, label) => {
    setBusy(true)
    setStatus(label)
    try {
      setStatus(await task())
    } catch (error) {
      setStatus(`Failed: ${error.message}`)
    } finally {
      setBusy(false)
    }
  }

  const saveLayout = () => run(async () => {
    await save()
    return 'Layout saved to map-source/layout.json.'
  }, 'Saving…')

  const applyLayout = () => run(async () => {
    await save()
    const response = await fetch(`${API}/apply`, { method: 'POST' })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error)
    return 'Map rebuilt from the layout. Open the map view to check it.'
  }, 'Saving and rebuilding tiles (a few minutes)…')

  return (
    <div className="arranger">
      <aside className="arranger-panel">
        <header>
          <span className="controls-eyebrow">Dev tool</span>
          <h2>Arrange regions</h2>
          <p className="arranger-hint">
            Drag a region to move it. Arrow keys nudge the selected region by one snap step (Shift: ×10).
            Orange outlines are guesses that need a look; moving a region marks it reviewed.
          </p>
        </header>
        <div className="arranger-options">
          <label>
            Snap
            <select value={snapMode} onChange={(event) => setSnapMode(event.target.value)}>
              {SNAP_MODES.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
            </select>
          </label>
          <label><input type="checkbox" checked={showReference} onChange={(event) => setShowReference(event.target.checked)} disabled={!reference} /> Old world map underneath</label>
          <label><input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} /> Block grid lines</label>
          <label><input type="checkbox" checked={reviewOnly} onChange={(event) => setReviewOnly(event.target.checked)} /> Only show regions needing review ({reviewCount})</label>
          <label>Region opacity <input type="range" min="0.2" max="1" step="0.05" value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} /></label>
        </div>
        <ul className="arranger-list">
          {listed.map((item) => {
            const clashes = overlapsByFile.get(item.file) ?? []
            return (
              <li key={item.file} className={item.file === selected ? 'selected' : ''}>
                <input type="checkbox" checked={item.enabled} disabled={!item.placed} onChange={(event) => updateItem(item.file, { enabled: event.target.checked })} aria-label={`Include ${item.file}`} />
                <button type="button" className="arranger-name" onClick={() => focusItem(item)}>
                  <strong>{shortName(item.file)}{item.review && item.enabled ? ' · review' : ''}</strong>
                  <span>
                    {item.placed ? `x ${item.x}, y ${item.y}` : 'not placed'}
                    {` · ${item.width}×${item.height}`}
                    {item.modified ? ` · ${item.modified}` : ''}
                    {item.matchScore != null ? ` · match ${item.matchScore}` : ''}
                  </span>
                  {clashes.length > 0 && <span className="arranger-warning">Overlaps {clashes.map(shortName).join(', ')}</span>}
                </button>
                {item.placed
                  ? <button type="button" className="secondary arranger-small" onClick={() => bringToFront(item.file)} title="Draw this region above overlapping ones">Top</button>
                  : <button type="button" className="secondary arranger-small" onClick={() => placeAtCenter(item)}>Place</button>}
              </li>
            )
          })}
        </ul>
        <footer className="arranger-actions">
          <div className="arranger-status" role="status" aria-live="polite">{dirty ? 'Unsaved changes. ' : ''}{status}</div>
          <button type="button" onClick={saveLayout} disabled={busy}>Save layout</button>
          <button type="button" onClick={applyLayout} disabled={busy}>Save &amp; rebuild map</button>
          <a className="arranger-link" href="/">Open map view</a>
        </footer>
      </aside>
      <div ref={containerRef} className="arranger-map" />
    </div>
  )
}
