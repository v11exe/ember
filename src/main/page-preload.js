// Preload for web page tabs. Deliberately minimal: real web pages get nothing.
// Only ember:// internal pages receive an API, and only navigation verbs.
//
// NOTE: this preload runs sandboxed, so it cannot require('../shared/ipc').
// These channel names are the one sanctioned exception to the
// "no channel string literals" rule in AGENTS.md §3. Keep them in sync.
const { contextBridge, ipcRenderer } = require('electron')

const NAV_GO = 'nav:go'
const TAB_CREATE = 'tab:create'
const EXT_OPEN_STORE = 'ext:open-store'
const HISTORY_QUERY = 'history:query'
const HISTORY_DELETE = 'history:delete'
const HISTORY_CLEAR = 'history:clear'
const HISTORY_OPEN = 'history:open'
const DOWNLOADS_QUERY = 'downloads:query'
const DOWNLOADS_ACTION = 'downloads:action'
const DOWNLOADS_CHANGED = 'downloads:changed'
const UPLOAD_REQUEST = 'upload:request'
const UPLOAD_RESULT = 'upload:result'

const uploadTargets = new Map()

function requestId() {
  return globalThis.crypto?.randomUUID?.() || `upload-${Date.now()}-${Math.random()}`
}

function fileInputFrom(event) {
  return event.composedPath().find((node) => node?.matches?.('input[type="file"]')) || null
}

document.addEventListener('click', (event) => {
  const input = fileInputFrom(event)
  if (!input || input.disabled || input.webkitdirectory || event.button !== 0) return
  event.preventDefault()
  event.stopImmediatePropagation()
  const id = requestId()
  uploadTargets.set(id, input)
  ipcRenderer.send(UPLOAD_REQUEST, {
    requestId: id,
    accept: input.accept || '',
    multiple: !!input.multiple,
  })
}, true)

ipcRenderer.on(UPLOAD_RESULT, (_event, result) => {
  const input = uploadTargets.get(result?.requestId)
  if (!input) return
  uploadTargets.delete(result.requestId)
  if (!input.isConnected) return
  if (result.canceled) {
    input.dispatchEvent(new Event('cancel', { bubbles: true }))
    return
  }

  const transfer = new DataTransfer()
  const files = input.multiple ? result.files : result.files.slice(0, 1)
  for (const file of files) {
    transfer.items.add(new File([new Uint8Array(file.data)], file.name, {
      type: file.type,
      lastModified: file.lastModified,
    }))
  }
  input.files = transfer.files
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
})

if (location.protocol === 'ember:') {
  contextBridge.exposeInMainWorld('ember', {
    navigate: (url) => ipcRenderer.send(NAV_GO, String(url)),
    newTab: (url) => ipcRenderer.send(TAB_CREATE, String(url)),
    openStore: () => ipcRenderer.send(EXT_OPEN_STORE),
    history: {
      query: () => ipcRenderer.invoke(HISTORY_QUERY),
      remove: (ids) => ipcRenderer.invoke(HISTORY_DELETE, ids),
      clear: (range) => ipcRenderer.invoke(HISTORY_CLEAR, range),
      open: (url) => ipcRenderer.send(HISTORY_OPEN, String(url)),
    },
    downloads: {
      query: () => ipcRenderer.invoke(DOWNLOADS_QUERY),
      action: (action, id) => ipcRenderer.invoke(DOWNLOADS_ACTION, { action, id }),
      onChange: (fn) => ipcRenderer.on(DOWNLOADS_CHANGED, (_event, snapshot) => fn(snapshot)),
    },
  })
}
