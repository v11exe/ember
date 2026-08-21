const { contextBridge, ipcRenderer } = require('electron')
const { IPC } = require('../shared/ipc')

// Defines <browser-action-list> AND exposes window.browserAction, which is what
// lets the panel activate an extension from its own row icon.
try {
  const { injectBrowserAction } = require('electron-chrome-extensions/browser-action')
  injectBrowserAction()
} catch (err) {
  console.warn('[ember] browser-action API unavailable:', err.message)
}

contextBridge.exposeInMainWorld('emberPanel', {
  list: () => ipcRenderer.invoke(IPC.EXT_LIST),
  remove: (id) => ipcRenderer.invoke(IPC.EXT_REMOVE, id),
  openStore: () => ipcRenderer.send(IPC.EXT_OPEN_STORE),
  close: () => ipcRenderer.send(IPC.PANEL_CLOSE),
  resize: (height) => ipcRenderer.send(IPC.PANEL_RESIZE, height),
  onOrigin: (fn) => ipcRenderer.on(IPC.PANEL_ORIGIN, (_e, origin) => fn(origin)),
})
