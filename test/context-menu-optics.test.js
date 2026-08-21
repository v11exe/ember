const test = require('node:test')
const assert = require('node:assert/strict')

let optics = {}
try { optics = require('../src/renderer/pages/context-menu-optics') } catch {}

test('outer map geometry keeps a 24px optical perimeter and a long neutral centre', () => {
  assert.equal(typeof optics.createMapGeometry, 'function')
  const geometry = optics.createMapGeometry(276, 420, 488, 136, 24)
  assert.deepEqual(geometry.target, { width: 276, height: 420, edge: 24 })
  assert.deepEqual(geometry.source, { width: 488, height: 136, edgeX: 68, edgeY: 68 })
  assert.deepEqual(geometry.neutral, { x: 24, y: 24, width: 228, height: 372 })
})

test('generated outer displacement is active at the edge and exactly neutral centrally', () => {
  assert.equal(typeof optics.renderDisplacementMap, 'function')
  const source = new Uint8ClampedArray(8 * 4 * 4).fill(255)
  const rendered = optics.renderDisplacementMap(source, 8, 4, 12, 10, 3)
  const pixel = (x, y) => [...rendered.slice((y * 12 + x) * 4, (y * 12 + x) * 4 + 4)]
  assert.deepEqual(pixel(6, 5), [128, 128, 128, 255])
  assert.notDeepEqual(pixel(6, 0), [128, 128, 128, 255])
  assert.notDeepEqual(pixel(0, 5), [128, 128, 128, 255])
})

test('outer displacement generation is deterministic for the same geometry', () => {
  assert.equal(typeof optics.renderDisplacementMap, 'function')
  const source = Uint8ClampedArray.from({ length: 8 * 4 * 4 }, (_, index) => index % 256)
  assert.deepEqual(
    optics.renderDisplacementMap(source, 8, 4, 20, 30, 4),
    optics.renderDisplacementMap(source, 8, 4, 20, 30, 4),
  )
})
