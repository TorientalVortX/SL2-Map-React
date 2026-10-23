import test from 'node:test'
import assert from 'node:assert/strict'
import { searchLocations } from './searchLocations.js'

const locations = [
  { id: 1, name: 'Telegrad', type: 'nation', description: 'Fed by the Halard Reservoir.' },
  { id: 2, name: 'Old Telegrad Road', type: 'landmark', description: '' },
  { id: 3, name: 'Duyuei', type: 'nation', description: '' },
  { id: 4, name: 'Halard Dam', type: 'landmark', description: '' },
]

const names = (results) => results.map((location) => location.name)

test('ranks exact, prefix, then substring name matches', () => {
  assert.deepEqual(names(searchLocations(locations, 'telegrad')), ['Telegrad', 'Old Telegrad Road'])
})

test('matches name prefixes before descriptions', () => {
  assert.deepEqual(names(searchLocations(locations, 'halard')), ['Halard Dam', 'Telegrad'])
})

test('matches by type', () => {
  assert.deepEqual(names(searchLocations(locations, 'nation')), ['Duyuei', 'Telegrad'])
})

test('returns nothing for blank queries and respects the limit', () => {
  assert.deepEqual(searchLocations(locations, '   '), [])
  assert.equal(searchLocations(locations, 'a', 2).length, 2)
})
