const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const { IPC } = require('../src/shared/ipc')

function boot({ selection = null } = {}) {
  const domListeners = new Map()
  const windowListeners = new Map()
  const ipcListeners = new Map()
  const timers = []
  const sent = []
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'page-preload.js'), 'utf8')
  class TestFile {
    constructor(parts, name, options) { this.parts = parts; this.name = name; Object.assign(this, options) }
  }
  class TestTransfer {
    constructor() {
      this.files = []
      this.items = { add: (file) => this.files.push(file) }
    }
  }
  const electron = {
    contextBridge: { exposeInMainWorld: () => {} },
    ipcRenderer: {
      on: (channel, fn) => ipcListeners.set(channel, fn),
      send: (...args) => sent.push(args),
    },
  }
  const sandbox = {
    location: { protocol: 'https:' },
    document: { addEventListener: (type, fn) => domListeners.set(type, fn) },
    window: {
      addEventListener: (type, fn) => windowListeners.set(type, fn),
      getSelection: () => selection,
    },
    // The selection reporter debounces; run its callback when a test asks.
    setTimeout: (fn) => { timers.push(fn); return timers.length },
    clearTimeout: (id) => { if (id) timers[id - 1] = null },
    crypto: { randomUUID: () => 'request-1' },
    DataTransfer: TestTransfer,
    File: TestFile,
    Event: class { constructor(type, options) { this.type = type; Object.assign(this, options) } },
    Uint8Array,
  }
  const sandboxRequire = (id) => {
    if (id === 'electron') return electron
    throw new Error(`Unexpected require: ${id}`)
  }
  vm.runInNewContext(`(function(require){${source}\n})`, sandbox)(sandboxRequire)
  const flush = () => { for (const timer of timers.splice(0)) timer?.() }
  return { domListeners, windowListeners, ipcListeners, sent, flush }
}

/** A DOM Selection stand-in with one range. */
function selectionOf(text, rect = { left: 40, top: 120, width: 60, height: 18 }) {
  return {
    isCollapsed: !text,
    toString: () => text,
    getRangeAt: () => ({ getBoundingClientRect: () => rect }),
  }
}

function fileInput() {
  const dispatched = []
  return {
    tagName: 'INPUT', type: 'file', accept: 'image/*', multiple: false,
    disabled: false, isConnected: true, files: [],
    matches: (selector) => selector === 'input[type="file"]',
    dispatchEvent: (event) => dispatched.push(event.type),
    dispatched,
  }
}

test('intercepts a real file-input click before Chromium opens its native chooser', () => {
  const { domListeners, sent } = boot()
  const input = fileInput()
  let prevented = false
  domListeners.get('click')({
    button: 0, target: input, composedPath: () => [input],
    preventDefault: () => { prevented = true }, stopImmediatePropagation: () => {},
  })

  assert.equal(prevented, true)
  assert.equal(sent[0][0], IPC.UPLOAD_REQUEST)
  assert.deepEqual(JSON.parse(JSON.stringify(sent[0][1])), {
    requestId: 'request-1', accept: 'image/*', multiple: false,
  })
})

test('installs selected bytes as real File objects and dispatches input/change', () => {
  const { domListeners, ipcListeners } = boot()
  const input = fileInput()
  domListeners.get('click')({
    button: 0, target: input, composedPath: () => [input],
    preventDefault: () => {}, stopImmediatePropagation: () => {},
  })
  ipcListeners.get(IPC.UPLOAD_RESULT)(null, {
    requestId: 'request-1',
    files: [{ name: 'ember.png', type: 'image/png', lastModified: 123, data: new Uint8Array([1, 2, 3]) }],
  })

  assert.equal(input.files.length, 1)
  assert.equal(input.files[0].name, 'ember.png')
  assert.deepEqual(input.dispatched, ['input', 'change'])
})

test('dispatches the standard cancel event when the Ember picker is dismissed', () => {
  const { domListeners, ipcListeners } = boot()
  const input = fileInput()
  domListeners.get('click')({
    button: 0, target: input, composedPath: () => [input],
    preventDefault: () => {}, stopImmediatePropagation: () => {},
  })
  ipcListeners.get(IPC.UPLOAD_RESULT)(null, { requestId: 'request-1', canceled: true })
  assert.deepEqual(input.dispatched, ['cancel'])
})

test('leaves directory upload inputs to Chromium', () => {
  const { domListeners, sent } = boot()
  const input = { ...fileInput(), webkitdirectory: true }
  let prevented = false
  domListeners.get('click')({
    button: 0, target: input, composedPath: () => [input],
    preventDefault: () => { prevented = true }, stopImmediatePropagation: () => {},
  })

  assert.equal(prevented, false)
  assert.deepEqual(sent, [])
})

// ---- selected text, reported for the conversion popup ----

test('a selection is reported with the rect the popup anchors to', () => {
  const app = boot({ selection: selectionOf('  $79.99  ') })
  app.domListeners.get('selectionchange')()
  app.flush()
  assert.equal(app.sent.length, 1)
  assert.equal(app.sent[0][0], IPC.SELECTION_CHANGED)
  assert.deepEqual(JSON.parse(JSON.stringify(app.sent[0][1])), {
    text: '$79.99',
    rect: { x: 40, y: 120, width: 60, height: 18 },
  })
})

test('nothing is sent for an empty or absurdly long selection', () => {
  for (const text of ['', '   ', 'x'.repeat(200)]) {
    const app = boot({ selection: selectionOf(text) })
    app.domListeners.get('selectionchange')()
    app.flush()
    assert.deepEqual(app.sent, [], `"${text.slice(0, 12)}" should stay on the page`)
  }
})

test('clearing a selection retracts the previous report exactly once', () => {
  const selection = selectionOf('15 miles')
  const app = boot({ selection })
  app.domListeners.get('selectionchange')()
  app.flush()
  assert.equal(app.sent.length, 1)

  selection.isCollapsed = true
  selection.toString = () => ''
  app.domListeners.get('selectionchange')()
  app.flush()
  assert.equal(app.sent[1][0], IPC.SELECTION_CHANGED)
  assert.deepEqual(JSON.parse(JSON.stringify(app.sent[1][1])), { text: '' })

  app.domListeners.get('selectionchange')()
  app.flush()
  assert.equal(app.sent.length, 2, 'an already empty selection says nothing further')
})

test('scrolling retracts the report, because the anchor has moved', () => {
  const app = boot({ selection: selectionOf('32°F') })
  app.domListeners.get('selectionchange')()
  app.flush()
  app.windowListeners.get('scroll')()
  assert.equal(app.sent.at(-1)[0], IPC.SELECTION_CHANGED)
  assert.deepEqual(JSON.parse(JSON.stringify(app.sent.at(-1)[1])), { text: '' })
})
