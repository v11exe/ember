const path = require('node:path')
const { FloatingPanel } = require('./floating-panel')
const { placePointPanel } = require('../shared/floating-geometry')
const { buildContextMenu } = require('./context-menu-model')

const MENU_WIDTH = 254
const MAX_MENU_HEIGHT = 364
const CAPTURE_BLEED = 40

function menuHeight(items) {
  return 12 + items.reduce((height, item) => height + (item.type === 'separator' ? 9 : 35), 0)
}

function menuSize(items) {
  void items
  return { width: MENU_WIDTH, height: MAX_MENU_HEIGHT }
}

function safeFileName(value) {
  return String(value || 'page').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim() || 'page'
}

class ContextMenuPanel {
  constructor(win, {
    overlay = new FloatingPanel(win, { url: 'ember://context-menu' }),
    createTab,
    clipboard,
    dialog,
  }) {
    this.win = win
    this.overlay = overlay
    this.createTab = createTab
    this.clipboard = clipboard
    this.dialog = dialog
    this.active = null
    this.openSequence = 0
  }

  async open({ tab, params }) {
    if (this.active) this.hide()
    const wc = tab.webContents
    const items = buildContextMenu(params, {
      canGoBack: wc.navigationHistory.canGoBack(),
      canGoForward: wc.navigationHistory.canGoForward(),
    })
    const viewport = tab.view.getBounds()
    const bounds = placePointPanel(viewport, {
      x: viewport.x + params.x,
      y: viewport.y + params.y,
    }, menuSize(items), 8)
    this.active = { tab, params, items, openSequence: ++this.openSequence }
    const opened = await this.overlay.show({
      bounds, state: { kind: 'context-menu', items, openSequence: this.active.openSequence }, targetView: tab.view,
      captureBleed: CAPTURE_BLEED,
    })
    if (!opened || this.active?.tab !== tab || this.active.params !== params) return
    const liveViewport = tab.view.getBounds()
    const liveBounds = placePointPanel(liveViewport, {
      x: liveViewport.x + params.x,
      y: liveViewport.y + params.y,
    }, menuSize(items), 8)
    if (Object.keys(bounds).some((key) => bounds[key] !== liveBounds[key])) {
      await this.overlay.relayout({
        bounds: liveBounds, targetView: tab.view, captureBleed: CAPTURE_BLEED,
      })
    }
  }

  isSender(webContents) {
    return this.overlay.isSender(webContents)
  }

  hide() {
    if (!this.active) return
    this.active = null
    this.overlay.hide()
  }

  layout() {
    if (!this.active) return
    const { tab, params, items } = this.active
    const viewport = tab.view.getBounds()
    const bounds = placePointPanel(viewport, {
      x: viewport.x + params.x,
      y: viewport.y + params.y,
    }, menuSize(items), 8)
    if (this.overlay.relayout) {
      void this.overlay.relayout({ bounds, targetView: tab.view, captureBleed: CAPTURE_BLEED })
    } else {
      this.overlay.setBounds(bounds)
    }
  }

  async handleAction(sender, action) {
    if (!this.isSender(sender) || !this.active) return false
    const item = this.active.items.find((candidate) => candidate.id === action)
    if (!item || item.enabled === false) return false
    const { tab, params } = this.active
    const wc = tab.webContents
    this.hide()

    if (action.startsWith('spell:')) wc.replaceMisspelling(action.slice(6))
    else if (action === 'dictionary-add') wc.session.addWordToSpellCheckerDictionary(params.misspelledWord)
    else if (action === 'open-link') this.createTab(params.linkURL)
    else if (action === 'copy-link') this.clipboard.writeText(params.linkURL)
    else if (action === 'open-image') this.createTab(params.srcURL)
    else if (action === 'copy-image') wc.copyImageAt(params.x, params.y)
    else if (action === 'copy-image-address') this.clipboard.writeText(params.srcURL)
    else if (action === 'undo') wc.undo()
    else if (action === 'redo') wc.redo()
    else if (action === 'cut') wc.cut()
    else if (action === 'copy') wc.copy()
    else if (action === 'paste') wc.paste()
    else if (action === 'delete') wc.delete()
    else if (action === 'select-all') wc.selectAll()
    else if (action === 'back') wc.navigationHistory.goBack()
    else if (action === 'forward') wc.navigationHistory.goForward()
    else if (action === 'reload') wc.reload()
    else if (action === 'print') wc.print({ printBackground: true })
    else if (action === 'view-source') this.createTab(`view-source:${wc.getURL()}`)
    else if (action === 'inspect') wc.inspectElement(params.x, params.y)
    else if (action === 'save-page') await this.#savePage(wc)
    else return false
    return true
  }

  async #savePage(wc) {
    const result = await this.dialog.showSaveDialog(this.win, {
      title: 'Save page as',
      defaultPath: `${safeFileName(wc.getTitle())}.html`,
      filters: [{ name: 'Web page, complete', extensions: ['html', 'htm'] }],
    })
    if (!result.canceled && result.filePath) await wc.savePage(path.normalize(result.filePath), 'HTMLComplete')
  }
}

module.exports = { ContextMenuPanel, MENU_WIDTH, MAX_MENU_HEIGHT, menuHeight, menuSize }
