const path = require('node:path')
const { WebContentsView } = require('electron')
const { IPC } = require('../shared/ipc')

/**
 * The extensions dropdown, hosted in its own WebContentsView.
 *
 * It deliberately does NOT share the chrome view: that view spans the window
 * width, so growing it to fit a dropdown blacked out the whole page underneath.
 * A separately sized view only ever covers the pixels the panel occupies.
 */
const WIDTH = 306
const MARGIN = 10
const TOP = 78 // just below the 84px chrome bar, slightly overlapping

class ExtensionPanel {
  constructor(win) {
    this.win = win
    this.view = null
    this.open = false
    this.height = 240
  }

  #ensureView() {
    if (this.view) return this.view
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false, // needs injectBrowserAction() + the shared IPC contract
        preload: path.join(__dirname, '..', 'renderer', 'panel-preload.js'),
      },
    })
    view.setBackgroundColor('#00000000')
    view.webContents.loadURL('ember://extensions')
    this.view = view
    return view
  }

  toggle() { this.open ? this.hide() : this.show() }

  show() {
    const view = this.#ensureView()
    this.win.contentView.addChildView(view) // topmost
    this.open = true
    this.layout()
    view.setVisible(true)
    view.webContents.focus()
  }

  hide() {
    if (!this.view) return
    this.open = false
    this.view.setVisible(false)
  }

  setHeight(height) {
    this.height = Math.max(80, Math.round(height))
    if (this.open) this.layout()
  }

  layout() {
    if (!this.view || !this.open) return
    const { width, height } = this.win.getContentBounds()
    const h = Math.min(this.height, height - TOP - MARGIN)
    const bounds = { x: Math.max(MARGIN, width - WIDTH - MARGIN), y: TOP, width: WIDTH, height: h }
    this.view.setBounds(bounds)
    // Popup anchoring is window-relative, so the panel page needs its offset.
    this.view.webContents.send(IPC.PANEL_ORIGIN, { x: bounds.x, y: bounds.y })
  }
}

module.exports = { ExtensionPanel }
