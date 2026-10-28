import L from 'leaflet'

const WHEEL_PX_PER_ZOOM = 100
const EASING = 0.22
const SETTLE_DISTANCE = 0.002

export const SmoothWheelZoom = L.Handler.extend({
  addHooks() {
    L.DomEvent.on(this._map.getContainer(), 'wheel', this._onWheel, this)
    this._map.on('dragstart', this._finish, this)
  },

  removeHooks() {
    L.DomEvent.off(this._map.getContainer(), 'wheel', this._onWheel, this)
    this._map.off('dragstart', this._finish, this)
    this._finish()
  },

  _onWheel(event) {
    L.DomEvent.stop(event)
    const map = this._map
    if (!this._zooming) {
      map._stop()
      this._zooming = true
      this._targetZoom = map.getZoom()
      map._moveStart(true, false)
      this._frame = L.Util.requestAnimFrame(this._step, this)
    }
    this._anchor = map.mouseEventToContainerPoint(event)
    const target = this._targetZoom + L.DomEvent.getWheelDelta(event) / WHEEL_PX_PER_ZOOM
    this._targetZoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), target))
  },

  _step() {
    const map = this._map
    const zoom = map.getZoom()
    const remaining = this._targetZoom - zoom
    const settled = Math.abs(remaining) < SETTLE_DISTANCE || matchMedia('(prefers-reduced-motion: reduce)').matches
    const nextZoom = settled ? this._targetZoom : zoom + remaining * EASING

    const viewHalf = map.getSize().divideBy(2)
    const offset = this._anchor.subtract(viewHalf).multiplyBy(1 - 1 / map.getZoomScale(nextZoom, zoom))
    const center = map._limitCenter(map.containerPointToLatLng(viewHalf.add(offset)), nextZoom, map.options.maxBounds)
    // pinch defers tile loading and pruning to throttled updates, as in Leaflet's touch zoom; the last frame prunes
    map._move(center, nextZoom, settled ? undefined : { pinch: true })

    if (settled) this._finish()
    else this._frame = L.Util.requestAnimFrame(this._step, this)
  },

  _finish() {
    if (!this._zooming) return
    L.Util.cancelAnimFrame(this._frame)
    this._zooming = false
    this._map._moveEnd(true)
  },
})
