const path = require('node:path')
const { WebContentsView } = require('electron')
const { IPC, NEW_TAB_URL } = require('../shared/ipc')
const { isNativeGlassUrl } = require('../shared/native-glass')
const { MEDIA_PROBE_SCRIPT } = require('./hibernation')

const CHROME_HEIGHT = 84 // tab strip (38) + toolbar (46)
const BOOKMARKS_HEIGHT = 30

let nextId = 1

class TabManager {
  /**
   * @param {import('electron').BaseWindow} win
   * @param {import('electron').WebContentsView} chromeView
   * @param {{ extensions?: any, thumbnails?: import('./tab-thumbnails').ThumbnailCache }} [opts]
   */
  constructor(win, chromeView, opts = {}) {
    this.win = win
    this.chromeView = chromeView
    this.extensions = opts.extensions || null
    // Screenshots survive a discarded renderer; see tab-thumbnails.js.
    this.thumbnails = opts.thumbnails || null
    // Private windows run on their own session partition.
    this.partition = opts.partition || null
    this.tabs = []
    this.activeId = null
    this.overlay = false // true while a chrome dropdown needs the full window
    this.chromeHeight = CHROME_HEIGHT
    win.on('resize', () => this.layout())
  }

  get active() {
    return this.tabs.find((t) => t.id === this.activeId) || null
  }

  #createView(url) {
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: true,
        nodeIntegrationInSubFrames: true,
        preload: path.join(__dirname, 'page-preload.js'),
        ...(this.partition ? { partition: this.partition } : {}),
      },
    })
    view.setBackgroundColor(isNativeGlassUrl(url) ? '#00000000' : '#000000')
    return view
  }

  /**
   * `asleep: true` creates the tab record without ever building a renderer —
   * used when restoring a saved set of tabs.
   */
  create(url = NEW_TAB_URL, { active = true, asleep = false, title, favicon } = {}) {
    const tab = {
      id: nextId++,
      view: null,
      webContents: null,
      title: title || 'New tab',
      url,
      favicon: favicon || null,
      loading: false,
      asleep: false,
      neverSleep: false,
      scroll: null,
      lastActiveAt: Date.now(),
    }
    this.tabs.push(tab)

    if (asleep && !active) {
      tab.asleep = true
      tab.lastActiveAt = 0 // never focused, so eligible from the start
      this.emit()
      return tab.id
    }

    this.#attachView(tab)
    tab.webContents.loadURL(url)
    if (active) this.select(tab.id)
    else tab.view.setVisible(false)

    this.emit()
    return tab.id
  }

  /** Build the renderer for a tab record and wire it up. */
  #attachView(tab) {
    const view = this.#createView(tab.url)
    tab.view = view
    tab.asleep = false
    this.win.contentView.addChildView(view)
    this.#wire(tab)

    if (this.extensions) {
      try {
        this.extensions.addTab(view.webContents, this.win)
      } catch (err) {
        console.warn('[ember] extensions.addTab failed:', err.message)
      }
    }
    return view
  }

  #wire(tab) {
    const wc = tab.webContents = tab.view.webContents

    const sync = () => {
      tab.url = wc.getURL()
      tab.title = wc.getTitle() || 'New tab'
      this.emit()
    }

    wc.on('page-title-updated', (_e, title) => { tab.title = title; this.onVisitDetail?.({ url: wc.getURL(), title }); this.emit() })
    wc.on('did-start-loading', () => { tab.loading = true; this.emit() })
    wc.on('did-stop-loading', () => { tab.loading = false; sync() })
    // Camera/microphone use is invisible from the main process, so each document
    // gets a counter it can be asked about before we discard it.
    wc.on('dom-ready', () => {
      wc.executeJavaScript(MEDIA_PROBE_SCRIPT, true).catch(() => {})
      this.#restoreScroll(tab)
    })
    const navigationChanged = () => {
      sync()
      tab.view?.setBackgroundColor(isNativeGlassUrl(tab.url) ? '#00000000' : '#000000')
      this.onNavigationChange?.(tab)
    }
    wc.on('did-navigate', (_e, url) => { navigationChanged(); this.onVisit?.({ url, title: wc.getTitle(), favicon: tab.favicon }) })
    wc.on('did-navigate-in-page', navigationChanged)
    wc.on('page-favicon-updated', (_e, icons) => { tab.favicon = icons[0] || null; this.onVisitDetail?.({ url: wc.getURL(), favicon: tab.favicon }); this.emit() })
    // Hibernation destroys the renderer on purpose; the tab record stays, and
    // may already have been given a new one. 'destroyed' arrives a turn late, so
    // compare identities rather than reading a flag that has since moved on.
    wc.on('destroyed', () => { if (tab.webContents === wc) this.#forget(tab.id) })
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
    const previous = this.active
    if (previous && previous.id !== id) this.rememberThumbnail(previous)
    if (tab.asleep) this.wake(id)
    this.activeId = id
    tab.lastActiveAt = Date.now()
    this.onSelectionChange?.(tab)
    for (const t of this.tabs) t.view?.setVisible(t.id === id)
    // keep the chrome UI painted above the page view
    this.win.contentView.addChildView(tab.view)
    this.win.contentView.addChildView(this.chromeView)
    if (this.extensions) {
      try { this.extensions.selectTab(tab.webContents) } catch { /* non-fatal */ }
    }
    this.layout()
    this.emit()
  }

  // ---- hibernation ----
  /**
   * Discard a background tab's renderer, keeping enough to rebuild it. The
   * screenshot is taken first so the switcher and hover previews still have a
   * picture of a page that no longer exists.
   */
  async hibernate(id) {
    const tab = this.tabs.find((t) => t.id === id)
    if (!tab || tab.asleep || !tab.view || tab.id === this.activeId) return false
    const wc = tab.webContents

    tab.scroll = await this.#readScroll(wc)
    await this.thumbnails?.capture(tab.id, wc)
    if (!wc.isDestroyed()) {
      tab.url = wc.getURL() || tab.url
      tab.title = wc.getTitle() || tab.title
    }

    const view = tab.view
    tab.asleep = true
    tab.sleptAt = Date.now()
    tab.loading = false
    tab.view = null
    tab.webContents = null
    try {
      this.win.contentView.removeChildView(view)
      view.webContents.destroy()
    } catch { /* already gone */ }

    this.emit()
    return true
  }

  /** Rebuild a sleeping tab's renderer. Scroll is restored once the DOM exists. */
  wake(id) {
    const tab = this.tabs.find((t) => t.id === id)
    if (!tab || !tab.asleep) return tab || null
    this.#attachView(tab)
    tab.loading = true
    tab.sleptAt = null
    tab.webContents.loadURL(tab.url)
    this.emit()
    return tab
  }

  setNeverSleep(id, value) {
    const tab = this.tabs.find((t) => t.id === id)
    if (!tab) return false
    tab.neverSleep = !!value
    this.emit()
    return true
  }

  /** Fire-and-forget screenshot of a tab that is still on screen. */
  rememberThumbnail(tab) {
    if (!this.thumbnails || !tab?.webContents || tab.asleep) return
    this.thumbnails.capture(tab.id, tab.webContents).catch(() => {})
  }

  async #readScroll(wc) {
    if (!wc || wc.isDestroyed()) return null
    try {
      return await wc.executeJavaScript('({ x: window.scrollX, y: window.scrollY })', true)
    } catch {
      return null
    }
  }

  #restoreScroll(tab) {
    const target = tab.scroll
    if (!target || (!target.x && !target.y)) return
    tab.scroll = null
    tab.webContents?.executeJavaScript(
      `window.scrollTo(${Number(target.x) || 0}, ${Number(target.y) || 0})`, true
    ).catch(() => {})
  }

  close(id) {
    const tab = this.tabs.find((t) => t.id === id)
    if (!tab) return
    this.onTabClosed?.({ url: tab.url, title: tab.title, favicon: tab.favicon })
    const wasActive = this.activeId === id
    const index = this.tabs.indexOf(tab)
    this.#forget(id)
    this.thumbnails?.forget(id)
    if (tab.view) {
      try {
        this.win.contentView.removeChildView(tab.view)
        tab.webContents.destroy()
      } catch { /* already gone */ }
    }

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
    if (active?.view) {
      active.view.setBounds({ x: 0, y: this.chromeHeight, width, height: Math.max(0, height - this.chromeHeight) })
    }
  }

  // ---- navigation, applied to the active tab ----
  /** Ctrl+1..8 pick a tab by position; out of range does nothing. */
  selectIndex(index) {
    const tab = this.tabs[index]
    if (tab) this.select(tab.id)
  }

  selectLast() {
    const tab = this.tabs[this.tabs.length - 1]
    if (tab) this.select(tab.id)
  }

  /** Ctrl+Tab wraps around rather than stopping at the ends. */
  cycle(delta) {
    if (this.tabs.length < 2) return
    const current = this.tabs.findIndex((tab) => tab.id === this.activeId)
    const next = (current + delta + this.tabs.length) % this.tabs.length
    this.select(this.tabs[next].id)
  }

  closeActive() {
    if (this.activeId !== null) this.close(this.activeId)
  }

  go(url) { this.active?.webContents?.loadURL(url) }
  back() { const wc = this.active?.webContents; if (wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack() }
  forward() { const wc = this.active?.webContents; if (wc?.navigationHistory.canGoForward()) wc.navigationHistory.goForward() }
  reload() { this.active?.webContents?.reload() }
  hardReload() { this.active?.webContents?.reloadIgnoringCache() }
  stop() { this.active?.webContents?.stop() }

  state() {
    const active = this.active
    const wc = active?.webContents
    return {
      tabs: this.tabs.map((t) => ({
        id: t.id, title: t.title, url: t.url, favicon: t.favicon,
        loading: t.loading, active: t.id === this.activeId,
        asleep: t.asleep, neverSleep: t.neverSleep,
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
