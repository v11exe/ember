const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const { WindowCorners, SETTLE_MS } = require('../src/main/window-corners')

function fakeWindow({ maximized = false } = {}) {
  const handlers = new Map()
  return {
    maximized,
    isDestroyed: () => false,
    isMaximized() { return this.maximized },
    getNativeWindowHandle: () => Buffer.alloc(8),
    on(event, fn) { handlers.set(event, fn) },
    fire(event) { handlers.get(event)?.() },
    events: handlers,
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, SETTLE_MS + 40))

test('a restore puts the rounded corners back', async () => {
  const calls = []
  const win = fakeWindow()
  const corners = new WindowCorners(win, { userDataPath: '.', platform: 'win32', run: (a) => calls.push(a) })
  corners.watch(null)
  await settle()
  assert.equal(calls.length, 1, 'the initial assertion did not run')
  assert.equal(calls[0][1], 'round')

  win.fire('unmaximize')
  await settle()
  assert.equal(calls.length, 2, 'unmaximize did not re-assert')
  corners.destroy()
})

test('a flurry of events is one call, not one call each', async () => {
  const calls = []
  const win = fakeWindow()
  const corners = new WindowCorners(win, { userDataPath: '.', platform: 'win32', run: (a) => calls.push(a) })
  corners.watch(null)
  await settle()
  calls.length = 0
  // A restore is a move and a resize as well; spawning a process for each
  // would be worse than the bug.
  win.fire('restore'); win.fire('move'); win.fire('resize'); win.fire('move')
  await settle()
  assert.equal(calls.length, 1, `coalescing failed: ${calls.length} calls`)
  corners.destroy()
})

test('a maximised window is left square, because that is correct', async () => {
  const calls = []
  const win = fakeWindow({ maximized: true })
  const corners = new WindowCorners(win, { userDataPath: '.', platform: 'win32', run: (a) => calls.push(a) })
  corners.watch(null)
  await settle()
  assert.equal(calls.length, 0, 'asked Windows to round a maximised window')
  corners.destroy()
})

test('a destroyed guard stops asking', async () => {
  const calls = []
  const win = fakeWindow()
  const corners = new WindowCorners(win, { userDataPath: '.', platform: 'win32', run: (a) => calls.push(a) })
  corners.watch(null)
  corners.reassert()
  corners.destroy()
  await settle()
  assert.equal(calls.length, 0)
})

test('nothing native is attempted away from Windows', async () => {
  const calls = []
  const win = fakeWindow()
  const corners = new WindowCorners(win, { userDataPath: '.', platform: 'darwin', run: (a) => calls.push(a) })
  corners.watch(null)
  await settle()
  assert.equal(calls.length, 0)
  assert.equal(win.events.size, 0, 'listeners were attached on a platform with nothing to do')
})

test('the bridge sets the corner preference DWM actually reads', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'native', 'ember-window-corners.cs'), 'utf8')
  assert.match(source, /DWMWA_WINDOW_CORNER_PREFERENCE = 33/)
  assert.match(source, /DWMWCP_ROUND = 2/)
  assert.match(source, /DwmSetWindowAttribute/)
})
