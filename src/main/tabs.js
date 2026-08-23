const path = require('node:path')
const { WebContentsView } = require('electron')
const { IPC, NEW_TAB_URL, UNREACHABLE_URL } = require('../shared/ipc')
const { isNativeGlassUrl } = require('../shared/native-glass')
const { MEDIA_PROBE_SCRIPT, scrollRestoreScript } = require('./hibernation')
const { isNetworkFailure, describeFailure, isDeadStatus } = require('../shared/archive')
const {
  TOPBAR_HEIGHT, BOOKMARKS_HEIGHT, VIEWPORT_RADIUS, SIDEBAR_TRANSITION_MS,
  SIDEBAR_WIDTH, COLLAPSED_RAIL_WIDTH, OUTER_INSET, SHELL_INSET,
  viewportBounds,
} = require('../shared/chrome-layout')

const CHROME_HEIGHT = TOPBAR_HEIGHT
// A hidden view often has no frame to screenshot; do not wait long for one.
const CAPTURE_TIMEOUT = 600
// The outgoing tab stays visible only this long while being photographed.
const DESELECT_CAPTURE_BUDGET = 700
// How long to give navigationHistory.restore() before assuming it did nothing.
const RESTORE_FALLBACK = 1500
// Chromium keeps 50 navigation entries per tab; matching it keeps the
// serialised page states from growing without bound.
const MAX_HISTORY_ENTRIES = 50

/**
 * The back/forward stack, trimmed the way Chromium trims its own. Each entry
 * carries a `pageState` blob, so this is the expensive part of a sleeping tab
 * and the one worth capping.
 */
function readHistory(wc) {
  try {
    const history = wc.navigationHistory
    const entries = history.getAllEntries()
    if (!entries.length) return null
    let index = Math.max(0, Math.min(history.getActiveIndex(), entries.length - 1))
    if (entries.length <= MAX_HISTORY_ENTRIES) return { entries, index }
    // Keep the window around where the reader actually is.
    const start = Math.max(0, Math.min(index - Math.floor(MAX_HISTORY_ENTRIES / 2), entries.length - MAX_HISTORY_ENTRIES))
    return { entries: entries.slice(start, start + MAX_HISTORY_ENTRIES), index: index - start }
  } catch {
    return null
  }
}

/** capturePage() wants page coordinates; view bounds are window-relative. */
function pageRect(view) {
  const bounds = view?.getBounds?.()
  if (!bounds || bounds.width < 1 || bounds.height < 1) return null
  return { x: 0, y: 0, width: Math.round(bounds.width), height: Math.round(bounds.height) }
}

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
    this.sidebarView = opts.sidebarView || null
    this.frameViews = opts.frameViews || null
    this.pageCornerMasks = opts.pageCornerMasks || []
    this.extensions = opts.extensions || null
    // Screenshots survive a discarded renderer; see tab-thumbnails.js.
    this.thumbnails = opts.thumbnails || null
    // Private windows run on their own session partition.
    this.partition = opts.partition || null
    this.tabs = []
    this.activeId = null
    this.overlay = false // true while a chrome dropdown needs the full window
    this.chromeHeight = CHROME_HEIGHT
    this.bookmarksVisible = false
    this.sidebarOpen = opts.sidebarOpen !== false
    this.layoutTimer = null
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
    view.setBorderRadius?.(VIEWPORT_RADIUS)
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
      // Set while asleep: the back/forward entries, and the scroll and zoom to
      // put back once the renderer exists again.
      history: null,
      restore: null,
      // 0 while the page is fine; a Chromium net error or a dead HTTP status
      // once it is not. `failedUrl` is the address the reader actually wanted.
      pageStatus: 0,
      failedUrl: null,
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
    // A page that never arrived gets Ember's own, which offers the archive.
    wc.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || !isNetworkFailure(errorCode)) return
      const failed = validatedURL || tab.url
      if (failed.startsWith(UNREACHABLE_URL)) return
      tab.failedUrl = failed
      tab.pageStatus = errorCode
      const target = new URL(UNREACHABLE_URL)
      target.searchParams.set('url', failed)
      target.searchParams.set('code', String(errorCode))
      target.searchParams.set('reason', describeFailure(errorCode, errorDescription))
      wc.loadURL(target.href)
    })
    wc.on('did-stop-loading', () => { tab.loading = false; sync() })
    // Camera/microphone use is invisible from the main process, so each document
    // gets a counter it can be asked about before we discard it.
    wc.on('dom-ready', () => {
      wc.executeJavaScript(MEDIA_PROBE_SCRIPT, true).catch(() => {})
      this.#applyRestore(tab)
    })
    const navigationChanged = () => {
      // A fresh navigation clears whatever the last one failed with, unless
      // this *is* the error page standing in for it.
      if (!wc.getURL().startsWith(UNREACHABLE_URL)) {
        tab.failedUrl = null
        tab.pageStatus = 0
      }
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
    if (previous && previous.id !== id) {
      // The idle clock starts when you leave a tab, not when you arrived at
      // it. Without this a page you read for an hour is stale the instant you
      // click away from it.
      previous.lastActiveAt = Date.now()
    }
    if (tab.asleep) this.wake(id)
    this.activeId = id
    tab.lastActiveAt = Date.now()
    this.onSelectionChange?.(tab)
    // The tab being left is the last chance to photograph it, and a hidden
    // view has no frame to give — so it stays visible until the shutter has
    // closed. It is behind the incoming tab by then, so nobody sees it.
    for (const t of this.tabs) {
      if (t.id === id) t.view?.setVisible(true)
      else if (t !== previous) t.view?.setVisible(false)
    }
    // The chrome renderer paints only the exposed shell. Keeping it underneath
    // the page preserves page input and the live native backdrop in the centre.
    if (this.sidebarView) this.win.contentView.addChildView(this.sidebarView)
    this.win.contentView.addChildView(this.chromeView)
    this.win.contentView.addChildView(tab.view)
    for (const mask of this.pageCornerMasks) this.win.contentView.addChildView(mask.view)
    if (this.extensions) {
      try { this.extensions.selectTab(tab.webContents) } catch { /* non-fatal */ }
    }
    this.layout()
    if (previous && previous.id !== id) this.#photographAndHide(previous)
    this.emit()
  }

  /**
   * Screenshot the tab being left, then put it away. Bounded by the cache, so
   * a compositor that has stopped answering cannot strand a visible view.
   */
  #photographAndHide(tab) {
    const view = tab.view
    if (!view) return
    const hide = () => { if (tab.view === view && tab.id !== this.activeId) view.setVisible(false) }
    if (!this.thumbnails || !tab.webContents || tab.asleep) { hide(); return }
    // A machine that cannot produce frames — anything fullscreen in front of
    // Ember will do it — makes every attempt fail slowly. Put the view away on
    // a deadline regardless, so a dead compositor cannot leave it composited.
    const deadline = setTimeout(hide, DESELECT_CAPTURE_BUDGET)
    deadline.unref?.()
    this.thumbnails.capture(tab.id, tab.webContents, { rect: pageRect(view) })
      .catch(() => null)
      .then(() => { clearTimeout(deadline); hide() }, () => { clearTimeout(deadline); hide() })
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
    const view = tab.view
    const wc = tab.webContents
    if (wc.isDestroyed()) return false

    // The synchronous state first: this is what rebuilds the tab.
    const url = wc.getURL() || tab.url
    const title = wc.getTitle() || tab.title
    const history = readHistory(wc)
    const zoomLevel = wc.getZoomLevel?.() || 0

    // Then the slow parts, each followed by a re-check. A click on this very
    // tab can land while a screenshot is in flight, and discarding the page
    // the reader just asked for is the worst outcome available.
    const scroll = await this.#readScroll(wc)
    if (!this.#stillDiscardable(tab, view, wc)) return false
    await this.#captureBeforeSleep(tab, wc)
    if (!this.#stillDiscardable(tab, view, wc)) return false

    tab.url = url
    tab.title = title
    tab.history = history
    tab.restore = { scroll, zoomLevel }
    tab.asleep = true
    tab.sleptAt = Date.now()
    tab.loading = false
    tab.view = null
    tab.webContents = null

    // The extension host indexes tabs by webContents; leaving a destroyed one
    // in its table makes chrome.tabs report a tab that cannot answer.
    if (this.extensions) {
      try { this.extensions.removeTab(wc) } catch { /* it may not have been tracked */ }
    }
    try {
      this.win.contentView.removeChildView(view)
      wc.destroy()
    } catch { /* already gone */ }

    this.emit()
    return true
  }

  /** Nothing may have moved underneath us while an await was in flight. */
  #stillDiscardable(tab, view, wc) {
    return this.tabs.includes(tab)
      && tab.view === view
      && tab.webContents === wc
      && !tab.asleep
      && tab.id !== this.activeId
      && !wc.isDestroyed()
  }

  /**
   * The spec asks for a screenshot taken immediately before the renderer goes.
   * A hidden view usually has no frame to give, so this is best effort and
   * bounded; the cache still holds the shot taken when the tab was deselected.
   */
  async #captureBeforeSleep(tab, wc) {
    if (!this.thumbnails) return
    await Promise.race([
      this.thumbnails.capture(tab.id, wc, { rect: pageRect(tab.view) }).catch(() => null),
      new Promise((resolve) => {
        const timer = setTimeout(resolve, CAPTURE_TIMEOUT)
        timer.unref?.()
      }),
    ])
  }

  /**
   * Rebuild a sleeping tab's renderer, with its back and forward entries. A
   * bare loadURL would strand the reader on a tab with no way back to wherever
   * they came from, which is the thing that makes discarding feel lossy.
   */
  wake(id) {
    const tab = this.tabs.find((t) => t.id === id)
    if (!tab || !tab.asleep) return tab || null
    this.#attachView(tab)
    tab.loading = true
    tab.sleptAt = null
    tab.lastActiveAt = Date.now()

    if (!this.#restoreHistory(tab)) tab.webContents.loadURL(tab.url)
    tab.history = null
    this.emit()
    return tab
  }

  #restoreHistory(tab) {
    const history = tab.history
    const wc = tab.webContents
    if (!history?.entries?.length || !wc) return false
    try {
      wc.navigationHistory.restore({ entries: history.entries, index: history.index })
    } catch (error) {
      console.warn('[ember] navigation history could not be restored:', error.message)
      return false
    }
    // restore() usually starts the load itself. If it quietly did not, the tab
    // would sit blank, so fall back rather than leave the reader with nothing.
    const timer = setTimeout(() => {
      if (tab.webContents === wc && !wc.isDestroyed() && !wc.getURL() && !wc.isLoading()) {
        wc.loadURL(tab.url)
      }
    }, RESTORE_FALLBACK)
    timer.unref?.()
    return true
  }

  /** Put back the scroll offset and zoom the tab had when it was discarded. */
  #applyRestore(tab) {
    const pending = tab.restore
    if (!pending) return
    tab.restore = null
    const wc = tab.webContents
    if (!wc) return
    if (Number.isFinite(pending.zoomLevel) && pending.zoomLevel !== 0) wc.setZoomLevel(pending.zoomLevel)
    const { x = 0, y = 0 } = pending.scroll || {}
    if (!x && !y) return
    wc.executeJavaScript(scrollRestoreScript(x, y), true).catch(() => {})
  }

  /**
   * The HTTP status of a main-frame response, from the session's webRequest.
   * Kept beside the URL it belongs to, because it can arrive either side of
   * the navigation event that would otherwise clear it.
   */
  noteStatus(webContents, url, status) {
    const tab = this.tabs.find((candidate) => candidate.webContents === webContents)
    if (!tab) return
    tab.httpStatus = { url, status: Number(status) || 0 }
    this.emit()
  }

  /** A 404 or 410 the reader is looking at right now, else 0. */
  #deadStatus(tab) {
    if (!tab?.httpStatus || tab.httpStatus.url !== tab.url) return 0
    return isDeadStatus(tab.httpStatus.status) ? tab.httpStatus.status : 0
  }

  /** The address to look up on archive.org, or '' when there is nothing wrong. */
  archiveTarget(tab = this.active) {
    if (!tab) return ''
    if (tab.failedUrl) return tab.failedUrl
    return this.#deadStatus(tab) ? tab.url : ''
  }

  setNeverSleep(id, value) {
    const tab = this.tabs.find((t) => t.id === id)
    if (!tab) return false
    tab.neverSleep = !!value
    this.emit()
    return true
  }

  async #readScroll(wc) {
    if (!wc || wc.isDestroyed()) return null
    try {
      return await wc.executeJavaScript('({ x: window.scrollX, y: window.scrollY })', true)
    } catch {
      return null
    }
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
    this.bookmarksVisible = !!visible
    this.chromeHeight = CHROME_HEIGHT + (this.bookmarksVisible ? BOOKMARKS_HEIGHT : 0)
    this.layout()
  }

  setSidebarOpen(open, { animate = false } = {}) {
    this.sidebarOpen = !!open
    this.layout({ animate })
  }

  applyShellBounds({ width, height, sidebarBounds, pageBounds, radius }) {
    if (this.sidebarView) this.sidebarView.setBounds(sidebarBounds)
    const active = this.active
    if (active?.view) {
      active.view.setBounds(pageBounds)
      active.view.setBorderRadius?.(radius)
    }
    if (this.frameViews) {
      const frameX = Math.max(0, width - OUTER_INSET - SHELL_INSET)
      const frameY = Math.max(0, height - OUTER_INSET - SHELL_INSET)
      this.frameViews.right.setBounds({
        x: frameX, y: TOPBAR_HEIGHT, width: SHELL_INSET,
        height: Math.max(0, height - TOPBAR_HEIGHT - OUTER_INSET),
      })
      this.frameViews.bottom.setBounds({
        x: pageBounds.x, y: frameY,
        width: Math.max(0, frameX - pageBounds.x), height: SHELL_INSET,
      })
    }
    const maskBounds = {
      'top-left': { x: pageBounds.x, y: pageBounds.y },
      'top-right': { x: pageBounds.x + pageBounds.width - radius, y: pageBounds.y },
      'bottom-left': { x: pageBounds.x, y: pageBounds.y + pageBounds.height - radius },
      'bottom-right': {
        x: pageBounds.x + pageBounds.width - radius,
        y: pageBounds.y + pageBounds.height - radius,
      },
    }
    for (const mask of this.pageCornerMasks) {
      const point = maskBounds[mask.corner]
      mask.view.setBounds({ ...point, width: radius, height: radius })
      mask.view.setVisible(true)
    }
  }

  layout({ animate = false } = {}) {
    const { width, height } = this.win.getContentBounds()
    this.chromeView.setBounds({ x: 0, y: 0, width, height: this.chromeHeight })
    if (this.layoutTimer) {
      clearTimeout(this.layoutTimer)
      this.layoutTimer = null
    }
    const sidebarBounds = {
      x: OUTER_INSET,
      y: 0,
      width: this.sidebarOpen ? SIDEBAR_WIDTH : COLLAPSED_RAIL_WIDTH,
      height: Math.max(0, height - OUTER_INSET),
    }
    if (this.sidebarView) {
      this.sidebarView.setVisible(true)
    }
    const { radius, ...pageBounds } = viewportBounds({
      width, height, sidebarOpen: this.sidebarOpen, bookmarksVisible: this.bookmarksVisible,
    })
    const active = this.active
    if (!animate || !active?.view || typeof active.view.getBounds !== 'function') {
      this.applyShellBounds({ width, height, sidebarBounds, pageBounds, radius })
      return
    }

    const fromPage = active.view.getBounds()
    const fromSidebar = this.sidebarView?.getBounds?.() || sidebarBounds
    const startedAt = Date.now()
    const interpolate = (from, to, progress) => Math.round(from + (to - from) * progress)
    const interpolateBounds = (from, to, progress) => ({
      x: interpolate(from.x, to.x, progress),
      y: interpolate(from.y, to.y, progress),
      width: interpolate(from.width, to.width, progress),
      height: interpolate(from.height, to.height, progress),
    })
    const tick = () => {
      if (this.active?.view !== active.view) return
      const elapsed = Date.now() - startedAt
      const linear = Math.min(1, elapsed / SIDEBAR_TRANSITION_MS)
      const eased = 1 - Math.pow(1 - linear, 3)
      this.applyShellBounds({
        width,
        height,
        sidebarBounds: interpolateBounds(fromSidebar, sidebarBounds, eased),
        pageBounds: interpolateBounds(fromPage, pageBounds, eased),
        radius,
      })
      if (linear < 1) this.layoutTimer = setTimeout(tick, 16)
      else this.layoutTimer = null
    }
    tick()
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

  /** Move an existing tab object in physical strip order without touching its lifecycle. */
  move(id, beforeId = null) {
    const from = this.tabs.findIndex((tab) => tab.id === id)
    if (from < 0 || beforeId === id) return false
    const before = beforeId === null
      ? this.tabs.length
      : this.tabs.findIndex((tab) => tab.id === beforeId)
    if (before < 0) return false
    const to = before > from ? before - 1 : before
    if (to === from) return false
    const [tab] = this.tabs.splice(from, 1)
    this.tabs.splice(to, 0, tab)
    this.emit()
    return true
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
        // On the error page the omnibox keeps showing what was asked for, so
        // pressing Enter is itself a retry.
        url: active?.failedUrl || active?.url || '',
        pageStatus: active?.pageStatus || this.#deadStatus(active) || 0,
        archiveUrl: this.archiveTarget(active),
        loading: !!active?.loading,
        canGoBack: wc ? wc.navigationHistory.canGoBack() : false,
        canGoForward: wc ? wc.navigationHistory.canGoForward() : false,
      },
    }
  }

  emit() {
    const state = this.state()
    for (const view of [this.chromeView, this.sidebarView]) {
      if (view && !view.webContents.isDestroyed()) view.webContents.send(IPC.STATE, state)
    }
  }
}

module.exports = { TabManager, CHROME_HEIGHT, BOOKMARKS_HEIGHT, readHistory, MAX_HISTORY_ENTRIES }
