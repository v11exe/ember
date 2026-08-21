const test = require('node:test')
const assert = require('node:assert/strict')

const { PopupPositioner } = require('../src/main/popup-positioner')

test('applies viewport-safe bounds to a real extension popup window', () => {
  let applied
  const win = { getBounds: () => ({ x: 100, y: 50, width: 900, height: 600 }) }
  const panel = {
    bounds: { x: 584, y: 78, width: 306, height: 240 },
    popupAnchor: { x: 600, y: 520, width: 32, height: 32 },
  }
  const popup = {
    isDestroyed: () => false,
    browserWindow: {
      isDestroyed: () => false,
      getBounds: () => ({ x: 900, y: 580, width: 500, height: 500 }),
      setBounds: (bounds) => { applied = bounds },
    },
  }

  new PopupPositioner(win, panel).layoutPopup(popup)

  assert.deepEqual(applied, { x: 174, y: 140, width: 500, height: 500 })
})
