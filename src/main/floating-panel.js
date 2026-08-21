const path = require('node:path')
const { IPC } = require('../shared/ipc')

class FloatingPanel {
  constructor(win, { url, createView } = {}) {
    this.win = win
    this.url = url
    this.createView = createView || (() => {
      const { WebContentsView } = require('electron')
      return new WebContentsView({
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
          preload: path.join(__dirname, '..', 'renderer', 'overlay-preload.js'),
        },
      })
    })
    this.view = null
    this.loaded = false
    this.open = false
    this.bounds = null
    this.state = null
    this.generation = 0
  }

  #ensureView() {
    if (this.view) return this.view
    const view = this.createView()
    this.view = view
    view.setBackgroundColor('#00000000')
    view.webContents.on('did-finish-load', () => {
      this.loaded = true
      this.#sendState()
    })
    view.webContents.loadURL(this.url)
    return view
  }

  async show({ bounds, state, targetView = null, captureBleed = 0 }) {
    const generation = ++this.generation
    const capture = await this.#captureBackdrop(targetView, bounds, captureBleed)
    if (generation !== this.generation) return false
    this.state = {
      ...state,
      backdrop: capture?.dataUrl || null,
      ...(capture?.rect ? { backdropRect: capture.rect } : {}),
    }
    this.bounds = { ...bounds }
    const view = this.#ensureView()
    this.win.contentView.addChildView(view)
    view.setBounds(this.bounds)
    this.open = true
    view.setVisible(true)
    if (this.loaded) this.#sendState()
    view.webContents.focus()
    return true
  }

  setBounds(bounds) {
    this.bounds = { ...bounds }
    if (this.view && this.open) this.view.setBounds(this.bounds)
  }

  async relayout({ bounds, targetView = null, captureBleed = 0 }) {
    if (!this.open) return false
    const generation = ++this.generation
    const capture = await this.#captureBackdrop(targetView, bounds, captureBleed)
    if (generation !== this.generation || !this.open) return false
    const { backdropRect: _oldRect, ...state } = this.state || {}
    this.state = {
      ...state,
      backdrop: capture?.dataUrl || null,
      ...(capture?.rect ? { backdropRect: capture.rect } : {}),
    }
    this.bounds = { ...bounds }
    this.view.setBounds(this.bounds)
    this.#sendState()
    return true
  }

  updateState(state) {
    this.state = { ...this.state, ...state }
    this.#sendState()
  }

  hide() {
    this.generation += 1
    if (!this.open) return
    this.open = false
    this.view?.setVisible(false)
  }

  isSender(webContents) {
    return this.view?.webContents === webContents
  }

  #sendState() {
    if (!this.loaded || !this.state || this.view.webContents.isDestroyed()) return
    this.view.webContents.send(IPC.OVERLAY_STATE, this.state)
  }

  async #captureBackdrop(targetView, bounds, bleed) {
    if (!targetView?.webContents?.capturePage) return null
    const target = targetView.getBounds()
    const localX = Math.round(bounds.x - target.x)
    const localY = Math.round(bounds.y - target.y)
    const x = Math.max(0, localX - bleed)
    const y = Math.max(0, localY - bleed)
    const right = Math.min(target.width, localX + bounds.width + bleed)
    const bottom = Math.min(target.height, localY + bounds.height + bleed)
    const rect = {
      x, y,
      width: Math.max(0, right - x),
      height: Math.max(0, bottom - y),
    }
    try {
      const image = await targetView.webContents.capturePage(rect)
      if (image.isEmpty()) return null
      const size = image.getSize?.()
      return {
        dataUrl: image.toDataURL(),
        rect: {
          x: x - localX, y: y - localY, width: rect.width, height: rect.height,
          ...(size ? { pixelWidth: size.width, pixelHeight: size.height } : {}),
        },
      }
    } catch {
      return null
    }
  }
}

module.exports = { FloatingPanel }
