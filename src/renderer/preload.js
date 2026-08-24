const { contextBridge, ipcRenderer } = require('electron')
const { IPC } = require('../shared/ipc')
const { resolveInput } = require('../shared/urls')
const { dynamicTabMax } = require('../shared/chrome-layout')
const { sameFavoriteSite, placeFavorite } = require('../shared/favorites')

// The omnibox has to say what Enter will do while you are still typing, and it
// has to do it on every keystroke. Keeping the quick-search list here means the
// answer is a synchronous function call rather than a trip to the main process
// — and it comes from the same resolver main will use, so the preview cannot
// disagree with what actually happens.
let bangs = []
ipcRenderer.on(IPC.BANGS_CHANGED, (_event, list) => { bangs = Array.isArray(list) ? list : [] })

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
  reorderTab: (id, beforeId = null) => ipcRenderer.send(IPC.TAB_REORDER, { id, beforeId }),
  tabContextMenu: (id, x) => ipcRenderer.send(IPC.TAB_CONTEXT_MENU, { id, x }),
  openArchived: () => ipcRenderer.invoke(IPC.ARCHIVE_OPEN),

  go: (input) => ipcRenderer.send(IPC.NAV_GO, input),
  /** What pressing Enter on this text would do. Synchronous by design. */
  resolveInput: (input) => resolveInput(input, { bangs }),
  loadBangs: async () => { bangs = (await ipcRenderer.invoke(IPC.BANGS_GET)) || []; return bangs },
  onBangsChanged: (fn) => ipcRenderer.on(IPC.BANGS_CHANGED, (_e, list) => fn(list)),
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
  getChromeConfig: () => ipcRenderer.invoke(IPC.CHROME_CONFIG_GET),
  onChromeConfig: (fn) => ipcRenderer.on(IPC.CHROME_CONFIG_CHANGED, (_e, config) => fn(config)),
  setSidebarOpen: (open) => ipcRenderer.send(IPC.SIDEBAR_SET, !!open),
  openFavorite: (id) => ipcRenderer.send(IPC.FAVORITE_OPEN, String(id)),
  pinFavoriteFromTab: (id, index) => ipcRenderer.invoke(IPC.FAVORITE_PIN_TAB, {
    id: Number(id), index: Number(index),
  }),
  moveFavorite: (id, index) => ipcRenderer.invoke(IPC.FAVORITE_MOVE, {
    id: String(id), index: Number(index),
  }),
  favoriteContextMenu: (id, x, y) => ipcRenderer.send(IPC.FAVORITE_CONTEXT_MENU, {
    id: String(id), x: Number(x) || 0, y: Number(y) || 0,
  }),
  removeFavorite: (id) => ipcRenderer.invoke(IPC.FAVORITE_REMOVE, String(id)),
  tabMaximum: (options) => dynamicTabMax(options),
  sameFavoriteSite: (favoriteUrl, tabUrl) => sameFavoriteSite(favoriteUrl, tabUrl),
  previewFavoritePlacement: (candidate, current, grid, index) => placeFavorite(candidate, current, grid, index),
  onNavPulse: (fn) => ipcRenderer.on(IPC.NAV_PULSE, (_e, command) => fn(command)),
  onWindowState: (fn) => ipcRenderer.on(IPC.WIN_STATE, (_e, state) => fn(state)),
  onShellMetrics: (fn) => ipcRenderer.on(IPC.SHELL_METRICS, (_e, metrics) => fn(metrics)),

  minimize: () => ipcRenderer.send(IPC.WIN_MINIMIZE),
  maximize: () => ipcRenderer.send(IPC.WIN_MAXIMIZE),
  close: () => ipcRenderer.send(IPC.WIN_CLOSE),
  beginWindowDrag: (x, y) => ipcRenderer.invoke(IPC.WIN_DRAG_START, { x, y }),
  updateWindowDrag: (x, y) => ipcRenderer.send(IPC.WIN_DRAG_MOVE, { x, y }),
  endWindowDrag: () => ipcRenderer.send(IPC.WIN_DRAG_END),
})
