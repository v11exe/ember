const test = require('node:test')
const assert = require('node:assert/strict')

const { resolveShortcut, COMMANDS, nextZoom, ZOOM_STEPS } = require('../src/main/shortcuts')
const { luminanceOf, classify, LIGHT_THRESHOLD } = require('../src/renderer/pages/backdrop-contrast')

const press = (key, mods = {}) => resolveShortcut({ type: 'keyDown', key, ...mods })
const ctrl = (key, mods = {}) => press(key, { control: true, ...mods })

test('tab shortcuts match Chrome', () => {
  assert.deepEqual(ctrl('t'), { command: COMMANDS.NEW_TAB })
  assert.deepEqual(ctrl('w'), { command: COMMANDS.CLOSE_TAB })
  assert.deepEqual(ctrl('t', { shift: true }), { command: COMMANDS.REOPEN_TAB })
  assert.deepEqual(ctrl('Tab'), { command: COMMANDS.NEXT_TAB })
  assert.deepEqual(ctrl('Tab', { shift: true }), { command: COMMANDS.PREVIOUS_TAB })
})

test('Ctrl+1 to 8 select by position and Ctrl+9 is the last tab', () => {
  assert.deepEqual(ctrl('1'), { command: COMMANDS.SELECT_TAB, index: 0 })
  assert.deepEqual(ctrl('8'), { command: COMMANDS.SELECT_TAB, index: 7 })
  assert.deepEqual(ctrl('9'), { command: COMMANDS.LAST_TAB })
})

test('window shortcuts', () => {
  assert.deepEqual(ctrl('n'), { command: COMMANDS.NEW_WINDOW })
  assert.deepEqual(ctrl('n', { shift: true }), { command: COMMANDS.NEW_PRIVATE_WINDOW })
  assert.deepEqual(ctrl('w', { shift: true }), { command: COMMANDS.CLOSE_WINDOW })
})

test('Alt arrows navigate history', () => {
  assert.deepEqual(press('ArrowLeft', { alt: true }), { command: COMMANDS.BACK })
  assert.deepEqual(press('ArrowRight', { alt: true }), { command: COMMANDS.FORWARD })
})

test('arrow keys without Alt are left to the page', () => {
  assert.equal(press('ArrowLeft'), null)
  assert.equal(press('ArrowRight'), null)
})

test('reload has a plain and a cache-ignoring form', () => {
  assert.deepEqual(ctrl('r'), { command: COMMANDS.RELOAD })
  assert.deepEqual(ctrl('r', { shift: true }), { command: COMMANDS.HARD_RELOAD })
  assert.deepEqual(press('F5'), { command: COMMANDS.RELOAD })
  assert.deepEqual(press('F5', { shift: true }), { command: COMMANDS.HARD_RELOAD })
})

test('address bar can be focused three ways', () => {
  assert.deepEqual(ctrl('l'), { command: COMMANDS.FOCUS_OMNIBOX })
  assert.deepEqual(press('d', { alt: true }), { command: COMMANDS.FOCUS_OMNIBOX })
  assert.deepEqual(press('F6'), { command: COMMANDS.FOCUS_OMNIBOX })
})

test('internal pages have shortcuts', () => {
  assert.deepEqual(ctrl('h'), { command: COMMANDS.HISTORY })
  assert.deepEqual(ctrl('j'), { command: COMMANDS.DOWNLOADS })
  assert.deepEqual(ctrl(','), { command: COMMANDS.SETTINGS })
  assert.deepEqual(ctrl('e', { shift: true }), { command: COMMANDS.EXTENSIONS })
})

test('F11 toggles fullscreen and Escape stops loading', () => {
  assert.deepEqual(press('F11'), { command: COMMANDS.FULLSCREEN })
  assert.deepEqual(press('Escape'), { command: COMMANDS.STOP })
})

test('zoom shortcuts cover both plus spellings', () => {
  assert.deepEqual(ctrl('+'), { command: COMMANDS.ZOOM_IN })
  assert.deepEqual(ctrl('='), { command: COMMANDS.ZOOM_IN })
  assert.deepEqual(ctrl('-'), { command: COMMANDS.ZOOM_OUT })
  assert.deepEqual(ctrl('0'), { command: COMMANDS.ZOOM_RESET })
})

test('keys are matched case insensitively', () => {
  assert.deepEqual(ctrl('T'), { command: COMMANDS.NEW_TAB })
  assert.deepEqual(press('f11'), { command: COMMANDS.FULLSCREEN })
})

test('key up events never trigger a command', () => {
  assert.equal(resolveShortcut({ type: 'keyUp', key: 't', control: true }), null)
})

test('unmodified typing is never a shortcut', () => {
  assert.equal(press('t'), null)
  assert.equal(press('a'), null)
  assert.equal(press('1'), null)
})

test('Ctrl+Alt combinations are left alone', () => {
  assert.equal(ctrl('t', { alt: true }), null)
  assert.equal(ctrl('1', { alt: true }), null)
})

test('find is recognised but deliberately unhandled until a find bar exists', () => {
  assert.deepEqual(ctrl('f'), { command: COMMANDS.FIND })
})

test('zoom steps move one rung at a time and clamp at the ends', () => {
  assert.equal(nextZoom(0, 1), 0.5)
  assert.equal(nextZoom(0, -1), -0.5)
  assert.equal(nextZoom(ZOOM_STEPS[ZOOM_STEPS.length - 1], 1), ZOOM_STEPS[ZOOM_STEPS.length - 1])
  assert.equal(nextZoom(ZOOM_STEPS[0], -1), ZOOM_STEPS[0])
})

test('an off-ladder zoom level snaps back onto the ladder', () => {
  assert.equal(nextZoom(0.37, 1), 0.5)
})

// ---------------------------------------------------------------- backdrop contrast

test('a white backdrop is classified light, a black one dark', () => {
  const white = new Uint8ClampedArray(64 * 4).fill(255)
  const black = new Uint8ClampedArray(64 * 4).fill(0)
  assert.equal(classify(luminanceOf(white)), 'light')
  assert.equal(classify(luminanceOf(black)), 'dark')
})

test('luminance is normalised to 0..1', () => {
  const white = new Uint8ClampedArray(64 * 4).fill(255)
  assert.ok(Math.abs(luminanceOf(white) - 1) < 0.001)
  assert.equal(luminanceOf(new Uint8ClampedArray(64 * 4).fill(0)), 0)
})

test('mid grey sits below the light threshold, so text stays light', () => {
  const grey = new Uint8ClampedArray(64 * 4).fill(128)
  const luminance = luminanceOf(grey)
  assert.ok(luminance < LIGHT_THRESHOLD, `expected ${luminance} < ${LIGHT_THRESHOLD}`)
  assert.equal(classify(luminance), 'dark')
})

test('green dominates perceived brightness, matching Rec. 709', () => {
  const pixels = (r, g, b) => {
    const data = new Uint8ClampedArray(64 * 4)
    for (let i = 0; i < data.length; i += 4) { data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255 }
    return luminanceOf(data)
  }
  assert.ok(pixels(0, 255, 0) > pixels(255, 0, 0))
  assert.ok(pixels(255, 0, 0) > pixels(0, 0, 255))
})
