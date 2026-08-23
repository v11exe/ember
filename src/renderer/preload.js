const { contextBridge, ipcRenderer } = require('electron')
const { IPC } = require('../shared/ipc')

// Defines the <browser-action-list> element used by the extensions panel.
// Requiring the module is not enough — it has to be invoked.
try {
  const { injectBrowserAction } = require('electron-chrome-extensions/browser-action')
  injectBrowserAction()
} catch (err) {
  console.warn('[ember] browser-action element unavailable:', err.message)
}

contextBridge.exposeInMainWorld('ember', {
  onState: (fn) => ipcRenderer.on(IPC.STATE, (_e, state) => fn(state)),

  newTab: (url) => ipcRenderer.send(IPC.TAB_CREATE, url),
  closeTab: (id) => ipcRenderer.send(IPC.TAB_CLOSE, id),
  selectTab: (id) => ipcRenderer.send(IPC.TAB_SELECT, id),
  tabContextMenu: (id, x) => ipcRenderer.send(IPC.TAB_CONTEXT_MENU, { id, x }),
  openArchived: () => ipcRenderer.invoke(IPC.ARCHIVE_OPEN),

  go: (input) => ipcRenderer.send(IPC.NAV_GO, input),
  back: () => ipcRenderer.send(IPC.NAV_BACK),
  forward: () => ipcRenderer.send(IPC.NAV_FORWARD),
  reload: () => ipcRenderer.send(IPC.NAV_RELOAD),
  stop: () => ipcRenderer.send(IPC.NAV_STOP),
  openStore: () => ipcRenderer.send(IPC.EXT_OPEN_STORE),
  listExtensions: () => ipcRenderer.invoke(IPC.EXT_LIST),
  removeExtension: (id) => ipcRenderer.invoke(IPC.EXT_REMOVE, id),
  togglePanel: () => ipcRenderer.send(IPC.PANEL_TOGGLE),
  onPanelChanged: (fn) => ipcRenderer.on(IPC.PANEL_CHANGED, (_e, open) => fn(open)),
  getBookmarks: () => ipcRenderer.invoke(IPC.BOOKMARKS_GET),
  importBookmarks: () => ipcRenderer.invoke(IPC.BOOKMARKS_IMPORT),
  setBookmarksVisible: (visible) => ipcRenderer.send(IPC.BOOKMARKS_VISIBILITY, !!visible),
  onBookmarks: (fn) => ipcRenderer.on(IPC.BOOKMARKS_CHANGED, (_e, snapshot) => fn(snapshot)),

  minimize: () => ipcRenderer.send(IPC.WIN_MINIMIZE),
  maximize: () => ipcRenderer.send(IPC.WIN_MAXIMIZE),
  close: () => ipcRenderer.send(IPC.WIN_CLOSE),
})
