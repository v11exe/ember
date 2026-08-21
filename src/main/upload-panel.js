const fs = require('node:fs/promises')
const path = require('node:path')
const { FloatingPanel } = require('./floating-panel')
const { centerPanel } = require('../shared/floating-geometry')
const { dialogFiltersForAccept, matchesAccept, mimeForPath } = require('../shared/file-selection')
const { payloadFromPath, payloadFromClipboardImage } = require('./upload-files')
const { IPC } = require('../shared/ipc')

const DESIRED_SIZE = { width: 650, height: 430 }

class UploadPanel {
  constructor(win, {
    overlay = new FloatingPanel(win, { url: 'ember://upload' }),
    recents,
    dialog,
    clipboard,
    nativeImage,
    io = fs,
    payloadLoader = payloadFromPath,
  }) {
    this.win = win
    this.overlay = overlay
    this.recents = recents
    this.dialog = dialog
    this.clipboard = clipboard
    this.nativeImage = nativeImage
    this.io = io
    this.payloadLoader = payloadLoader
    this.active = null
    this.recentPaths = new Set()
    this.clipboardPayload = null
    this.openGeneration = 0
    this.openSequence = 0
  }

  async openRequest({ tab, frame, request }) {
    if (this.active) this.cancel()
    const generation = ++this.openGeneration
    this.active = { tab, frame, request }
    try {
      const state = await this.#stateFor(request, tab)
      if (generation !== this.openGeneration || this.active?.request !== request) return
      state.openSequence = ++this.openSequence
      const bounds = centerPanel(tab.view.getBounds(), DESIRED_SIZE, 12)
      await this.overlay.show({ bounds, state, targetView: tab.view })
    } catch (error) {
      if (generation === this.openGeneration && this.active?.request === request) {
        this.active = null
        this.overlay.hide()
      }
      throw error
    }
  }

  isSender(webContents) {
    return this.overlay.isSender(webContents)
  }

  async handleAction(sender, action, payload = {}) {
    if (!this.isSender(sender) || !this.active) return false
    try {
      if (action === 'browse') await this.#browse()
      else if (action === 'recent') await this.#chooseRecent(payload.path)
      else if (action === 'clipboard') await this.#chooseClipboard()
      else return false
    } catch (error) {
      this.overlay.updateState({ error: error.message || 'The file could not be selected.' })
    }
    return true
  }

  cancel() {
    if (!this.active) return
    this.openGeneration += 1
    const { frame, request } = this.active
    this.#send(frame, { requestId: request.requestId, canceled: true })
    this.active = null
    this.overlay.hide()
  }

  layout() {
    if (!this.active) return
    this.overlay.setBounds(centerPanel(this.active.tab.view.getBounds(), DESIRED_SIZE, 12))
  }

  async #stateFor(request, tab) {
    const recents = []
    this.recentPaths.clear()
    for (const item of this.recents.snapshot()) {
      try {
        const stat = await this.io.stat(item.path)
        if (!stat.isFile()) continue
        const descriptor = {
          path: item.path,
          name: path.basename(item.path),
          type: mimeForPath(item.path),
        }
        if (!matchesAccept(descriptor, request.accept)) continue
        descriptor.thumbnail = await this.#thumbnail(item.path, descriptor.type)
        recents.push(descriptor)
        this.recentPaths.add(item.path)
      } catch { /* stale recent entries stay persisted but are hidden */ }
    }

    const clipboardImage = this.clipboard.readImage()
    this.clipboardPayload = payloadFromClipboardImage(clipboardImage)
    if (this.clipboardPayload && !matchesAccept(this.clipboardPayload, request.accept)) {
      this.clipboardPayload = null
    }
    const clipboard = this.clipboardPayload ? {
      name: this.clipboardPayload.name,
      type: this.clipboardPayload.type,
      thumbnail: clipboardImage.resize({ width: 180, quality: 'best' }).toDataURL(),
    } : null

    let origin = 'This page'
    try { origin = new URL(tab.webContents.getURL()).hostname || origin } catch { /* keep fallback */ }
    return {
      kind: 'upload',
      origin,
      accept: request.accept,
      multiple: request.multiple,
      clipboard,
      recents,
      error: '',
    }
  }

  async #thumbnail(filePath, type) {
    try {
      const image = type.startsWith('image/')
        ? this.nativeImage.createFromPath(filePath)
        : await this.nativeImage.createThumbnailFromPath(filePath, { width: 160, height: 120 })
      if (!image || image.isEmpty()) return null
      return image.resize({ width: 160, quality: 'best' }).toDataURL()
    } catch {
      return null
    }
  }

  async #browse() {
    const { request } = this.active
    const result = await this.dialog.showOpenDialog(this.win, {
      title: 'Choose files for upload',
      buttonLabel: 'Choose',
      properties: request.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
      filters: dialogFiltersForAccept(request.accept),
    })
    if (!result.canceled && result.filePaths.length) await this.#choosePaths(result.filePaths)
  }

  async #chooseRecent(filePath) {
    if (!this.recentPaths.has(filePath)) throw new Error('That recent file is no longer available.')
    await this.#choosePaths([filePath])
  }

  async #chooseClipboard() {
    if (!this.clipboardPayload) throw new Error('The clipboard no longer contains an accepted image.')
    this.#complete([this.clipboardPayload])
  }

  async #choosePaths(paths) {
    const { request } = this.active
    const selected = request.multiple ? paths : paths.slice(0, 1)
    const files = await Promise.all(selected.map((filePath) => this.payloadLoader(filePath)))
    try { await this.recents.add(selected) } catch (error) {
      console.warn('[ember] recent uploads could not be saved:', error.message)
    }
    this.#complete(files)
  }

  #complete(files) {
    if (!this.active) return
    this.openGeneration += 1
    const { frame, request } = this.active
    this.#send(frame, { requestId: request.requestId, files })
    this.active = null
    this.overlay.hide()
  }

  #send(frame, result) {
    if (typeof frame?.isDestroyed === 'function' && frame.isDestroyed()) return
    try { frame?.send(IPC.UPLOAD_RESULT, result) } catch { /* requesting page navigated away */ }
  }
}

module.exports = { UploadPanel, DESIRED_SIZE }
