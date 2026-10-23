import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import L from 'leaflet'
import { createMapCrs, createMapTileLayer, getContentBounds } from '../lib/mapTiles.js'
import { formatViewHash } from '../lib/viewHash.js'

const FOCUS_ZOOM_OFFSET = 0.5
const PIN_ICON_SIZE = [32, 32]
const PIN_ICON_ANCHOR = [16, 39]

function toView(map) {
  const center = map.getCenter()
  return { x: center.lng, y: center.lat, z: map.getZoom() }
}

function createPinIcon(type) {
  return L.divIcon({
    className: 'map-marker',
    html: `<span class="map-pin type-${type}"></span>`,
    iconSize: PIN_ICON_SIZE,
    iconAnchor: PIN_ICON_ANCHOR,
  })
}

function buildPointPopup(point, zoom) {
  const container = document.createElement('div')
  container.className = 'point-popup'
  const coords = document.createElement('div')
  coords.className = 'point-coords'
  coords.textContent = `${point.x}, ${point.y}`
  const copy = document.createElement('button')
  copy.type = 'button'
  copy.textContent = 'Copy link to this spot'
  copy.addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}${formatViewHash({ ...point, z: zoom })}`
    try {
      await navigator.clipboard.writeText(url)
      copy.textContent = 'Link copied'
    } catch {
      copy.textContent = 'Copy failed'
    }
  })
  container.append(coords, copy)
  if (import.meta.env.DEV) {
    const template = document.createElement('textarea')
    template.readOnly = true
    template.className = 'location-template'
    template.value = JSON.stringify({ id: Date.now(), name: 'New Location', x: point.x, y: point.y, type: 'landmark', description: '' })
    template.addEventListener('focus', () => template.select())
    container.append(template)
  }
  return container
}

const MapView = forwardRef(function MapView({ tileIndex, locations, selectedId, initialView, onSelectLocation, onViewChange, onLoadingChange }, ref) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef(new Map())
  const callbacksRef = useRef({})
  callbacksRef.current = { onSelectLocation, onViewChange, onLoadingChange }

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn(),
    zoomOut: () => mapRef.current?.zoomOut(),
    panBy: (x, y) => mapRef.current?.panBy([x, y]),
    resetView: () => mapRef.current?.flyToBounds(getContentBounds(tileIndex), { duration: 0.8 }),
    setView: ({ x, y, z }) => mapRef.current?.setView([y, x], z),
    flyToLocation: (location) => {
      const map = mapRef.current
      if (!map) return
      const zoom = Math.max(map.getZoom(), tileIndex.maxNativeZoom - FOCUS_ZOOM_OFFSET)
      map.flyTo([location.y, location.x], zoom, { duration: 0.9 })
    },
    getZoom: () => mapRef.current?.getZoom() ?? tileIndex.maxNativeZoom,
    contains: (element) => containerRef.current?.contains(element) ?? false,
  }), [tileIndex])

  useEffect(() => {
    const bounds = getContentBounds(tileIndex)
    const map = L.map(containerRef.current, {
      crs: createMapCrs(tileIndex),
      maxZoom: tileIndex.maxNativeZoom + 2,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 90,
      maxBounds: bounds.pad(0.25),
      maxBoundsViscosity: 0.8,
      zoomControl: false,
      attributionControl: false,
      keyboardPanDelta: 120,
    })
    mapRef.current = map
    map.getContainer().setAttribute('aria-label', 'Interactive SL2 world map')
    map.getContainer().setAttribute('aria-describedby', 'keyboardHelpText')

    const updateMinZoom = () => map.setMinZoom(map.getBoundsZoom(bounds) - 0.5)
    updateMinZoom()
    if (initialView) map.setView([initialView.y, initialView.x], initialView.z)
    else map.fitBounds(bounds)

    const tiles = createMapTileLayer(tileIndex)
    tiles.on('loading', () => callbacksRef.current.onLoadingChange?.(true))
    tiles.on('load', () => callbacksRef.current.onLoadingChange?.(false))
    tiles.addTo(map)

    const updateOverzoom = () => map.getContainer().classList.toggle('overzoomed', map.getZoom() > tileIndex.maxNativeZoom)
    updateOverzoom()
    map.on('zoomend', updateOverzoom)
    map.on('resize', updateMinZoom)
    map.on('moveend', () => callbacksRef.current.onViewChange?.(toView(map)))
    map.on('contextmenu', (event) => {
      const point = { x: Math.round(event.latlng.lng), y: Math.round(event.latlng.lat) }
      L.popup({ className: 'point-popup-wrapper' })
        .setLatLng(event.latlng)
        .setContent(buildPointPopup(point, map.getZoom()))
        .openOn(map)
    })
    callbacksRef.current.onViewChange?.(toView(map))

    return () => {
      map.remove()
      mapRef.current = null
      markersRef.current.clear()
    }
  }, [tileIndex])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return undefined
    const layer = L.layerGroup().addTo(map)
    locations.forEach((location) => {
      const marker = L.marker([location.y, location.x], {
        icon: createPinIcon(location.type),
        title: '',
        riseOnHover: true,
      })
      marker.bindTooltip(location.name, { direction: 'top', offset: [0, -PIN_ICON_ANCHOR[1]] })
      marker.on('click', () => callbacksRef.current.onSelectLocation?.(location))
      marker.on('add', () => marker.getElement()?.setAttribute('aria-label', location.name))
      marker.addTo(layer)
      markersRef.current.set(String(location.id), { marker, location })
    })
    return () => {
      layer.remove()
      markersRef.current.clear()
    }
  }, [locations])

  useEffect(() => {
    markersRef.current.forEach(({ marker }, id) => {
      const element = marker.getElement()
      const selected = id === String(selectedId)
      element?.classList.toggle('selected', selected)
      element?.setAttribute('aria-pressed', String(selected))
    })
  }, [selectedId, locations])

  return <div ref={containerRef} id="mapCanvas" role="application" aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight + - 0" />
})

export default MapView
