const { calculatePopupBounds } = require('../shared/popup-geometry')

class PopupPositioner {
  constructor(win, panel) {
    this.win = win
    this.panel = panel
    this.popup = null
  }

  attach(extensions) {
    extensions?.on('browser-action-popup-created', (popup) => this.track(popup))
    return this
  }

  track(popup) {
    this.popup = popup
    popup.on?.('moved', () => this.layoutPopup(popup))
    popup.whenReady?.().then(() => this.layoutPopup(popup)).catch(() => {})
    popup.browserWindow?.once('closed', () => {
      if (this.popup === popup) this.popup = null
    })
  }

  layout() {
    if (this.popup) this.layoutPopup(this.popup)
  }

  layoutPopup(popup) {
    const popupWindow = popup?.browserWindow
    if (!popupWindow || popup.isDestroyed?.() || popupWindow.isDestroyed?.()) return
    if (!this.panel.bounds || !this.panel.popupAnchor) return
    const current = popupWindow.getBounds()
    const bounds = calculatePopupBounds({
      windowBounds: this.win.getBounds(),
      panelBounds: this.panel.bounds,
      anchorRect: this.panel.popupAnchor,
      popupSize: current,
    })
    popupWindow.setBounds(bounds)
  }
}

module.exports = { PopupPositioner }
