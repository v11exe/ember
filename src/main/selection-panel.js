const { FloatingPanel } = require('./floating-panel')
const { placePointPanel } = require('../shared/floating-geometry')
const { detectValue, convert } = require('../shared/conversions')

// The popup that appears when the selected text turns out to be a price, a
// measurement or a time somewhere else in the world. It borrows the context
// menu's machinery — a FloatingPanel over the page, refracting a real capture
// of what is behind it — but stays deliberately tiny.

const PANEL_WIDTH = 236
const CAPTURE_BLEED = 40
const GAP = 8

function panelHeight(result) {
  // padding + source line + converted line + optional note + copy button
  return 14 + 17 + 26 + (result.note ? 18 : 0) + 8 + 30 + 12
}

function panelSize(result) {
  return { width: PANEL_WIDTH, height: panelHeight(result) }
}

class SelectionPanel {
  constructor(win, {
    overlay = new FloatingPanel(win, { url: 'ember://conversion' }),
    clipboard,
    prefs = () => ({}),
    rates = null,
  } = {}) {
    this.win = win
    this.overlay = overlay
    this.clipboard = clipboard
    this.prefs = prefs
    this.rates = rates
    this.active = null
    this.generation = 0
    this.openSequence = 0
  }

  /**
   * React to a selection reported by a page. An empty or unrecognised
   * selection closes whatever is open.
   *
   * @param {{ tab: object, text: string, rect: { x: number, y: number, width: number, height: number } }} input
   */
  async update({ tab, text, rect }) {
    const generation = ++this.generation
    const settings = this.prefs()
    if (!tab?.view || !rect || settings?.enabled === false) return this.hide()

    const detected = detectValue(text)
    if (!detected) return this.hide()

    // Only a currency selection is worth a network round trip.
    const rates = detected.kind === 'currency' ? await this.rates?.ensure() : null
    if (generation !== this.generation) return false

    const result = convert(detected, settings, { rates })
    if (!result) return this.hide()

    const bounds = this.#place(tab.view, rect, result)
    this.active = { tab, rect, result, openSequence: ++this.openSequence }
    const opened = await this.overlay.show({
      bounds,
      // `kind` names the overlay page, the way the context menu does;
      // `valueKind` is what was recognised in the selection.
      state: { ...result, kind: 'conversion', valueKind: result.kind, openSequence: this.active.openSequence },
      targetView: tab.view,
      captureBleed: CAPTURE_BLEED,
    })
    return generation === this.generation && opened
  }

  /**
   * Above the selection by preference, the way Opera does it: the lines you
   * have already read are a better thing to cover than the ones you have not.
   * Falls below when there is no room above.
   */
  #place(view, rect, result) {
    const viewport = view.getBounds()
    const size = panelSize(result)
    const top = viewport.y + Math.round(rect.y)
    const above = top - size.height - GAP
    const y = above >= viewport.y + GAP
      ? above
      : viewport.y + Math.round(rect.y + rect.height) + GAP
    return placePointPanel(viewport, { x: viewport.x + Math.round(rect.x), y }, size, GAP)
  }

  isSender(webContents) {
    return this.overlay.isSender(webContents)
  }

  get open() {
    return !!this.active
  }

  hide() {
    if (!this.active) return false
    this.active = null
    this.overlay.hide()
    return false
  }

  layout() {
    if (!this.active) return
    const { tab, rect, result } = this.active
    if (!tab.view) return this.hide()
    void this.overlay.relayout?.({
      bounds: this.#place(tab.view, rect, result),
      targetView: tab.view,
      captureBleed: CAPTURE_BLEED,
    })
  }

  handleAction(sender, action) {
    if (!this.isSender(sender) || !this.active) return false
    const { result } = this.active
    if (action === 'copy') {
      // The converted value alone is what anyone wants on the clipboard.
      this.clipboard?.writeText(String(result.to).replace(/^≈\s*/, ''))
      this.hide()
      return true
    }
    if (action === 'close') {
      this.hide()
      return true
    }
    return false
  }
}

module.exports = { SelectionPanel, PANEL_WIDTH, panelHeight, panelSize }
