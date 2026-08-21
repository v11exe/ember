const test = require('node:test')
const assert = require('node:assert/strict')

const { findEnabledIndex, lensFrame } = require('../src/renderer/pages/context-menu-lens')

test('findEnabledIndex wraps and skips disabled destinations', () => {
  const buttons = [{ disabled: false }, { disabled: true }, { disabled: false }]
  assert.equal(findEnabledIndex(buttons, 1, 1), 2)
  assert.equal(findEnabledIndex(buttons, 1, -1), 0)
  assert.equal(findEnabledIndex(buttons, 3, 1), 0)
})

test('findEnabledIndex preserves no destination when every row is disabled', () => {
  assert.equal(findEnabledIndex([{ disabled: true }, { disabled: true }], 0, 1), -1)
})

test('lensFrame aligns a selector and inverse texture to the same page pixels', () => {
  assert.deepEqual(lensFrame(
    { left: 10, top: 20 },
    { left: 17, top: 113, width: 284, height: 38 },
  ), { x: 7, y: 93, width: 284, height: 38, textureX: -7, textureY: -93 })
})
