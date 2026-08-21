const path = require('node:path')
const { WebContentsView } = require('electron')
const { IPC, NEW_TAB_URL } = require('../shared/ipc')

const CHROME_HEIGHT = 84 // tab strip (38) + toolbar (46)
const BOOKMARKS_HEIGHT = 30

let nextId = 1

class TabManager {
  /**
   * @param {import('electron').BaseWindow} win
   * @param {import('electron').WebContentsView} chromeView
   * @param {{ extensions?: any }} [opts]
   */
  constructor(win, chromeView, opts = {}) {
    this.win = win
    this.chromeView = chromeView
    this.extensions = opts.extensions || null
    this.tabs = []
    this.activeId = null
    this.overlay = false // true while a chrome dropdown needs the full window
    this.chromeHeight = CHROME_HEIGHT
    win.on('resize', () => this.layout())
  }

  get active() {
    return this.tabs.find((t) => t.id === this.activeId) || null
  }

  create(url = NEW_TAB_URL, { active = true } = {}) {
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: true,
        nodeIntegrationInSubFrames: true,
        preload: path.join(__dirname, 'page-preload.js'),
      },
    })
    view.setBackgroundColor('#000000')

    const tab = { id: nextId++, view, title: 'New tab', url, favicon: null, loading: false }
    this.tabs.push(tab)
    this.win.contentView.addChildView(view)

    this.#wire(tab)

    if (this.extensions) {
      try {
        this.extensions.addTab(view.webContents, this.win)
      } catch (err) {
        console.warn('[ember] extensions.addTab failed:', err.message)
      }
    }

    view.webContents.loadURL(url)
    if (active) this.select(tab.id)
    else view.setVisible(false)

    this.emit()
    return tab.id
  }

  #wire(tab) {
    const wc = tab.webContents = tab.view.webContents

    const sync = () => {
      tab.url = wc.getURL()
      tab.title = wc.getTitle() || 'New tab'
      this.emit()
    }

    wc.on('page-title-updated', (_e, title) => { tab.title = title; this.emit() })
    wc.on('did-start-loading', () => { tab.loading = true; this.emit() })
    wc.on('did-stop-loading', () => { tab.loading = false; sync() })
    wc.on('did-navigate', sync)
    wc.on('did-navigate-in-page', sync)
    wc.on('page-favicon-updated', (_e, icons) => { tab.favicon = icons[0] || null; this.emit() })
    wc.on('destroyed', () => this.#forget(tab.id))
    // clicking back into the page dismisses any open chrome dropdown
    wc.on('focus', () => this.onPageFocus?.())
    wc.on('context-menu', (event, params) => this.onContextMenu?.(tab, event, params))

    // target=_blank and window.open land in a new tab, never a popup window
    wc.setWindowOpenHandler(({ url }) => {
      this.create(url, { active: true })
      return { action: 'deny' }
    })
  }

  select(id) {
    const tab = this.tabs.find((t) => t.id === id)
    if (!tab) return
    this.activeId = id
    this.onSelectionChange?.(tab)
    for (const t of this.tabs) t.view.setVisible(t.id === id)
    // keep the chrome UI painted above the page view
    this.win.contentView.addChildView(tab.view)
    this.win.contentView.addChildView(this.chromeView)
    if (this.extensions) {
      try { this.extensions.selectTab(tab.webContents) } catch { /* non-fatal */ }
    }
    this.layout()
    this.emit()
  }

  close(id) {
    const tab = this.tabs.find((t) => t.id === id)
    if (!tab) return
    const wasActive = this.activeId === id
    const index = this.tabs.indexOf(tab)
    this.#forget(id)
    try {
      this.win.contentView.removeChildView(tab.view)
      tab.webContents.destroy()
    } catch { /* already gone */ }

    if (!this.tabs.length) {
      this.create(NEW_TAB_URL)
      return
    }
    if (wasActive) {
      const next = this.tabs[Math.min(index, this.tabs.length - 1)]
      this.select(next.id)
    }
    this.emit()
  }

  #forget(id) {
    this.tabs = this.tabs.filter((t) => t.id !== id)
  }

  setOverlay(open) {
    this.overlay = !!open
    this.layout()
  }

  setBookmarksVisible(visible) {
    this.chromeHeight = CHROME_HEIGHT + (visible ? BOOKMARKS_HEIGHT : 0)
    this.layout()
  }

  layout() {
    const { width, height } = this.win.getContentBounds()
    this.chromeView.setBounds({ x: 0, y: 0, width, height: this.chromeHeight })
    const active = this.active
    if (active) {
      active.view.setBounds({ x: 0, y: this.chromeHeight, width, height: Math.max(0, height - this.chromeHeight) })
    }
  }

  // ---- navigation, applied to the active tab ----
  go(url) { this.active?.webContents.loadURL(url) }
  back() { const wc = this.active?.webContents; if (wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack() }
  forward() { const wc = this.active?.webContents; if (wc?.navigationHistory.canGoForward()) wc.navigationHistory.goForward() }
  reload() { this.active?.webContents.reload() }
  stop() { this.active?.webContents.stop() }

  state() {
    const active = this.active
    const wc = active?.webContents
    return {
      tabs: this.tabs.map((t) => ({
        id: t.id, title: t.title, url: t.url, favicon: t.favicon,
        loading: t.loading, active: t.id === this.activeId,
      })),
      nav: {
        url: active?.url || '',
        loading: !!active?.loading,
        canGoBack: wc ? wc.navigationHistory.canGoBack() : false,
        canGoForward: wc ? wc.navigationHistory.canGoForward() : false,
      },
    }
  }

  emit() {
    if (this.chromeView.webContents.isDestroyed()) return
    this.chromeView.webContents.send(IPC.STATE, this.state())
  }
}

module.exports = { TabManager, CHROME_HEIGHT, BOOKMARKS_HEIGHT }
