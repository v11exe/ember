const test = require('node:test')
const assert = require('node:assert/strict')

let optics = {}
try { optics = require('../src/renderer/pages/upload-optics') } catch {}

test('upload outer map preserves a 24px optical perimeter and neutral broad centre', () => {
  assert.equal(typeof optics.createMapGeometry, 'function')
  const geometry = optics.createMapGeometry(650, 430, 488, 136, 24)
  assert.deepEqual(geometry.target, { width: 650, height: 430, edge: 24 })
  assert.deepEqual(geometry.neutral, { x: 24, y: 24, width: 602, height: 382 })
})

test('upload displacement is active at its edge and exactly neutral through the centre', () => {
  assert.equal(typeof optics.renderDisplacementMap, 'function')
  const source = new Uint8ClampedArray(8 * 4 * 4).fill(255)
  const rendered = optics.renderDisplacementMap(source, 8, 4, 32, 24, 6)
  const pixel = (x, y) => [...rendered.slice((y * 32 + x) * 4, (y * 32 + x) * 4 + 4)]
  assert.deepEqual(pixel(16, 12), [128, 128, 128, 255])
  assert.notDeepEqual(pixel(16, 0), [128, 128, 128, 255])
  assert.notDeepEqual(pixel(0, 12), [128, 128, 128, 255])
})
