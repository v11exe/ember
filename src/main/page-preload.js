// Preload for web page tabs. Deliberately minimal: real web pages get nothing.
// Only ember:// internal pages receive an API, and only navigation verbs.
//
// NOTE: this preload runs sandboxed, so it cannot require('../shared/ipc').
// These two channel names are the one sanctioned exception to the
// "no channel string literals" rule in AGENTS.md §3. Keep them in sync.
const { contextBridge, ipcRenderer } = require('electron')

const NAV_GO = 'nav:go'
const TAB_CREATE = 'tab:create'
const EXT_OPEN_STORE = 'ext:open-store'

if (location.protocol === 'ember:') {
  contextBridge.exposeInMainWorld('ember', {
    navigate: (url) => ipcRenderer.send(NAV_GO, String(url)),
    newTab: (url) => ipcRenderer.send(TAB_CREATE, String(url)),
    openStore: () => ipcRenderer.send(EXT_OPEN_STORE),
  })
}
