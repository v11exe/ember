const test = require('node:test')
const assert = require('node:assert/strict')

const { calculatePopupBounds } = require('../src/shared/popup-geometry')

test('places an extension popup inward to the left of the panel', () => {
  const bounds = calculatePopupBounds({
    windowBounds: { x: 100, y: 50, width: 1280, height: 820 },
    panelBounds: { x: 964, y: 78, width: 306, height: 240 },
    anchorRect: { x: 980, y: 136, width: 32, height: 32 },
    popupSize: { width: 420, height: 500 },
  })

  assert.equal(bounds.x, 100 + 964 - 10 - 420)
  assert.ok(bounds.x + bounds.width <= 100 + 964 - 10)
  assert.equal(bounds.y, 50 + 136)
})

test('constrains oversized popups to the usable browser viewport', () => {
  const bounds = calculatePopupBounds({
    windowBounds: { x: 20, y: 30, width: 620, height: 420 },
    panelBounds: { x: 304, y: 78, width: 306, height: 240 },
    anchorRect: { x: 320, y: 350, width: 32, height: 32 },
    popupSize: { width: 800, height: 600 },
  })

  assert.deepEqual(bounds, { x: 30, y: 40, width: 600, height: 400 })
})

test('clamps vertical placement above the bottom edge', () => {
  const bounds = calculatePopupBounds({
    windowBounds: { x: 0, y: 0, width: 1000, height: 700 },
    panelBounds: { x: 684, y: 78, width: 306, height: 300 },
    anchorRect: { x: 700, y: 620, width: 32, height: 32 },
    popupSize: { width: 300, height: 260 },
  })

  assert.equal(bounds.y, 430)
  assert.equal(bounds.y + bounds.height, 690)
})
