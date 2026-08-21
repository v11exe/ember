const test = require('node:test')
const assert = require('node:assert/strict')

const { UploadPanel } = require('../src/main/upload-panel')
const { IPC } = require('../src/shared/ipc')

function harness() {
  const shown = []
  const relayouts = []
  const hidden = []
  const sender = {}
  const overlay = {
    show: async (value) => shown.push(value),
    hide: () => hidden.push(true),
    isSender: (value) => value === sender,
    updateState: () => {},
    setBounds: () => {},
    relayout: async (value) => relayouts.push(value),
    open: false,
  }
  const recentsAdded = []
  const recents = {
    snapshot: () => [
      { path: 'C:\\photos\\ember.png', lastUsed: 2 },
      { path: 'C:\\docs\\notes.txt', lastUsed: 1 },
    ],
    add: async (paths) => recentsAdded.push(paths),
  }
  const image = {
    isEmpty: () => false,
    toPNG: () => Buffer.from([9]),
    resize: () => ({ toDataURL: () => 'data:image/png;base64,thumb' }),
  }
  const panel = new UploadPanel({}, {
    overlay,
    recents,
    clipboard: { readImage: () => image },
    nativeImage: { createFromPath: () => image },
    io: {
      stat: async () => ({ isFile: () => true }),
    },
    dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) },
    payloadLoader: async (filePath) => ({
      name: filePath.split('\\').at(-1), type: filePath.endsWith('.png') ? 'image/png' : 'text/plain',
      lastModified: 1, data: Buffer.from([1, 2]),
    }),
  })
  const sent = []
  const frame = { send: (...args) => sent.push(args) }
  const tab = {
    view: { getBounds: () => ({ x: 0, y: 84, width: 900, height: 556 }) },
    webContents: { getURL: () => 'https://uploads.example/editor' },
  }
  return { panel, overlay, shown, relayouts, hidden, sender, recentsAdded, frame, tab, sent }
}

test('opens with only matching real recents and a live clipboard image', async () => {
  const h = harness()
  await h.panel.openRequest({
    tab: h.tab, frame: h.frame,
    request: { requestId: 'one', accept: 'image/*', multiple: false },
  })

  assert.equal(h.shown.length, 1)
  assert.equal(h.shown[0].state.origin, 'uploads.example')
  assert.equal(h.shown[0].state.recents.length, 1)
  assert.equal(h.shown[0].state.recents[0].name, 'ember.png')
  assert.equal(h.shown[0].state.clipboard.name.startsWith('clipboard-'), true)
  assert.equal(h.shown[0].state.openSequence, 1)
  assert.equal(h.shown[0].captureBleed, 40)
  assert.deepEqual(h.shown[0].bounds, { x: 125, y: 147, width: 650, height: 430 })
})

test('choosing a recent item installs bytes into the requesting frame and records it', async () => {
  const h = harness()
  await h.panel.openRequest({
    tab: h.tab, frame: h.frame,
    request: { requestId: 'two', accept: 'image/*', multiple: false },
  })
  await h.panel.handleAction(h.sender, 'recent', { path: 'C:\\photos\\ember.png' })

  assert.deepEqual(h.recentsAdded, [['C:\\photos\\ember.png']])
  assert.equal(h.sent[0][0], IPC.UPLOAD_RESULT)
  assert.equal(h.sent[0][1].requestId, 'two')
  assert.equal(h.sent[0][1].files[0].name, 'ember.png')
  assert.equal(h.hidden.length, 1)
})

test('dismissal returns a standard canceled result', async () => {
  const h = harness()
  await h.panel.openRequest({
    tab: h.tab, frame: h.frame,
    request: { requestId: 'three', accept: '', multiple: false },
  })
  h.panel.cancel()
  assert.deepEqual(h.sent[0], [IPC.UPLOAD_RESULT, { requestId: 'three', canceled: true }])
})

test('clears a failed opening so the next file request can proceed', async () => {
  const h = harness()
  h.panel.clipboard.readImage = () => { throw new Error('clipboard unavailable') }
  await assert.rejects(h.panel.openRequest({
    tab: h.tab, frame: h.frame,
    request: { requestId: 'broken', accept: '', multiple: false },
  }), /clipboard unavailable/)
  assert.equal(h.panel.active, null)
})

test('recaptures the upload backdrop with bleed when its panel is laid out again', async () => {
  const h = harness()
  await h.panel.openRequest({
    tab: h.tab, frame: h.frame,
    request: { requestId: 'relayout', accept: '', multiple: false },
  })
  h.panel.layout()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(h.relayouts[0].captureBleed, 40)
  assert.equal(h.relayouts[0].targetView, h.tab.view)
})
