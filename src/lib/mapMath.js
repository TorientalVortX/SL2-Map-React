export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function getVisibleTileRange({
  offsetX,
  offsetY,
  zoom,
  viewportWidth,
  viewportHeight,
  tileSize,
  gridWidth,
  gridHeight,
  bufferTiles = 1,
}) {
  const safeZoom = Math.max(zoom, Number.EPSILON)
  const buffer = Math.max(0, bufferTiles) * tileSize
  const left = -offsetX / safeZoom - buffer
  const top = -offsetY / safeZoom - buffer
  const right = (-offsetX + viewportWidth) / safeZoom + buffer
  const bottom = (-offsetY + viewportHeight) / safeZoom + buffer
  const mapWidth = gridWidth * tileSize
  const mapHeight = gridHeight * tileSize

  if (right < 0 || bottom < 0 || left > mapWidth || top > mapHeight) return null

  return {
    startCol: clamp(Math.floor(left / tileSize), 0, gridWidth - 1),
    endCol: clamp(Math.floor(right / tileSize), 0, gridWidth - 1),
    startRow: clamp(Math.floor(top / tileSize), 0, gridHeight - 1),
    endRow: clamp(Math.floor(bottom / tileSize), 0, gridHeight - 1),
  }
}

export function zoomAroundPoint({ zoom, newZoom, offsetX, offsetY, pointX, pointY }) {
  const worldX = (pointX - offsetX) / zoom
  const worldY = (pointY - offsetY) / zoom

  return {
    offsetX: pointX - worldX * newZoom,
    offsetY: pointY - worldY * newZoom,
  }
}

export function constrainMapOffsets({
  offsetX,
  offsetY,
  zoom,
  viewportWidth,
  viewportHeight,
  mapWidth,
  mapHeight,
}) {
  const scaledWidth = Math.max(0, mapWidth) * Math.max(0, zoom)
  const scaledHeight = Math.max(0, mapHeight) * Math.max(0, zoom)

  const constrainAxis = (offset, viewportSize, contentSize) => {
    if (contentSize <= viewportSize) return (viewportSize - contentSize) / 2
    return clamp(offset, viewportSize - contentSize, 0)
  }

  return {
    offsetX: constrainAxis(offsetX, Math.max(0, viewportWidth), scaledWidth),
    offsetY: constrainAxis(offsetY, Math.max(0, viewportHeight), scaledHeight),
  }
}

export function isMapPointInViewport({
  x,
  y,
  offsetX,
  offsetY,
  zoom,
  viewportWidth,
  viewportHeight,
  padding = 0,
}) {
  const screenX = offsetX + x * zoom
  const screenY = offsetY + y * zoom
  const safePadding = Math.max(0, padding)

  return screenX >= -safePadding
    && screenX <= viewportWidth + safePadding
    && screenY >= -safePadding
    && screenY <= viewportHeight + safePadding
}
