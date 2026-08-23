const { contextBridge, ipcRenderer } = require('electron')
const { IPC } = require('../shared/ipc')

contextBridge.exposeInMainWorld('emberShell', {
  onShellMetrics: (fn) => ipcRenderer.on(IPC.SHELL_METRICS, (_event, metrics) => fn(metrics)),
})
