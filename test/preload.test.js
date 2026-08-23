const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const { IPC } = require('../src/shared/ipc')

test('chrome preload exposes a working extensions-panel toggle', () => {
  const sent = []
  const listeners = new Map()
  let exposed
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'preload.js'), 'utf8')
  const electron = {
    contextBridge: { exposeInMainWorld: (_name, api) => { exposed = api } },
    ipcRenderer: {
      on: (channel, fn) => listeners.set(channel, fn),
      send: (...args) => sent.push(args),
      invoke: async () => undefined,
    },
  }
  const sandboxRequire = (id) => {
    if (id === 'electron') return electron
    if (id === '../shared/ipc') return { IPC }
    if (id === '../shared/urls') return require('../src/shared/urls')
    if (id === '../shared/chrome-layout') return require('../src/shared/chrome-layout')
    if (id === '../shared/favorites') return require('../src/shared/favorites')
    if (id === 'electron-chrome-extensions/browser-action') return { injectBrowserAction: () => {} }
    throw new Error(`Unexpected require: ${id}`)
  }

  vm.runInNewContext(`(function(require){${source}\n})`, {})(sandboxRequire)
  assert.equal(typeof exposed.togglePanel, 'function')
  exposed.togglePanel()
  assert.deepEqual(sent, [[IPC.PANEL_TOGGLE]])

  let panelOpen
  exposed.onPanelChanged((open) => { panelOpen = open })
  listeners.get(IPC.PANEL_CHANGED)(null, true)
  assert.equal(panelOpen, true)
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
    if (id === '../shared/urls') return require('../src/shared/urls')
    if (id === '../shared/chrome-layout') return require('../src/shared/chrome-layout')
    if (id === '../shared/favorites') return require('../src/shared/favorites')
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

/** Boot the chrome preload against stub IPC and hand back what it exposed. */
function bootPreload({ bangs = [], chromeConfig = null } = {}) {
  const sent = []
  const invoked = []
  const listeners = new Map()
  let exposed
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'preload.js'), 'utf8')
  const electron = {
    contextBridge: { exposeInMainWorld: (_name, api) => { exposed = api } },
    ipcRenderer: {
      on: (channel, fn) => listeners.set(channel, fn),
      send: (...args) => sent.push(args),
      invoke: async (channel, payload) => {
        invoked.push([channel, payload])
        if (channel === IPC.BANGS_GET) return bangs
        if (channel === IPC.CHROME_CONFIG_GET) return chromeConfig
        return { channel }
      },
    },
  }
  const sandboxRequire = (id) => {
    if (id === 'electron') return electron
    if (id === '../shared/ipc') return { IPC }
    if (id === '../shared/urls') return require('../src/shared/urls')
    if (id === '../shared/chrome-layout') return require('../src/shared/chrome-layout')
    if (id === '../shared/favorites') return require('../src/shared/favorites')
    if (id === 'electron-chrome-extensions/browser-action') return { injectBrowserAction: () => {} }
    throw new Error(`Unexpected require: ${id}`)
  }
  vm.runInNewContext(`(function(require){${source}\n})`, {})(sandboxRequire)
  return { exposed, listeners, sent, invoked }
}

test('chrome preload bridges live shell configuration and Favorite actions', async () => {
  const chromeConfig = { sidebarOpen: true, favorites: [{ id: 'youtube' }] }
  const { exposed, listeners, sent, invoked } = bootPreload({ chromeConfig })

  assert.deepEqual(await exposed.getChromeConfig(), chromeConfig)
  exposed.setSidebarOpen(false)
  exposed.openFavorite('youtube')
  exposed.reorderTab(4, 2)
  assert.deepEqual(await exposed.pinFavoriteFromTab(4, 3), { channel: IPC.FAVORITE_PIN_TAB })
  assert.deepEqual(await exposed.moveFavorite('youtube', 1), { channel: IPC.FAVORITE_MOVE })
  exposed.favoriteContextMenu('youtube', 44, 58)
  assert.equal(exposed.tabMaximum({ availableWidth: 800, count: 5 }), 127)
  assert.equal(exposed.sameFavoriteSite('https://www.youtube.com/', 'https://youtube.com/watch?v=x'), true)
  assert.deepEqual(JSON.parse(JSON.stringify(sent)), [
    [IPC.SIDEBAR_SET, false],
    [IPC.FAVORITE_OPEN, 'youtube'],
    [IPC.TAB_REORDER, { id: 4, beforeId: 2 }],
    [IPC.FAVORITE_CONTEXT_MENU, { id: 'youtube', x: 44, y: 58 }],
  ])
  assert.deepEqual(JSON.parse(JSON.stringify(invoked.slice(1))), [
    [IPC.FAVORITE_PIN_TAB, { id: 4, index: 3 }],
    [IPC.FAVORITE_MOVE, { id: 'youtube', index: 1 }],
  ])

  let update = null
  exposed.onChromeConfig((config) => { update = config })
  listeners.get(IPC.CHROME_CONFIG_CHANGED)(null, { sidebarOpen: false, favorites: [] })
  assert.deepEqual(update, { sidebarOpen: false, favorites: [] })

  let windowState = null
  exposed.onWindowState((state) => { windowState = state })
  listeners.get(IPC.WIN_STATE)(null, { maximized: true })
  assert.deepEqual(windowState, { maximized: true })

  let shellMetrics = null
  exposed.onShellMetrics((metrics) => { shellMetrics = metrics })
  listeners.get(IPC.SHELL_METRICS)(null, { width: 900, height: 640, x: 0, y: 0 })
  assert.deepEqual(shellMetrics, { width: 900, height: 640, x: 0, y: 0 })
})

test('the omnibox can ask what Enter will do without leaving the renderer', () => {
  const { exposed } = bootPreload()
  // Built-ins answer before the list has even been fetched.
  const bang = exposed.resolveInput('yt liquid glass')
  assert.equal(bang.kind, 'bang')
  assert.equal(bang.name, 'YouTube')
  assert.equal(bang.term, 'liquid glass')
  assert.equal(exposed.resolveInput('example.com').kind, 'site')
  assert.equal(exposed.resolveInput(''), null)
})

test('a pushed list changes the answer immediately, with no round trip', () => {
  const { exposed, listeners } = bootPreload()
  assert.equal(exposed.resolveInput('ember bug').kind, 'search', 'not a keyword yet')

  listeners.get(IPC.BANGS_CHANGED)(null, [{ alias: 'ember', name: 'Ember issues', url: 'https://x.test/?q=%s' }])
  const added = exposed.resolveInput('ember bug')
  assert.equal(added.name, 'Ember issues')
  assert.equal(added.url, 'https://x.test/?q=bug')

  listeners.get(IPC.BANGS_CHANGED)(null, [{ alias: 'yt', removed: true }])
  assert.equal(exposed.resolveInput('yt cats').kind, 'search', 'a removed built-in stops matching')
})

test('the initial fetch fills the table too', async () => {
  const { exposed } = bootPreload({ bangs: [{ alias: 'zz', name: 'Zed', url: 'https://z.test/?q=%s' }] })
  assert.equal(exposed.resolveInput('zz thing').kind, 'search', 'before the fetch resolves')
  await exposed.loadBangs()
  assert.equal(exposed.resolveInput('zz thing').name, 'Zed')
})

test('a garbled push does not break matching', () => {
  const { exposed, listeners } = bootPreload()
  listeners.get(IPC.BANGS_CHANGED)(null, null)
  assert.equal(exposed.resolveInput('yt cats').name, 'YouTube', 'falls back to the built-ins')
})
