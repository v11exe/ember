const { FloatingPanel } = require('./floating-panel')

// "Reopen these tabs next time?" shown as the window closes.
//
// Built on FloatingPanel so it refracts a real capture of the page behind it,
// the same way the upload and context-menu overlays do.

const WIDTH = 460
const HEIGHT = 260
const CAPTURE_BLEED = 40

class SessionPrompt {
  constructor(win) {
    this.win = win
    this.panel = new FloatingPanel(win, { url: 'ember://session-prompt' })
    this.pending = null
  }

  get open() { return this.panel.open }

  #bounds() {
    const { width, height } = this.win.getContentBounds()
    return {
      x: Math.round((width - WIDTH) / 2),
      y: Math.round((height - HEIGHT) / 2),
      width: WIDTH,
      height: HEIGHT,
    }
  }

  /**
   * Ask the user. Resolves with 'yes' | 'no' | 'always' | 'never' | 'cancel'.
   * @param {{ tabCount: number, targetView?: any }} details
   */
  ask({ tabCount, targetView = null }) {
    if (this.pending) return this.pending.promise
    let settle
    const promise = new Promise((resolve) => { settle = resolve })
    this.pending = { promise, resolve: settle }

    this.panel.show({
      bounds: this.#bounds(),
      state: { tabCount },
      targetView,
      captureBleed: CAPTURE_BLEED,
    })

    return promise
  }

  /** Called from the OVERLAY_ACTION handler in index.js. */
  resolve(answer) {
    if (!this.pending) return false
    const { resolve } = this.pending
    this.pending = null
    this.panel.hide()
    resolve(answer)
    return true
  }

  cancel() { return this.resolve('cancel') }

  layout() {
    if (this.panel.open) this.panel.setBounds(this.#bounds())
  }
}

module.exports = { SessionPrompt, WIDTH, HEIGHT }
