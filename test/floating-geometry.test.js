const test = require('node:test')
const assert = require('node:assert/strict')

const { centerPanel, placePointPanel } = require('../src/shared/floating-geometry')

test('centers a large upload panel inside the live page viewport', () => {
  assert.deepEqual(centerPanel(
    { x: 0, y: 114, width: 900, height: 526 },
    { width: 650, height: 430 },
    12
  ), { x: 125, y: 162, width: 650, height: 430 })
})

test('constrains an upload panel at the minimum browser size', () => {
  assert.deepEqual(centerPanel(
    { x: 0, y: 84, width: 620, height: 336 },
    { width: 650, height: 430 },
    12
  ), { x: 12, y: 96, width: 596, height: 312 })
})

test('keeps context menus inside every viewport edge', () => {
  const viewport = { x: 0, y: 84, width: 620, height: 336 }
  assert.deepEqual(placePointPanel(viewport, { x: 615, y: 415 }, { width: 286, height: 310 }, 8),
    { x: 326, y: 102, width: 286, height: 310 })
  assert.deepEqual(placePointPanel(viewport, { x: 2, y: 86 }, { width: 286, height: 310 }, 8),
    { x: 8, y: 92, width: 286, height: 310 })
})
