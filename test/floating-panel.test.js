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
