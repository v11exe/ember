const { contextBridge, ipcRenderer } = require('electron')
const { IPC } = require('../shared/ipc')

contextBridge.exposeInMainWorld('emberOverlay', {
  onState: (fn) => ipcRenderer.on(IPC.OVERLAY_STATE, (_event, state) => fn(state)),
  action: (action, payload) => ipcRenderer.send(IPC.OVERLAY_ACTION, action, payload),
  close: () => ipcRenderer.send(IPC.OVERLAY_CLOSE),
})
