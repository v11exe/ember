const test = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')

const { FloatingPanel } = require('../src/main/floating-panel')
const { IPC } = require('../src/shared/ipc')

test('shows a bounded transparent view with a captured real-page backdrop', async () => {
  const contents = new EventEmitter()
  const sent = []
  contents.isDestroyed = () => false
  contents.loadURL = async () => { queueMicrotask(() => contents.emit('did-finish-load')) }
  contents.send = (...args) => sent.push(args)
  contents.focus = () => {}
  const applied = []
  const view = {
    webContents: contents,
    setBackgroundColor: (color) => applied.push(['background', color]),
    setBounds: (bounds) => applied.push(['bounds', bounds]),
    setVisible: (visible) => applied.push(['visible', visible]),
  }
  const win = { contentView: { addChildView: (child) => applied.push(['add', child]) } }
  const targetView = {
    getBounds: () => ({ x: 0, y: 84, width: 900, height: 556 }),
    webContents: {
      capturePage: async (rect) => ({
        isEmpty: () => false,
        toDataURL: () => `data:image/png;rect=${JSON.stringify(rect)}`,
      }),
    },
  }
  const panel = new FloatingPanel(win, {
    url: 'ember://upload',
    createView: () => view,
  })

  await panel.show({
    bounds: { x: 125, y: 146, width: 650, height: 430 },
    targetView,
    state: { kind: 'upload' },
  })
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(panel.open, true)
  assert.deepEqual(applied.at(-1), ['visible', true])
  assert.equal(sent[0][0], IPC.OVERLAY_STATE)
  assert.match(sent[0][1].backdrop, /"y":62/)
})

test('captures requested bleed and reports exact backdrop alignment metadata', async () => {
  const contents = new EventEmitter()
  const sent = []
  contents.isDestroyed = () => false
  contents.loadURL = async () => { queueMicrotask(() => contents.emit('did-finish-load')) }
  contents.send = (...args) => sent.push(args)
  contents.focus = () => {}
  const captures = []
  const targetView = {
    getBounds: () => ({ x: 20, y: 84, width: 900, height: 556 }),
    webContents: { capturePage: async (rect) => {
      captures.push(rect)
      return {
        isEmpty: () => false,
        toDataURL: () => 'data:image/png;base64,exact',
        getSize: () => ({ width: rect.width * 2, height: rect.height * 2 }),
      }
    } },
  }
  const panel = new FloatingPanel({ contentView: { addChildView: () => {} } }, {
    url: 'ember://context-menu',
    createView: () => ({
      webContents: contents, setBackgroundColor: () => {}, setBounds: () => {}, setVisible: () => {},
    }),
  })

  await panel.show({
    bounds: { x: 120, y: 184, width: 318, height: 300 },
    captureBleed: 40,
    targetView,
    state: { kind: 'context-menu' },
  })
  await new Promise((resolve) => setImmediate(resolve))

  assert.deepEqual(captures[0], { x: 60, y: 60, width: 398, height: 380 })
  assert.deepEqual(sent[0][1].backdropRect, {
    x: -40, y: -40, width: 398, height: 380, pixelWidth: 796, pixelHeight: 760,
  })
})

test('clips bleed at page edges without shifting the captured texture', async () => {
  const contents = new EventEmitter()
  const sent = []
  contents.isDestroyed = () => false
  contents.loadURL = async () => { queueMicrotask(() => contents.emit('did-finish-load')) }
  contents.send = (...args) => sent.push(args)
  contents.focus = () => {}
  let captured
  const panel = new FloatingPanel({ contentView: { addChildView: () => {} } }, {
    url: 'ember://context-menu',
    createView: () => ({ webContents: contents, setBackgroundColor: () => {}, setBounds: () => {}, setVisible: () => {} }),
  })
  await panel.show({
    bounds: { x: 20, y: 84, width: 318, height: 200 }, captureBleed: 40, state: {},
    targetView: {
      getBounds: () => ({ x: 20, y: 84, width: 900, height: 556 }),
      webContents: { capturePage: async (rect) => {
        captured = rect
        return { isEmpty: () => false, toDataURL: () => 'data:image/png;base64,edge' }
      } },
    },
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(captured, { x: 0, y: 0, width: 358, height: 240 })
  assert.deepEqual(sent[0][1].backdropRect, { x: 0, y: 0, width: 358, height: 240 })
})

test('relayout recaptures the moved backdrop without reopening or refocusing', async () => {
  const contents = new EventEmitter()
  const sent = []
  let focuses = 0
  contents.isDestroyed = () => false
  contents.loadURL = async () => { queueMicrotask(() => contents.emit('did-finish-load')) }
  contents.send = (...args) => sent.push(args)
  contents.focus = () => { focuses += 1 }
  const captures = []
  const targetView = {
    getBounds: () => ({ x: 0, y: 84, width: 900, height: 556 }),
    webContents: { capturePage: async (rect) => {
      captures.push(rect)
      return { isEmpty: () => false, toDataURL: () => `data:image/png;base64,${rect.x}` }
    } },
  }
  const panel = new FloatingPanel({ contentView: { addChildView: () => {} } }, {
    url: 'ember://context-menu',
    createView: () => ({ webContents: contents, setBackgroundColor: () => {}, setBounds: () => {}, setVisible: () => {} }),
  })
  await panel.show({ bounds: { x: 100, y: 140, width: 318, height: 200 }, state: {}, targetView, captureBleed: 40 })
  await panel.relayout({ bounds: { x: 200, y: 180, width: 318, height: 200 }, targetView, captureBleed: 40 })
  assert.equal(captures.length, 2)
  assert.equal(captures[1].x, 160)
  assert.equal(focuses, 1)
  assert.equal(sent.at(-1)[1].backdrop, 'data:image/png;base64,160')
})

test('hides without changing the target page bounds', async () => {
  const contents = new EventEmitter()
  contents.isDestroyed = () => false
  contents.loadURL = async () => { contents.emit('did-finish-load') }
  contents.send = () => {}
  contents.focus = () => {}
  const visible = []
  const panel = new FloatingPanel({ contentView: { addChildView: () => {} } }, {
    url: 'ember://context-menu',
    createView: () => ({
      webContents: contents,
      setBackgroundColor: () => {}, setBounds: () => {},
      setVisible: (next) => visible.push(next),
    }),
  })
  await panel.show({ bounds: { x: 8, y: 92, width: 286, height: 300 }, state: {} })
  panel.hide()
  assert.equal(panel.open, false)
  assert.equal(visible.at(-1), false)
})

test('does not reopen after dismissal while backdrop capture is pending', async () => {
  let finishCapture
  const capture = new Promise((resolve) => { finishCapture = resolve })
  const panel = new FloatingPanel({ contentView: { addChildView: () => {} } }, {
    url: 'ember://context-menu',
    createView: () => { throw new Error('a dismissed panel must not create its view') },
  })
  const opening = panel.show({
    bounds: { x: 8, y: 92, width: 286, height: 300 }, state: {},
    targetView: {
      getBounds: () => ({ x: 0, y: 84, width: 900, height: 556 }),
      webContents: { capturePage: () => capture },
    },
  })
  panel.hide()
  finishCapture({ isEmpty: () => true })
  await opening
  assert.equal(panel.open, false)
  assert.equal(panel.view, null)
})

test('relayout during initial capture does not cancel the pending open', async () => {
  let finishCapture
  const capture = new Promise((resolve) => { finishCapture = resolve })
  const contents = new EventEmitter()
  contents.isDestroyed = () => false
  contents.loadURL = async () => { contents.emit('did-finish-load') }
  contents.send = () => {}
  contents.focus = () => {}
  const panel = new FloatingPanel({ contentView: { addChildView: () => {} } }, {
    url: 'ember://context-menu',
    createView: () => ({ webContents: contents, setBackgroundColor: () => {}, setBounds: () => {}, setVisible: () => {} }),
  })
  const targetView = {
    getBounds: () => ({ x: 0, y: 84, width: 900, height: 556 }),
    webContents: { capturePage: () => capture },
  }
  const opening = panel.show({ bounds: { x: 8, y: 92, width: 318, height: 200 }, state: {}, targetView })
  const relayouting = panel.relayout({ bounds: { x: 20, y: 104, width: 318, height: 200 }, targetView })
  finishCapture({ isEmpty: () => false, toDataURL: () => 'data:image/png;base64,pending' })
  await relayouting
  assert.equal(await opening, true)
  assert.equal(panel.open, true)
})
