import test from 'node:test'
import assert from 'node:assert/strict'
import { createBlankLookup, decodeBitset, encodeBitset } from './tileBitset.js'

test('bitset round-trips across byte boundaries', () => {
  const bits = Array.from({ length: 19 }, (_, i) => i % 3 === 0)
  const has = decodeBitset(encodeBitset(bits))
  bits.forEach((bit, i) => assert.equal(has(i), bit, `bit ${i}`))
})

test('blank lookup reads row-major bits per zoom level', () => {
  const isBlank = createBlankLookup({ 2: { cols: 3, rows: 2, blank: encodeBitset([true, false, false, false, false, true]) } })
  assert.equal(isBlank({ x: 0, y: 0, z: 2 }), true)
  assert.equal(isBlank({ x: 1, y: 0, z: 2 }), false)
  assert.equal(isBlank({ x: 2, y: 1, z: 2 }), true)
})

test('tiles outside the grid or level count as blank', () => {
  const isBlank = createBlankLookup({ 0: { cols: 1, rows: 1, blank: encodeBitset([false]) } })
  assert.equal(isBlank({ x: 0, y: 0, z: 0 }), false)
  assert.equal(isBlank({ x: 1, y: 0, z: 0 }), true)
  assert.equal(isBlank({ x: -1, y: 0, z: 0 }), true)
  assert.equal(isBlank({ x: 0, y: 0, z: 3 }), true)
})
