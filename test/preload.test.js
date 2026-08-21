const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const { IPC } = require('../src/shared/ipc')

test('chrome preload exposes a working extensions-panel toggle', () => {
  const sent = []
  let exposed
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'preload.js'), 'utf8')
  const electron = {
    contextBridge: { exposeInMainWorld: (_name, api) => { exposed = api } },
    ipcRenderer: {
      on: () => {},
      send: (...args) => sent.push(args),
      invoke: async () => undefined,
    },
  }
  const sandboxRequire = (id) => {
    if (id === 'electron') return electron
    if (id === '../shared/ipc') return { IPC }
    if (id === 'electron-chrome-extensions/browser-action') return { injectBrowserAction: () => {} }
    throw new Error(`Unexpected require: ${id}`)
  }

  vm.runInNewContext(`(function(require){${source}\n})`, {})(sandboxRequire)
  assert.equal(typeof exposed.togglePanel, 'function')
  exposed.togglePanel()
  assert.deepEqual(sent, [[IPC.PANEL_TOGGLE]])
})

test('chrome preload exposes bookmark import, visibility, and live updates', async () => {
  const sent = []
  const listeners = new Map()
  let exposed
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'preload.js'), 'utf8')
  const electron = {
    contextBridge: { exposeInMainWorld: (_name, api) => { exposed = api } },
    ipcRenderer: {
      on: (channel, fn) => listeners.set(channel, fn),
      send: (...args) => sent.push(args),
      invoke: async (channel) => ({ channel }),
    },
  }
  const sandboxRequire = (id) => {
    if (id === 'electron') return electron
    if (id === '../shared/ipc') return { IPC }
    if (id === 'electron-chrome-extensions/browser-action') return { injectBrowserAction: () => {} }
    throw new Error(`Unexpected require: ${id}`)
  }

  vm.runInNewContext(`(function(require){${source}\n})`, {})(sandboxRequire)
  assert.deepEqual(await exposed.getBookmarks(), { channel: IPC.BOOKMARKS_GET })
  assert.deepEqual(await exposed.importBookmarks(), { channel: IPC.BOOKMARKS_IMPORT })
  exposed.setBookmarksVisible(true)
  assert.deepEqual(sent, [[IPC.BOOKMARKS_VISIBILITY, true]])
  let update
  exposed.onBookmarks((snapshot) => { update = snapshot })
  listeners.get(IPC.BOOKMARKS_CHANGED)(null, { visible: true, items: [] })
  assert.deepEqual(update, { visible: true, items: [] })
})
