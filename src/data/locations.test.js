import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const locations = JSON.parse(fs.readFileSync(new URL('./locations.json', import.meta.url), 'utf8'))
const tileIndex = JSON.parse(fs.readFileSync(new URL('../generated/tile-index.json', import.meta.url), 'utf8'))
const styles = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8')
const pinTypes = new Set([...styles.matchAll(/\.type-([\w-]+)\s*\{[^}]*--pin-color/g)].map((match) => match[1]))

test('location ids are unique', () => {
  const ids = locations.map((location) => location.id)
  assert.equal(new Set(ids).size, ids.length)
})

for (const location of locations) {
  test(`${location.name || location.id} is valid`, () => {
    assert.ok(Number.isInteger(location.id), 'id must be an integer')
    assert.ok(typeof location.name === 'string' && location.name.trim(), 'name is required')
    assert.equal(typeof location.description, 'string', 'description must be a string')
    assert.ok(pinTypes.has(location.type), `type "${location.type}" has no pin colour in styles.css`)
    if ('scale' in location) assert.ok(['world', 'local'].includes(location.scale), `unknown scale "${location.scale}"`)
    assert.ok(Number.isInteger(location.x) && location.x >= 0 && location.x <= tileIndex.width, `x ${location.x} is off the map`)
    assert.ok(Number.isInteger(location.y) && location.y >= 0 && location.y <= tileIndex.height, `y ${location.y} is off the map`)
  })
}
