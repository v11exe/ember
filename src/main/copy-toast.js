const { FloatingPanel } = require('./floating-panel')
const { TOPBAR_HEIGHT, SIDEBAR_WIDTH, COLLAPSED_RAIL_WIDTH } = require('../shared/chrome-layout')

const TOAST_WIDTH = 108
const TOAST_HEIGHT = 30
const TOAST_LIFETIME = 2600
const TOAST_EXIT_DURATION = 180

class CopyToast {
  constructor(win, {
    tabs,
    overlay = new FloatingPanel(win, { url: 'ember://copy-toast' }),
    schedule = setTimeout,
    cancel = clearTimeout,
  } = {}) {
    this.win = win
    this.tabs = tabs
    this.overlay = overlay
    this.schedule = schedule
    this.cancel = cancel
    this.timer = null
    this.dismissTimer = null
    this.generation = 0
    this.openSequence = 0
  }

  bounds() {
    return {
      x: (this.tabs?.sidebarOpen === false ? COLLAPSED_RAIL_WIDTH : SIDEBAR_WIDTH) + 8,
      y: TOPBAR_HEIGHT + 3,
      width: TOAST_WIDTH,
      height: TOAST_HEIGHT,
    }
  }

  async show() {
    const generation = ++this.generation
    this.cancel(this.timer)
    this.cancel(this.dismissTimer)
    const opened = await this.overlay.show({
      bounds: this.bounds(),
      state: { kind: 'copy-toast', lifetime: TOAST_LIFETIME, openSequence: ++this.openSequence },
      focus: false,
    })
    if (!opened || generation !== this.generation) return false
    this.timer = this.schedule(() => {
      if (generation === this.generation) this.hide()
    }, TOAST_LIFETIME)
    this.timer.unref?.()
    return true
  }

  hide() {
    const generation = ++this.generation
    this.cancel(this.timer)
    this.timer = null
    this.cancel(this.dismissTimer)
    if (!this.overlay.open) return
    this.overlay.patchState({ closing: true })
    this.dismissTimer = this.schedule(() => {
      if (generation === this.generation) this.overlay.hide()
    }, TOAST_EXIT_DURATION)
    this.dismissTimer.unref?.()
  }

  layout() {
    if (this.overlay.open) this.overlay.setBounds(this.bounds())
  }
}

module.exports = { CopyToast, TOAST_WIDTH, TOAST_HEIGHT, TOAST_LIFETIME, TOAST_EXIT_DURATION }
