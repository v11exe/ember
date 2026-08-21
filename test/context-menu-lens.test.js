const test = require('node:test')
const assert = require('node:assert/strict')

const {
  createLensController, findEnabledIndex, keyboardStart, lensFrame,
} = require('../src/renderer/pages/context-menu-lens')

test('findEnabledIndex wraps and skips disabled destinations', () => {
  const buttons = [{ disabled: false }, { disabled: true }, { disabled: false }]
  assert.equal(findEnabledIndex(buttons, 1, 1), 2)
  assert.equal(findEnabledIndex(buttons, 1, -1), 0)
  assert.equal(findEnabledIndex(buttons, 3, 1), 0)
})

test('findEnabledIndex preserves no destination when every row is disabled', () => {
  assert.equal(findEnabledIndex([{ disabled: true }, { disabled: true }], 0, 1), -1)
})

test('lensFrame aligns a selector and its raw capture sample to the same page pixels', () => {
  assert.deepEqual(lensFrame(
    { left: 10, top: 20 },
    { left: 17, top: 113, width: 284, height: 38 },
    { x: -40, y: -24 },
  ), {
    x: 7, y: 93, width: 284, height: 38,
    sampleX: -47, sampleY: -117,
  })
})

test('keyboard navigation reveals the first or last enabled direction from rest', () => {
  assert.equal(keyboardStart(-1, 'ArrowDown', 4), 0)
  assert.equal(keyboardStart(-1, 'ArrowUp', 4), 3)
  assert.equal(keyboardStart(2, 'ArrowDown', 4), 3)
  assert.equal(keyboardStart(2, 'ArrowUp', 4), 1)
})

test('setting pointer-opened rows leaves the one selector hidden until activation', () => {
  const shell = { getBoundingClientRect: () => ({ left: 0, top: 0 }) }
  const lens = { style: { setProperty: () => {} }, dataset: { visible: 'true' } }
  const controller = createLensController(shell, lens)
  controller.setButtons([])
  assert.equal(controller.activeIndex, -1)
  assert.equal(lens.dataset.visible, 'false')
})
