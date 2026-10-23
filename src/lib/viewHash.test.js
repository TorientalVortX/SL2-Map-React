import test from 'node:test'
import assert from 'node:assert/strict'
import { formatViewHash, parseViewHash } from './viewHash.js'

test('formats and parses a view with a location', () => {
  const hash = formatViewHash({ x: 33048.4, y: 19279.6, z: 5.333 }, 1756967094317)
  assert.equal(hash, '#x=33048&y=19280&z=5.33&loc=1756967094317')
  assert.deepEqual(parseViewHash(hash), { view: { x: 33048, y: 19280, z: 5.33 }, locationId: '1756967094317' })
})

test('ignores incomplete or invalid views', () => {
  assert.deepEqual(parseViewHash('#x=10&y=20'), { view: null, locationId: null })
  assert.deepEqual(parseViewHash('#x=a&y=2&z=3'), { view: null, locationId: null })
  assert.deepEqual(parseViewHash(''), { view: null, locationId: null })
})

test('keeps a location link without a view', () => {
  assert.deepEqual(parseViewHash('#loc=42'), { view: null, locationId: '42' })
})
