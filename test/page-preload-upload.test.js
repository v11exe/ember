const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const { IPC } = require('../src/shared/ipc')

function boot() {
  const domListeners = new Map()
  const ipcListeners = new Map()
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
  return { domListeners, ipcListeners, sent }
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
