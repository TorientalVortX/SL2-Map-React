import L from 'leaflet'
import { createBlankLookup } from './tileBitset.js'

export function createMapCrs(index) {
  const scale = 1 / 2 ** index.maxNativeZoom
  return L.extend({}, L.CRS.Simple, { transformation: new L.Transformation(scale, 0, scale, 0) })
}

export function getMapBounds(index) {
  return L.latLngBounds([0, 0], [index.height, index.width])
}

export function getContentBounds(index) {
  const bounds = index.contentBounds
  return bounds ? L.latLngBounds([bounds.minY, bounds.minX], [bounds.maxY, bounds.maxX]) : getMapBounds(index)
}

export function createMapTileLayer(index) {
  const isBlank = createBlankLookup(index.levels)
  const BlankAwareTileLayer = L.TileLayer.extend({
    createTile(coords, done) {
      if (!isBlank(coords)) return L.TileLayer.prototype.createTile.call(this, coords, done)
      const tile = document.createElement('div')
      tile.className = 'blank-tile'
      L.Util.requestAnimFrame(() => done(null, tile))
      return tile
    },
  })
  return new BlankAwareTileLayer(index.tileUrl, {
    tileSize: index.tileSize,
    minZoom: -Infinity,
    minNativeZoom: 0,
    maxNativeZoom: index.maxNativeZoom,
    bounds: getMapBounds(index),
    noWrap: true,
    keepBuffer: 1,
  })
}
