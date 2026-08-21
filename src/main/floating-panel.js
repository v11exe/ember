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

  async show({ bounds, state, targetView = null }) {
    const generation = ++this.generation
    const backdrop = await this.#captureBackdrop(targetView, bounds)
    if (generation !== this.generation) return false
    this.state = { ...state, backdrop }
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

  async #captureBackdrop(targetView, bounds) {
    if (!targetView?.webContents?.capturePage) return null
    const target = targetView.getBounds()
    const rect = {
      x: Math.max(0, Math.round(bounds.x - target.x)),
      y: Math.max(0, Math.round(bounds.y - target.y)),
      width: Math.min(bounds.width, target.width),
      height: Math.min(bounds.height, target.height),
    }
    try {
      const image = await targetView.webContents.capturePage(rect)
      return image.isEmpty() ? null : image.toDataURL()
    } catch {
      return null
    }
  }
}

module.exports = { FloatingPanel }
