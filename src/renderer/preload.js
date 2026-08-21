const { contextBridge, ipcRenderer } = require('electron')
const { IPC } = require('../shared/ipc')

// Gives extension toolbar buttons (<browser-action-list>) to the chrome UI.
try {
  require('electron-chrome-extensions/browser-action')
} catch (err) {
  console.warn('[ember] browser-action element unavailable:', err.message)
}

contextBridge.exposeInMainWorld('ember', {
  onState: (fn) => ipcRenderer.on(IPC.STATE, (_e, state) => fn(state)),

  newTab: (url) => ipcRenderer.send(IPC.TAB_CREATE, url),
  closeTab: (id) => ipcRenderer.send(IPC.TAB_CLOSE, id),
  selectTab: (id) => ipcRenderer.send(IPC.TAB_SELECT, id),

  go: (input) => ipcRenderer.send(IPC.NAV_GO, input),
  back: () => ipcRenderer.send(IPC.NAV_BACK),
  forward: () => ipcRenderer.send(IPC.NAV_FORWARD),
  reload: () => ipcRenderer.send(IPC.NAV_RELOAD),
  stop: () => ipcRenderer.send(IPC.NAV_STOP),
  openStore: () => ipcRenderer.send(IPC.EXT_OPEN_STORE),

  minimize: () => ipcRenderer.send(IPC.WIN_MINIMIZE),
  maximize: () => ipcRenderer.send(IPC.WIN_MAXIMIZE),
  close: () => ipcRenderer.send(IPC.WIN_CLOSE),
})
