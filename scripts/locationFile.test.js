import test from 'node:test'
import assert from 'node:assert/strict'
import { formatLocations, moveLocation } from './locationFile.js'

const locations = [
  { id: 1, name: 'A', x: 10, y: 20, type: 'nation', description: '' },
  { id: 2, name: 'B', x: 30, y: 40, type: 'nation', description: '' },
]

test('moves only the matching location and rounds coordinates', () => {
  const moved = moveLocation(locations, '2', 55.6, 70.2)
  assert.deepEqual(moved[1], { ...locations[1], x: 56, y: 70 })
  assert.equal(moved[0], locations[0])
})

test('rejects unknown ids and non-numeric coordinates', () => {
  assert.throws(() => moveLocation(locations, 3, 1, 1), /Unknown location/)
  assert.throws(() => moveLocation(locations, 1, 'a', 1), /must be numbers/)
})

test('formats one location per line and round-trips', () => {
  const text = formatLocations(locations)
  assert.equal(text.split('\n').length, locations.length + 3)
  assert.deepEqual(JSON.parse(text), locations)
})
