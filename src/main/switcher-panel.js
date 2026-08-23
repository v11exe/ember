const { FloatingPanel } = require('./floating-panel')
const { centerPanel } = require('../shared/floating-geometry')

// Ctrl+Tab, closer to Windows Alt+Tab than to Chromium's blind cycling.
//
// Holding Ctrl and tapping Tab walks a floating row of cards in
// most-recently-used order, so bouncing between the same two or three pages is
// one keystroke each way. Releasing Ctrl commits; Escape leaves you where you
// were.
//
// Sleeping tabs are ordinary entries here: they show the screenshot taken just
// before their renderer was discarded, and only wake if they are chosen.

const CARD_WIDTH = 176
const CARD_GAP = 10
const PADDING = 14
const PANEL_HEIGHT = 178
const MIN_CARDS = 1

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

/** Ember's own pages read as their full address; a bare "newtab" says little. */
function describe(tab) {
  const url = String(tab.url || '')
  if (url.startsWith('ember://')) return url.replace(/\/$/, '')
  return hostOf(url)
}

function panelWidth(count, available) {
  const wanted = PADDING * 2 + count * CARD_WIDTH + Math.max(0, count - 1) * CARD_GAP
  return Math.min(wanted, Math.max(CARD_WIDTH + PADDING * 2, available - 80))
}

class TabSwitcher {
  /**
   * @param {import('electron').BaseWindow} win
   * @param {{ tabs: import('./tabs').TabManager, thumbnails?: object, overlay?: FloatingPanel }} opts
   */
  constructor(win, { tabs, thumbnails = null, overlay } = {}) {
    this.win = win
    this.tabs = tabs
    this.thumbnails = thumbnails
    this.overlay = overlay || new FloatingPanel(win, { url: 'ember://switcher' })
    this.order = []
    this.index = 0
    this.open = false
  }

  /** Most recently used first, with the active tab at the front. */
  mruOrder() {
    return [...this.tabs.tabs].sort((a, b) => {
      if (a.id === this.tabs.activeId) return -1
      if (b.id === this.tabs.activeId) return 1
      return (b.lastActiveAt || 0) - (a.lastActiveAt || 0)
    })
  }

  #cards() {
    return this.order.map((tab) => ({
      id: tab.id,
      title: tab.title || 'New tab',
      domain: describe(tab),
      favicon: tab.favicon || null,
      thumbnail: this.thumbnails?.get(tab.id)?.dataUrl || null,
      asleep: !!tab.asleep,
    }))
  }

  /**
   * Move the selection, opening the switcher on the first press. Returns false
   * when there is nothing to switch between.
   */
  step(delta) {
    if (this.tabs.tabs.length < 2) return false
    if (!this.open) {
      this.order = this.mruOrder()
      // The first press should already be on the tab you came from.
      this.index = ((delta % this.order.length) + this.order.length) % this.order.length
      this.open = true
      void this.#show()
      return true
    }
    this.index = (this.index + delta + this.order.length) % this.order.length
    this.overlay.patchState({ index: this.index })
    return true
  }

  async #show() {
    const cards = this.#cards()
    const viewport = this.tabs.active?.view?.getBounds()
      || { x: 0, y: 0, ...this.win.getContentBounds() }
    const bounds = centerPanel(viewport, {
      width: panelWidth(Math.max(cards.length, MIN_CARDS), viewport.width),
      height: PANEL_HEIGHT,
    }, 12)
    await this.overlay.show({
      bounds,
      state: { kind: 'switcher', tabs: cards, index: this.index, openSequence: Date.now() },
      targetView: this.tabs.active?.view || null,
      captureBleed: 40,
    })
  }

  /** Ctrl came back up: go to whatever is selected. */
  commit() {
    if (!this.open) return false
    const target = this.order[this.index]
    this.hide()
    if (target && target.id !== this.tabs.activeId) this.tabs.select(target.id)
    return true
  }

  cancel() {
    if (!this.open) return false
    this.hide()
    return true
  }

  hide() {
    if (!this.open) return
    this.open = false
    this.order = []
    this.index = 0
    this.overlay.hide()
  }

  isSender(webContents) {
    return this.overlay.isSender(webContents)
  }

  /** Clicking a card is the same as selecting it and letting go. */
  handleAction(sender, action, payload) {
    if (!this.isSender(sender) || !this.open) return false
    if (action === 'switch-pick') {
      const id = Number(payload?.id)
      const found = this.order.findIndex((tab) => tab.id === id)
      if (found >= 0) this.index = found
      return this.commit()
    }
    if (action === 'switch-commit') return this.commit()
    if (action === 'switch-cancel') return this.cancel()
    return false
  }

  layout() {
    if (this.open) void this.#show()
  }
}

module.exports = { TabSwitcher, CARD_WIDTH, CARD_GAP, PANEL_HEIGHT, panelWidth, hostOf }
