const { contextBridge, ipcRenderer } = require('electron')
const { IPC } = require('../shared/ipc')

contextBridge.exposeInMainWorld('emberCornerMask', {
  send: (input) => ipcRenderer.send(IPC.CORNER_MASK_INPUT, input),
})
