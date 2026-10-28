export const LOCAL_MIN_ZOOM = 3.5
export const WORLD_MAX_ZOOM = 4

const WORLD_FOCUS_ZOOM = WORLD_MAX_ZOOM - 0.25
const LOCAL_FOCUS_ZOOM = WORLD_MAX_ZOOM + 0.5

export function markerScale(location) {
  return location.scale === 'local' ? 'local' : 'world'
}

export function showsWorld(zoom) {
  return zoom <= WORLD_MAX_ZOOM
}

export function showsLocal(zoom) {
  return zoom >= LOCAL_MIN_ZOOM
}

export function focusZoom(location, currentZoom) {
  return markerScale(location) === 'local' ? Math.max(currentZoom, LOCAL_FOCUS_ZOOM) : WORLD_FOCUS_ZOOM
}
