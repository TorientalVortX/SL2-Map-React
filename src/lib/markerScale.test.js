import test from 'node:test'
import assert from 'node:assert/strict'
import { LOCAL_MIN_ZOOM, WORLD_MAX_ZOOM, focusZoom, markerScale, showsLocal, showsWorld } from './markerScale.js'

test('markers are world scale unless marked local', () => {
  assert.equal(markerScale({}), 'world')
  assert.equal(markerScale({ scale: 'world' }), 'world')
  assert.equal(markerScale({ scale: 'local' }), 'local')
})

test('world markers show up to and including their max zoom', () => {
  assert.equal(showsWorld(WORLD_MAX_ZOOM), true)
  assert.equal(showsWorld(WORLD_MAX_ZOOM + 0.25), false)
})

test('local markers show from their min zoom', () => {
  assert.equal(showsLocal(LOCAL_MIN_ZOOM - 0.25), false)
  assert.equal(showsLocal(LOCAL_MIN_ZOOM), true)
})

test('both scales show between the thresholds', () => {
  for (let zoom = LOCAL_MIN_ZOOM; zoom <= WORLD_MAX_ZOOM; zoom += 0.25) {
    assert.ok(showsWorld(zoom) && showsLocal(zoom), `zoom ${zoom}`)
  }
})

test('focusing a marker lands on a zoom where its scale is shown', () => {
  for (const zoom of [1, WORLD_MAX_ZOOM, 8]) {
    assert.equal(showsWorld(focusZoom({}, zoom)), true)
    assert.equal(showsLocal(focusZoom({ scale: 'local' }, zoom)), true)
  }
  assert.equal(focusZoom({ scale: 'local' }, 7), 7)
})
