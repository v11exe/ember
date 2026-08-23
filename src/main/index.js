const path = require('node:path')
const fs = require('node:fs/promises')
const { pathToFileURL } = require('node:url')
const { app, BaseWindow, WebContentsView, clipboard, dialog, ipcMain, nativeImage, screen, session, shell, webContents } = require('electron')

const { IPC, NEW_TAB_URL, HISTORY_URL, DOWNLOADS_URL, SETTINGS_URL, EXTENSIONS_URL, WEB_STORE_URL } = require('../shared/ipc')
const { toNavigationUrl, resolveInput } = require('../shared/urls')
const { TabManager, CHROME_HEIGHT } = require('./tabs')
const { setupExtensions, applyStoreRebranding, listExtensions, removeExtension } = require('./extensions')
const { registerSchemePrivileges, handleInternalPages } = require('./protocol')
const { ExtensionPanel } = require('./panel')
const { BookmarkStore } = require('./bookmarks')
const { HistoryStore } = require('./history')
const { DownloadStore } = require('./downloads')
const { SettingsStore, SESSION_RESTORE } = require('./settings')
const { SessionStore } = require('./session')
const { SessionPrompt } = require('./session-prompt')
const { PopupPositioner } = require('./popup-positioner')
const { resolveShortcut, COMMANDS, nextZoom } = require('./shortcuts')
const { RecentUploadStore } = require('./recent-uploads')
const { UploadPanel } = require('./upload-panel')
const { ContextMenuPanel } = require('./context-menu-panel')
const { SelectionPanel } = require('./selection-panel')
const { RateStore } = require('./rates')
const { ArchiveLookup } = require('./archive')
const { TabSwitcher } = require('./switcher-panel')
const { isDeadStatus, isArchivable } = require('../shared/archive')
const { NativeBackdrop } = require('./native-backdrop')
const { ThumbnailCache } = require('./tab-thumbnails')
const { HibernationManager, hostnameOf, sanitiseHibernation } = require('./hibernation')
const { listBangs, DEFAULT_BANGS } = require('../shared/bangs')
const { NATIVE_GLASS_DEFAULTS, snapshotNativeGlassSettings } = require('../shared/native-glass')
const { DEFAULT_FAVORITES, findFavoriteTab, favoriteFromTab } = require('../shared/favorites')
const { TOPBAR_HEIGHT, OUTER_RADIUS, viewportBounds } = require('../shared/chrome-layout')

if (process.env.EMBER_SMOKE_USER_DATA) app.setPath('userData', process.env.EMBER_SMOKE_USER_DATA)
registerSchemePrivileges()

/** @type {{ win: BaseWindow, chrome: WebContentsView, tabs: TabManager, uploadPanel: UploadPanel, contextMenu: ContextMenuPanel, nativeBackdrop: NativeBackdrop }|null} */
let browser = null
const browsers = new Set()
const windowDrags = new Map()

function browserFromSender(sender) {
  return [...browsers].find((candidate) => (
    candidate.chrome?.webContents === sender
    || candidate.sidebarView?.webContents === sender
    || candidate.tabs?.tabs?.some((tab) => tab.webContents === sender)
    || candidate.tabs?.pageCornerMasks?.some((mask) => mask.view.webContents === sender)
  )) || null
}

/** The chrome view keeps its own copy so the omnibox can match as you type. */
function broadcastBangs(target = browser) {
  if (!target || target.chrome.webContents.isDestroyed()) return
  target.chrome.webContents.send(IPC.BANGS_CHANGED, target.settings.get('bangs') || [])
}

function chromeConfig(target = browser) {
  return target ? {
    sidebarOpen: target.tabs ? target.tabs.sidebarOpen : target.settings.get('sidebarOpen') !== false,
    favorites: target.settings.get('favorites') || [],
  } : { sidebarOpen: true, favorites: [] }
}

function broadcastChromeConfig(target = browser) {
  if (!target) return
  for (const view of [target.chrome, target.sidebarView]) {
    if (view && !view.webContents.isDestroyed()) view.webContents.send(IPC.CHROME_CONFIG_CHANGED, chromeConfig(target))
  }
}

async function persistFavorites(source, favorites) {
  if (!source) return null
  const snapshot = await source.settings.set('favorites', favorites)
  for (const target of browsers) {
    if (target !== source) target.settings.sync('favorites', snapshot.favorites)
    broadcastChromeConfig(target)
  }
  return snapshot.favorites
}

async function removeFavorite(source, id) {
  if (!source) return false
  const current = source.settings.get('favorites') || []
  const next = current.filter((entry) => entry.id !== String(id))
  if (next.length === current.length) return false
  await persistFavorites(source, next)
  return true
}

function broadcastWindowState(target = browser) {
  if (!target || target.chrome.webContents.isDestroyed()) return
  const state = { maximized: target.win.isMaximized() }
  for (const view of [target.chrome, target.sidebarView]) {
    if (view && !view.webContents.isDestroyed()) view.webContents.send(IPC.WIN_STATE, state)
  }
  for (const view of Object.values(target.frameViews || {})) {
    if (view?.webContents && !view.webContents.isDestroyed()) {
      void view.webContents.executeJavaScript(
        `document.body.classList.toggle('maximized', ${state.maximized})`,
      ).catch(() => null)
    }
  }
}

function broadcastBookmarks(snapshot) {
  if (!browser) return snapshot
  browser.tabs.setBookmarksVisible(snapshot.visible)
  browser.panel.setTop(browser.tabs.chromeHeight - 6)
  browser.popupPositioner?.layout()
  browser.chrome.webContents.send(IPC.BOOKMARKS_CHANGED, snapshot)
  return snapshot
}

function createBrowser({ privateMode = false } = {}) {
  const settings = new SettingsStore(path.join(app.getPath('userData'), 'settings.json'))
  const sessionStore = new SessionStore(path.join(app.getPath('userData'), 'session.json'))
  const saved = settings.get('window')

  const win = new BaseWindow({
    width: saved?.width || 1280,
    height: saved?.height || 820,
    ...(Number.isFinite(saved?.x) ? { x: saved.x, y: saved.y } : {}),
    minWidth: 620,
    minHeight: 420,
    frame: false,
    transparent: true,
    roundedCorners: true,
    hasShadow: true,
    icon: path.join(__dirname, '..', 'renderer', 'assets', 'ember-app-icon.png'),
    backgroundColor: '#00000000',
    title: 'Ember',
  })
  const syncOuterRadius = () => win.contentView.setBorderRadius(win.isMaximized() ? 0 : OUTER_RADIUS)
  syncOuterRadius()
  const nativeBackdrop = new NativeBackdrop(win, { userDataPath: app.getPath('userData') })

  const chrome = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // needs require() for the shared IPC contract + browser-action element
      preload: path.join(__dirname, '..', 'renderer', 'preload.js'),
    },
  })
  chrome.setBackgroundColor('#00000000') // transparent below the toolbar when a panel is open
  win.contentView.addChildView(chrome)
  chrome.webContents.loadFile(path.join(__dirname, '..', 'renderer', 'chrome.html'))

  const sidebarView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, '..', 'renderer', 'preload.js'),
    },
  })
  sidebarView.setBackgroundColor('#00000000')
  win.contentView.addChildView(sidebarView)
  sidebarView.webContents.loadFile(path.join(__dirname, '..', 'renderer', 'sidebar.html'))

  const createFrameView = (axis) => {
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        preload: path.join(__dirname, '..', 'renderer', 'shell-metrics-preload.js'),
      },
    })
    view.setBackgroundColor('#00000000')
    view.webContents.loadFile(path.join(__dirname, '..', 'renderer', 'frame.html'), { query: { axis } })
    win.contentView.addChildView(view)
    return view
  }
  const frameRight = createFrameView('right')
  const frameBottom = createFrameView('bottom')
  const pageCornerMasks = ['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((corner) => {
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        preload: path.join(__dirname, '..', 'renderer', 'corner-mask-preload.js'),
      },
    })
    view.setBackgroundColor('#00000000')
    view.webContents.loadFile(path.join(__dirname, '..', 'renderer', 'corner-mask.html'), { query: { corner } })
    win.contentView.addChildView(view)
    return { corner, view }
  })

  const thumbnails = new ThumbnailCache()
  const tabs = new TabManager(win, chrome, {
    thumbnails,
    partition: privateMode ? 'persist:ember-private' : undefined,
    sidebarOpen: settings.get('sidebarOpen'),
    sidebarView,
    frameViews: { right: frameRight, bottom: frameBottom },
    pageCornerMasks,
  })
  for (const view of [frameRight, frameBottom, ...pageCornerMasks.map((entry) => entry.view)]) {
    view.webContents.once('did-finish-load', () => tabs.layout())
  }
  const panel = new ExtensionPanel(win)
  const bookmarks = new BookmarkStore(path.join(app.getPath('userData'), 'bookmarks.json'))
  const history = new HistoryStore(path.join(app.getPath('userData'), 'history.json'))
  const downloads = new DownloadStore(path.join(app.getPath('userData'), 'downloads.json'))
  const recentUploads = new RecentUploadStore(path.join(app.getPath('userData'), 'recent-uploads.json'))
  const recentUploadsReady = recentUploads.load().catch((error) => {
    console.warn('[ember] recent uploads could not be loaded:', error.message)
    return []
  })
  const smokeUploadPaths = [
    path.join(__dirname, '..', 'renderer', 'assets', 'ember-icon.png'),
    path.join(__dirname, '..', 'renderer', 'assets', 'glass-toggler-map.webp'),
  ]
  const smokeClipboard = process.env.EMBER_SMOKE ? {
    image: nativeImage.createFromPath(smokeUploadPaths[0]),
    readImage() { return this.image },
  } : null
  const uploadPanel = new UploadPanel(win, {
    recents: recentUploads,
    dialog: process.env.EMBER_SMOKE ? {
      showOpenDialog: async () => ({ canceled: false, filePaths: smokeUploadPaths }),
    } : dialog,
    clipboard: smokeClipboard || clipboard,
    nativeImage,
  })
  const contextMenu = new ContextMenuPanel(win, {
    createTab: (url) => tabs.create(url), clipboard, dialog,
  })
  const rates = new RateStore(path.join(app.getPath('userData'), 'rates.json'))
  const archive = new ArchiveLookup()
  const switcher = new TabSwitcher(win, { tabs, thumbnails })
  const selection = new SelectionPanel(win, {
    clipboard,
    rates,
    prefs: () => settings.get('conversions'),
  })
  // A tab with a transfer running underneath it must stay awake; Electron only
  // tells us which webContents started it, so keep the count here.
  const downloadingBy = new Map()
  const hibernation = new HibernationManager(tabs, {
    config: () => settings.get('hibernation'),
    isDownloading: (tab) => !!(tab.webContents && downloadingBy.get(tab.webContents.id) > 0),
  })

  const self = {
    win, chrome, sidebarView, frameViews: { right: frameRight, bottom: frameBottom }, tabs, panel, bookmarks, history, downloads, settings, sessionStore, thumbnails, hibernation,
    sessionPrompt: new SessionPrompt(win), closing: false, recentUploads, recentUploadsReady,
    uploadPanel, contextMenu, selection, rates, archive, switcher, smokeClipboard, smokeUploadPaths, nativeBackdrop, popupPositioner: null,
    privateMode, fullScreenFrom: null,
  }
  browser = self
  browsers.add(self)
  tabs.onPageFocus = () => { panel.hide(); uploadPanel.cancel(); contextMenu.hide(); switcher.hide() }
  tabs.onVisit = (visit) => { if (!privateMode) history.record(visit) }
  downloads.onChange = (snapshot) => {
    for (const tab of tabs.tabs) {
      if (tab.url.startsWith(DOWNLOADS_URL) && tab.webContents && !tab.webContents.isDestroyed()) {
        tab.webContents.send(IPC.DOWNLOADS_CHANGED, snapshot)
      }
    }
  }
  session.defaultSession.on('will-download', (_event, item, webContents) => {
    downloads.track(item)
    const id = webContents?.id
    if (id == null) return
    downloadingBy.set(id, (downloadingBy.get(id) || 0) + 1)
    item.once('done', () => {
      const left = (downloadingBy.get(id) || 1) - 1
      if (left > 0) downloadingBy.set(id, left)
      else downloadingBy.delete(id)
    })
  })
  tabs.onVisitDetail = (detail) => history.decorate(detail.url, detail)
  tabs.onTabClosed = (tab) => history.noteClosedTab(tab)
  tabs.onSelectionChange = (tab) => {
    panel.hide(); uploadPanel.cancel(); contextMenu.hide(); selection.hide()
    nativeBackdrop.setActiveUrl(tab.url)
  }
  tabs.onNavigationChange = (tab) => {
    selection.hide()
    if (tabs.active?.id === tab.id) nativeBackdrop.setActiveUrl(tab.url)
  }
  tabs.onContextMenu = (tab, event, params) => {
    event.preventDefault()
    panel.hide()
    uploadPanel.cancel()
    selection.hide()
    contextMenu.open({ tab, params }).catch((error) => {
      console.error('[ember] context menu could not open:', error.message)
    })
  }
  contextMenu.onTabCommand = (tab, action) => runTabCommand(self, tab, action)
  contextMenu.onFavoriteCommand = (favorite, action) => (
    action === 'favorite-remove' ? removeFavorite(self, favorite.id) : false
  )
  contextMenu.onViewArchived = (tab, url) => openArchived(self, url)
  watchMainFrameStatus(privateMode ? session.fromPartition('persist:ember-private') : session.defaultSession, tabs)
  panel.onVisibilityChange = (open) => {
    if (!chrome.webContents.isDestroyed()) chrome.webContents.send(IPC.PANEL_CHANGED, open)
  }

  const { extensions } = setupExtensions(session.defaultSession, {
    createTab: (url, opts) => tabs.create(url, opts),
    getTab: (id) => tabs.tabs.find((t) => t.id === id),
    getWindow: () => win,
    selectTabByWebContents: (wc) => {
      const tab = tabs.tabs.find((t) => t.webContents === wc)
      if (tab) tabs.select(tab.id)
    },
    removeTabByWebContents: (wc) => {
      const tab = tabs.tabs.find((t) => t.webContents === wc)
      if (tab) tabs.close(tab.id)
    },
  })
  tabs.extensions = extensions
  browser.popupPositioner = new PopupPositioner(win, panel).attach(extensions)
  browser.testExtensionsReady = Promise.resolve()
  if (process.env.EMBER_SMOKE) {
    const extensionHost = session.defaultSession.extensions || session.defaultSession
    browser.testExtensionsReady = Promise.all(['popup-extension-a', 'popup-extension-b'].map((fixture) =>
      extensionHost.loadExtension(path.join(__dirname, '..', '..', 'test', 'fixtures', fixture), { allowFileAccess: true })
    ))
  }

  chrome.webContents.once('did-finish-load', () => {
    // Reopen the saved session when the user asked for it, otherwise a fresh tab.
    const restorable = settings.get('sessionRestore') !== SESSION_RESTORE.NEVER && sessionStore.hasSession()
    if (restorable) {
      const saved = sessionStore.snapshot().tabs
      const active = saved.findIndex((tab) => tab.active)
      // Restored background tabs start asleep, so reopening 20 tabs costs one
      // renderer rather than twenty.
      saved.forEach((tab, index) => tabs.create(tab.url, {
        active: false,
        asleep: index !== (active >= 0 ? active : 0),
        title: tab.title,
        favicon: tab.favicon,
      }))
      const target = tabs.tabs[active >= 0 ? active : 0]
      if (target) tabs.select(target.id)
      else tabs.create(NEW_TAB_URL)
    } else {
      tabs.create(NEW_TAB_URL)
    }
    broadcastBookmarks(bookmarks.snapshot())
    broadcastBangs(self)
    broadcastChromeConfig(self)
    broadcastWindowState(self)
    tabs.layout()
    hibernation.start()
  })
  sidebarView.webContents.once('did-finish-load', () => {
    tabs.emit()
    broadcastChromeConfig(self)
  })

  win.on('resize', () => {
    tabs.layout(); panel.layout(); uploadPanel.layout(); contextMenu.layout(); selection.layout()
    switcher.layout()
    browser?.popupPositioner?.layout()
    browser?.sessionPrompt?.layout(); rememberGeometry()
  })
  win.on('maximize', () => { syncOuterRadius(); broadcastWindowState(self) })
  win.on('unmaximize', () => { syncOuterRadius(); broadcastWindowState(self) })
  win.on('move', () => rememberGeometry())

  function rememberGeometry() {
    if (win.isDestroyed() || win.isMinimized()) return
    if (win.isMaximized()) { settings.rememberWindow({ ...(settings.get('window') || win.getBounds()), maximized: true }); return }
    settings.rememberWindow({ ...win.getBounds(), maximized: false })
  }

  // Ask before closing, then save or discard the session accordingly.
  win.on('close', (event) => {
    if (browser?.closing) return
    const open = tabs.tabs.filter((tab) => /^(https?|ember):/i.test(tab.url))
    const preference = settings.get('sessionRestore')

    if (preference === SESSION_RESTORE.ALWAYS) { sessionStore.saveSync(tabs.tabs, tabs.activeId); return }
    if (preference === SESSION_RESTORE.NEVER || open.length === 0) { sessionStore.clearSync(); return }

    event.preventDefault()
    browser.sessionPrompt.ask({ tabCount: open.length, targetView: tabs.active?.view }).then(async (answer) => {
      if (answer === 'cancel') return
      if (answer === 'always') await settings.set('sessionRestore', SESSION_RESTORE.ALWAYS)
      if (answer === 'never') await settings.set('sessionRestore', SESSION_RESTORE.NEVER)
      if (answer === 'yes' || answer === 'always') sessionStore.saveSync(tabs.tabs, tabs.activeId)
      else sessionStore.clearSync()
      browser.closing = true
      win.close()
    })
  })
  win.on('focus', () => { browser = self })
  win.on('closed', () => {
    hibernation.stop()
    nativeBackdrop.destroy()
    browsers.delete(self)
    if (browser === self) browser = [...browsers][browsers.size - 1] || null
  })
  return browser
}

// ---------------- unreachable pages and the archive ----------------
// One webRequest listener per session, so main-frame statuses reach the tab
// that asked for them. Only 404 and 410 mean anything to us.
const watchedSessions = new WeakSet()

function watchMainFrameStatus(target, tabs) {
  if (!target || watchedSessions.has(target)) return
  watchedSessions.add(target)
  target.webRequest.onCompleted({ urls: ['http://*/*', 'https://*/*'], types: ['mainFrame'] }, (details) => {
    if (!isDeadStatus(details.statusCode)) return
    const contents = webContents.fromId(details.webContentsId)
    if (contents) tabs.noteStatus(contents, details.url, details.statusCode)
  })
}

/**
 * Ask the Wayback Machine and, if it has a copy, go there. Never automatic —
 * every path into this function starts with someone choosing it.
 */
async function openArchived(current, url) {
  const target = String(url || current?.tabs.archiveTarget() || current?.tabs.active?.url || '')
  if (!current || !isArchivable(target)) return { ok: false, reason: 'unsupported' }
  const snapshot = await current.archive.find(target)
  if (!snapshot) return { ok: false, reason: 'not-archived' }
  current.tabs.go(snapshot.url)
  return { ok: true, ...snapshot }
}

// ---------------- tab strip commands ----------------
/** Runs a tab context-menu command. Shared by the menu and any future caller. */
async function runTabCommand(current, tab, action) {
  const tabs = current.tabs
  if (!tabs.tabs.includes(tab)) return false
  const domain = hostnameOf(tab.url)

  switch (action) {
    case 'tab-reload': tab.webContents?.reload(); return true
    case 'tab-duplicate': tabs.create(tab.url); return true
    case 'tab-sleep': return tabs.hibernate(tab.id)
    case 'tab-never-sleep': return tabs.setNeverSleep(tab.id, true)
    case 'tab-allow-sleep': return tabs.setNeverSleep(tab.id, false)
    case 'tab-never-sleep-domain':
    case 'tab-allow-domain': {
      if (!domain) return false
      const config = sanitiseHibernation(current.settings.get('hibernation'))
      const neverDomains = action === 'tab-never-sleep-domain'
        ? [...config.neverDomains, domain]
        : config.neverDomains.filter((entry) => entry !== domain)
      await current.settings.set('hibernation', { neverDomains })
      return true
    }
    case 'tab-close-others':
      for (const other of [...tabs.tabs]) if (other.id !== tab.id) tabs.close(other.id)
      return true
    case 'tab-close': tabs.close(tab.id); return true
    default: return false
  }
}

// ---------------- IPC: renderer -> main ----------------
function activeTabs() { return browser?.tabs }

ipcMain.on(IPC.TAB_CREATE, (_e, url) => activeTabs()?.create(url || NEW_TAB_URL))
ipcMain.on(IPC.TAB_CLOSE, (_e, id) => activeTabs()?.close(id))
ipcMain.on(IPC.TAB_SELECT, (_e, id) => activeTabs()?.select(id))
ipcMain.on(IPC.TAB_REORDER, (event, { id, beforeId = null } = {}) => {
  const current = browserFromSender(event.sender) || browser
  current?.tabs.move(Number(id), beforeId === null ? null : Number(beforeId))
})
ipcMain.on(IPC.TAB_CONTEXT_MENU, (_e, { id, x } = {}) => {
  const current = browser
  const tab = current?.tabs.tabs.find((candidate) => candidate.id === id)
  // The menu refracts the page below the strip, so it needs a live page view.
  const targetView = current?.tabs.active?.view
  if (!current || !tab || !targetView) return
  current.panel.hide()
  current.uploadPanel.cancel()
  const config = sanitiseHibernation(current.settings.get('hibernation'))
  const domain = hostnameOf(tab.url)
  current.contextMenu.openTabMenu({
    tab,
    targetView,
    x: Number(x) || 0,
    context: {
      domain,
      domainNeverSleeps: config.neverDomains.includes(domain),
      canSleep: !tab.asleep && tab.id !== current.tabs.activeId && /^https?:/i.test(tab.url),
      hasOtherTabs: current.tabs.tabs.length > 1,
    },
  }).catch((error) => console.error('[ember] tab menu could not open:', error.message))
})
ipcMain.on(IPC.NAV_BACK, () => activeTabs()?.back())
ipcMain.on(IPC.NAV_FORWARD, () => activeTabs()?.forward())
ipcMain.on(IPC.NAV_RELOAD, () => activeTabs()?.reload())
ipcMain.on(IPC.NAV_STOP, () => activeTabs()?.stop())
ipcMain.on(IPC.EXT_OPEN_STORE, () => { browser?.panel.hide(); activeTabs()?.create(WEB_STORE_URL) })
ipcMain.handle(IPC.EXT_LIST, () => listExtensions(session.defaultSession))
ipcMain.handle(IPC.EXT_REMOVE, async (_e, id) => {
  const ok = await removeExtension(session.defaultSession, id)
  return { ok, extensions: listExtensions(session.defaultSession) }
})

// The chrome view is 84px tall, so a dropdown would be clipped. While a panel
// is open the view covers the window and paints its own backdrop; collapsing
// hands clicks back to the page.
ipcMain.on(IPC.PANEL_TOGGLE, () => browser?.panel.toggle())
ipcMain.on(IPC.PANEL_CLOSE, () => browser?.panel.hide())
ipcMain.on(IPC.PANEL_RESIZE, (_e, height) => browser?.panel.setHeight(height))
ipcMain.on(IPC.PANEL_ANCHOR, (_e, rect) => {
  if (browser?.panel) browser.panel.popupAnchor = rect
})

ipcMain.on(IPC.UPLOAD_REQUEST, async (event, request) => {
  const current = browser
  const tab = current?.tabs.tabs.find((candidate) => candidate.webContents === event.sender)
  if (!current || !tab || !request?.requestId) return
  current.panel.hide()
  await current.recentUploadsReady
  try {
    await current.uploadPanel.openRequest({ tab, frame: event.senderFrame, request: {
      requestId: String(request.requestId),
      accept: String(request.accept || ''),
      multiple: !!request.multiple,
    } })
  } catch (error) {
    console.error('[ember] upload picker could not open:', error.message)
    if (!event.senderFrame.isDestroyed()) {
      event.senderFrame.send(IPC.UPLOAD_RESULT, { requestId: String(request.requestId), canceled: true })
    }
  }
})
ipcMain.on(IPC.OVERLAY_ACTION, (event, action, payload) => {
  const current = browser
  if (!current) return
  const command = String(action || '')
  if (command === 'session') {
    current.sessionPrompt.resolve(String(payload?.answer || 'cancel'))
    return
  }
  if (current.uploadPanel.isSender(event.sender)) {
    current.uploadPanel.handleAction(event.sender, command, payload)
    return
  }
  if (current.contextMenu.isSender(event.sender)) {
    current.contextMenu.handleAction(event.sender, command).catch((error) => {
      console.error('[ember] context menu action failed:', error.message)
    })
    return
  }
  if (current.selection.isSender(event.sender)) {
    current.selection.handleAction(event.sender, command)
    return
  }
  if (current.switcher.isSender(event.sender)) current.switcher.handleAction(event.sender, command, payload)
})
ipcMain.on(IPC.OVERLAY_CLOSE, (event) => {
  if (browser?.uploadPanel.isSender(event.sender)) browser.uploadPanel.cancel()
  else if (browser?.contextMenu.isSender(event.sender)) browser.contextMenu.hide()
  else if (browser?.selection.isSender(event.sender)) browser.selection.hide()
})

ipcMain.on(IPC.SELECTION_CHANGED, (event, payload) => {
  const current = browser
  const tab = current?.tabs.tabs.find((candidate) => candidate.webContents === event.sender)
  if (!current || !tab || tab.id !== current.tabs.activeId) return
  current.selection.update({ tab, text: payload?.text, rect: payload?.rect })
    .catch((error) => console.error('[ember] conversion popup failed:', error.message))
})

ipcMain.handle(IPC.BOOKMARKS_GET, () => browser?.bookmarks.snapshot() || { version: 1, visible: false, items: [] })
ipcMain.handle(IPC.BOOKMARKS_IMPORT, async () => {
  if (!browser) return { ok: false, error: 'Browser window is not available.' }
  const result = await dialog.showOpenDialog(browser.win, {
    title: 'Import bookmarks from file',
    properties: ['openFile'],
    filters: [{ name: 'Browser bookmark files', extensions: ['html', 'htm'] }],
  })
  if (result.canceled || !result.filePaths[0]) {
    return { ok: false, canceled: true, snapshot: browser.bookmarks.snapshot() }
  }
  try {
    const html = await fs.readFile(result.filePaths[0], 'utf8')
    const snapshot = await browser.bookmarks.importHtml(html)
    broadcastBookmarks(snapshot)
    return { ok: true, snapshot, file: path.basename(result.filePaths[0]) }
  } catch (error) {
    return { ok: false, canceled: false, error: error.message, snapshot: browser.bookmarks.snapshot() }
  }
})
/** The settings page needs the resolved bang table, not just the stored diff. */
function describeSettings(snapshot) {
  return {
    ...snapshot,
    appVersion: app.getVersion(),
    bangList: listBangs(snapshot.bangs),
    // Which aliases are Ember's own, so the page can offer to restore just
    // those without throwing away shortcuts the reader added.
    bangDefaults: DEFAULT_BANGS.map((entry) => entry.alias),
    favoriteDefaults: DEFAULT_FAVORITES.map((entry) => ({ ...entry })),
  }
}
ipcMain.handle(IPC.SETTINGS_GET, () => (browser ? describeSettings(browser.settings.snapshot()) : null))
ipcMain.handle(IPC.SETTINGS_SET, async (event, { key, value } = {}) => {
  const source = browserFromSender(event.sender) || browser
  if (!source) return null
  const preference = String(key)
  const snapshot = await source.settings.set(preference, value)
  for (const target of browsers) {
    if (target !== source) target.settings.sync(preference, snapshot[preference])
  }
  // Every window's omnibox matches against the same list.
  if (preference === 'bangs') for (const target of browsers) broadcastBangs(target)
  if (preference === 'favorites' || preference === 'sidebarOpen') {
    for (const target of browsers) {
      if (preference === 'sidebarOpen') target.tabs.setSidebarOpen?.(snapshot.sidebarOpen)
      broadcastChromeConfig(target)
    }
  }
  return describeSettings(snapshot)
})

ipcMain.handle(IPC.CHROME_CONFIG_GET, () => chromeConfig())

ipcMain.on(IPC.SIDEBAR_SET, async (event, open) => {
  const source = browserFromSender(event.sender) || browser
  if (!source) return
  const value = !!open
  for (const target of browsers) {
    target.tabs.setSidebarOpen?.(value, { animate: true })
    broadcastChromeConfig(target)
  }
  const snapshot = await source.settings.set('sidebarOpen', value)
  for (const target of browsers) {
    if (target !== source) target.settings.sync('sidebarOpen', snapshot.sidebarOpen)
  }
})

ipcMain.on(IPC.FAVORITE_OPEN, (event, id) => {
  const target = browserFromSender(event.sender) || browser
  if (!target) return
  const favorite = (target.settings.get('favorites') || []).find((entry) => entry.id === String(id))
  if (!favorite) return
  const existing = findFavoriteTab(target.tabs.tabs, favorite.url)
  if (existing !== null) target.tabs.select(existing)
  else target.tabs.create(favorite.url)
})

ipcMain.handle(IPC.FAVORITE_PIN_TAB, async (event, id) => {
  const source = browserFromSender(event.sender) || browser
  const tab = source?.tabs.tabs.find((candidate) => candidate.id === Number(id))
  if (!source || !tab) return { status: 'invalid', id: null }
  const result = favoriteFromTab(tab, source.settings.get('favorites'))
  if (result.status === 'added') await persistFavorites(source, result.favorites)
  return { status: result.status, id: result.favorite?.id || null }
})

ipcMain.on(IPC.FAVORITE_CONTEXT_MENU, (event, { id, x, y } = {}) => {
  const source = browserFromSender(event.sender) || browser
  const favorite = (source?.settings.get('favorites') || []).find((entry) => entry.id === String(id))
  if (!source || !favorite) return
  source.panel.hide()
  source.uploadPanel.cancel()
  source.contextMenu.openFavoriteMenu({
    favorite,
    targetView: source.sidebarView,
    backdropView: source.tabs.active?.view || source.sidebarView,
    point: { x: Number(x) || 0, y: Number(y) || 0 },
  }).catch((error) => console.error('[ember] Favorite menu could not open:', error.message))
})

ipcMain.handle(IPC.FAVORITE_REMOVE, (event, id) => {
  const source = browserFromSender(event.sender) || browser
  return removeFavorite(source, id)
})

ipcMain.handle(IPC.BANGS_GET, () => browser?.settings.get('bangs') || [])

// The new tab search box lives in a sandboxed page that cannot load the
// resolver, so it asks. Same function the navigation itself uses, so the
// preview and the outcome cannot drift apart.
ipcMain.handle(IPC.OMNIBOX_RESOLVE, (_e, text) => resolveInput(text, { bangs: browser?.settings.get('bangs') }))

const emptyDownloads = { version: 1, active: [], entries: [] }
ipcMain.handle(IPC.DOWNLOADS_QUERY, () => browser?.downloads.snapshot() || emptyDownloads)
ipcMain.handle(IPC.DOWNLOADS_ACTION, async (_e, { action, id } = {}) => {
  const store = browser?.downloads
  if (!store) return emptyDownloads
  if (action === 'pause') store.pause(id)
  else if (action === 'resume') store.resume(id)
  else if (action === 'cancel') store.cancel(id)
  else if (action === 'remove') return store.remove(id)
  else if (action === 'clear') return store.clear()
  else if (action === 'show') {
    const entry = store.snapshot().entries.find((e) => e.id === id)
    if (entry?.savePath) shell.showItemInFolder(entry.savePath)
  } else if (action === 'open') {
    const entry = store.snapshot().entries.find((e) => e.id === id)
    if (entry?.savePath) shell.openPath(entry.savePath)
  }
  return store.snapshot()
})

ipcMain.handle(IPC.ARCHIVE_OPEN, async (_e, url) => {
  if (!browser) return { ok: false, reason: 'unsupported' }
  return openArchived(browser, url)
})

ipcMain.handle(IPC.NATIVE_GLASS_SETTINGS, () => snapshotNativeGlassSettings(NATIVE_GLASS_DEFAULTS))
const emptyHistory = { version: 1, entries: [], recentlyClosed: [] }
ipcMain.handle(IPC.HISTORY_QUERY, () => browser?.history.snapshot() || emptyHistory)
ipcMain.handle(IPC.HISTORY_DELETE, async (_e, ids) => {
  if (!browser) return emptyHistory
  return browser.history.remove(Array.isArray(ids) ? ids : [ids])
})
ipcMain.handle(IPC.HISTORY_CLEAR, async (_e, range) => {
  if (!browser) return emptyHistory
  return browser.history.clear(range || {})
})
ipcMain.on(IPC.HISTORY_OPEN, (_e, url) => {
  const target = toNavigationUrl(url)  // already a real URL; no bang table needed
  if (target) activeTabs()?.create(target)
})

ipcMain.on(IPC.BOOKMARKS_VISIBILITY, async (_e, visible) => {
  if (!browser) return
  try {
    broadcastBookmarks(await browser.bookmarks.setVisible(visible))
  } catch (error) {
    console.error('[ember] bookmark visibility could not be saved:', error.message)
  }
})

ipcMain.on(IPC.NAV_GO, (_e, input) => {
  const url = toNavigationUrl(input, { bangs: browser?.settings.get('bangs') })
  if (url) activeTabs()?.go(url)
})

ipcMain.on(IPC.WIN_MINIMIZE, (event) => (browserFromSender(event.sender) || browser)?.win.minimize())
ipcMain.on(IPC.WIN_MAXIMIZE, (event) => {
  const win = (browserFromSender(event.sender) || browser)?.win
  if (!win) return
  win.isMaximized() ? win.unmaximize() : win.maximize()
})
ipcMain.on(IPC.WIN_CLOSE, (event) => (browserFromSender(event.sender) || browser)?.win.close())
ipcMain.on(IPC.WIN_DRAG_START, (event, point = {}) => {
  const target = browserFromSender(event.sender)
  if (!target || target.win.isMaximized()) return
  const x = Number(point.x)
  const y = Number(point.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return
  const [windowX, windowY] = target.win.getPosition()
  windowDrags.set(event.sender.id, { target, pointerX: x, pointerY: y, windowX, windowY })
})
ipcMain.on(IPC.WIN_DRAG_MOVE, (event, point = {}) => {
  const drag = windowDrags.get(event.sender.id)
  if (!drag || drag.target.win.isDestroyed()) return
  const x = Number(point.x)
  const y = Number(point.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return
  drag.target.win.setPosition(
    Math.round(drag.windowX + x - drag.pointerX),
    Math.round(drag.windowY + y - drag.pointerY),
  )
})
ipcMain.on(IPC.WIN_DRAG_END, (event) => windowDrags.delete(event.sender.id))
ipcMain.on(IPC.CORNER_MASK_INPUT, (event, input = {}) => {
  const target = browserFromSender(event.sender)
  const mask = target?.tabs?.pageCornerMasks?.find((entry) => entry.view.webContents === event.sender)
  const active = target?.tabs?.active
  if (!mask || !active?.view || !active.webContents || active.webContents.isDestroyed()) return
  const type = String(input.type)
  if (!['mouseDown', 'mouseUp', 'mouseMove', 'mouseLeave', 'mouseWheel'].includes(type)) return
  const localX = Number(input.x)
  const localY = Number(input.y)
  if (!Number.isFinite(localX) || !Number.isFinite(localY)) return
  const maskBounds = mask.view.getBounds()
  const pageBounds = active.view.getBounds()
  const translated = {
    type,
    x: Math.round(maskBounds.x - pageBounds.x + localX),
    y: Math.round(maskBounds.y - pageBounds.y + localY),
  }
  if (type === 'mouseWheel') {
    translated.deltaX = Math.round(Number(input.deltaX) || 0)
    translated.deltaY = Math.round(Number(input.deltaY) || 0)
  } else {
    translated.button = ['left', 'middle', 'right'].includes(input.button) ? input.button : 'left'
    translated.clickCount = Math.max(1, Math.min(3, Math.round(Number(input.clickCount) || 1)))
  }
  active.webContents.sendInputEvent(translated)
})

// ---------------- app lifecycle ----------------
function openInternal(url) {
  const tabs = activeTabs()
  if (!tabs) return
  const existing = tabs.tabs.find((tab) => tab.url.startsWith(url))
  if (existing) { tabs.select(existing.id); return }
  tabs.create(url)
}

function openHistory() { openInternal(HISTORY_URL) }

/** Run a resolved shortcut against the focused window. Returns true if handled. */
function runCommand({ command, index }) {
  const current = browser
  const tabs = current?.tabs
  const page = tabs?.active?.webContents

  switch (command) {
    case COMMANDS.NEW_TAB: tabs?.create(NEW_TAB_URL); return true
    case COMMANDS.CLOSE_TAB: tabs?.closeActive(); return true
    case COMMANDS.REOPEN_TAB: {
      const closed = current?.history.snapshot().recentlyClosed[0]
      if (closed) tabs?.create(closed.url)
      return true
    }
    // Ctrl+Tab walks the visual switcher; Ctrl+PageDown still cycles the strip.
    case COMMANDS.NEXT_TAB: return !!current?.switcher.step(1)
    case COMMANDS.PREVIOUS_TAB: return !!current?.switcher.step(-1)
    case COMMANDS.NEXT_TAB_STRIP: tabs?.cycle(1); return true
    case COMMANDS.PREVIOUS_TAB_STRIP: tabs?.cycle(-1); return true
    case COMMANDS.END_SWITCH: return !!current?.switcher.commit()
    case COMMANDS.SELECT_TAB: tabs?.selectIndex(index); return true
    case COMMANDS.LAST_TAB: tabs?.selectLast(); return true
    case COMMANDS.NEW_WINDOW: createBrowser(); return true
    case COMMANDS.NEW_PRIVATE_WINDOW: createBrowser({ privateMode: true }); return true
    case COMMANDS.CLOSE_WINDOW: current?.win.close(); return true
    case COMMANDS.BACK: tabs?.back(); return true
    case COMMANDS.FORWARD: tabs?.forward(); return true
    case COMMANDS.RELOAD: tabs?.reload(); return true
    case COMMANDS.HARD_RELOAD: tabs?.hardReload(); return true
    case COMMANDS.STOP:
      // Escape backs out of the switcher before it reaches the page.
      if (current?.switcher.cancel()) return true
      tabs?.stop()
      return true
    case COMMANDS.HISTORY: openHistory(); return true
    case COMMANDS.DOWNLOADS: openInternal(DOWNLOADS_URL); return true
    case COMMANDS.SETTINGS: openInternal(SETTINGS_URL); return true
    case COMMANDS.EXTENSIONS: openInternal(EXTENSIONS_URL); return true
    case COMMANDS.FULLSCREEN: {
      if (!current) return false
      // setFullScreen() is a no-op on a transparent frameless window on
      // Windows, so fill the display by hand and restore the old bounds.
      if (current.fullScreenFrom) {
        current.win.setBounds(current.fullScreenFrom)
        current.fullScreenFrom = null
      } else {
        current.fullScreenFrom = current.win.getBounds()
        const display = screen.getDisplayMatching(current.win.getBounds())
        current.win.setBounds(display.bounds)
      }
      return true
    }
    case COMMANDS.FOCUS_OMNIBOX:
      current?.chrome.webContents.focus()
      current?.chrome.webContents.executeJavaScript("document.getElementById('omnibox')?.select()").catch(() => {})
      return true
    case COMMANDS.FIND:
      // No find bar yet; let the page keep the keystroke rather than eating it.
      return false
    case COMMANDS.ZOOM_IN:
    case COMMANDS.ZOOM_OUT:
    case COMMANDS.ZOOM_RESET: {
      if (!page) return false
      const level = command === COMMANDS.ZOOM_RESET
        ? 0
        : nextZoom(page.getZoomLevel(), command === COMMANDS.ZOOM_IN ? 1 : -1)
      page.setZoomLevel(level)
      return true
    }
    default: return false
  }
}

app.on('web-contents-created', (_e, wc) => {
  wc.on('before-input-event', (event, input) => {
    const shortcut = resolveShortcut(input)
    if (!shortcut) return
    if (runCommand(shortcut)) event.preventDefault()
  })
  applyStoreRebranding(wc)
  // external protocols (mailto:, etc.) go to the OS, never to a tab
  wc.setWindowOpenHandler(({ url }) => {
    if (!/^https?:|^ember:/i.test(url)) { shell.openExternal(url); return { action: 'deny' } }
    return { action: 'allow' }
  })
})

app.whenReady().then(() => {
  handleInternalPages()
  createBrowser()

  app.on('activate', () => { if (!browser) createBrowser() })

  // Headless-ish boot check used by `npm run smoke` (AGENTS.md §3 push gate).
  if (process.env.EMBER_SMOKE) {
    setTimeout(async () => {
      const checks = []
      const skipped = []
      // Any single await in here can stall on a view that stops painting. A
      // named failure at 90s beats the runner's silent kill at 120s.
      const watchdog = setTimeout(() => {
        console.log('[ember] smoke FAILED: probe stalled before it finished')
        app.exit(1)
      }, 90_000)
      watchdog.unref?.()
      try {
        // Chromium stops painting an occluded window, which makes every capture
        // and every animation check meaningless. Put Ember in front first.
        browser.win.moveTop()
        const waitFor = async (probe, timeout = 3000) => {
          const started = Date.now()
          while (Date.now() - started < timeout) {
            const value = await probe()
            if (value) return value
            await new Promise((resolve) => setTimeout(resolve, 25))
          }
          return null
        }
        const active = browser?.tabs.active
        const testExtensions = await browser?.testExtensionsReady
        const fixtureIds = testExtensions.map((extension) => extension.id)
        await active?.webContents.loadURL('data:text/html,<title>Ember smoke page</title><main style="color:white">Rendered page</main>')

        // Some machines will not present a frame for an Electron window at all
        // — a wedged viz service answers UnknownVizError, an unpresented one
        // says the display surface is unavailable. Checks that need a real
        // frame cannot say anything then, so ask once and skip them loudly
        // rather than reporting a pass nobody earned or a failure that is
        // really about the compositor.
        const canCapture = await active?.webContents
          .capturePage({ x: 0, y: 0, width: 32, height: 32 })
          .then((shot) => !!shot && !shot.isEmpty())
          .catch(() => false)
        /** A check that is only meaningful when the compositor produces frames. */
        const visual = (name, ok) => { if (canCapture) checks.push([name, ok]); else skipped.push(name) }
        await browser?.chrome.webContents.executeJavaScript("document.getElementById('ext-btn').click()")
        await new Promise((resolve) => setTimeout(resolve, 250))
        checks.push(['window and tab created', !!browser && browser.tabs.tabs.length > 0])
        checks.push(['chrome loaded', !!browser?.chrome.webContents.getTitle()])
        checks.push(['extensions panel opened', !!browser?.panel.open && !!browser.panel.view?.getVisible()])
        checks.push(['web page remains visible', !!active?.view.getVisible()])
        const panelExpanded = await browser.chrome.webContents.executeJavaScript(
          "document.getElementById('ext-btn').getAttribute('aria-expanded') === 'true'"
        )
        checks.push(['extensions button reports panel open', panelExpanded])

        const fixtureRowsLoaded = await browser.panel.view.webContents.executeJavaScript(`(() => {
          const ids = ${JSON.stringify(fixtureIds)}
          return ids.length === 2 && ids.every((id) => document.querySelector(
            '.ext-launch[data-extension-id="' + id + '"]'
          ))
        })()`)
        checks.push(['multiple real extension rows loaded', fixtureRowsLoaded])
        if (fixtureRowsLoaded) {
          const clickFixture = (id) => browser.panel.view.webContents.executeJavaScript(
            `document.querySelector(${JSON.stringify(`.ext-launch[data-extension-id="${id}"]`)}).click()`
          )
          await clickFixture(fixtureIds[0])
          await new Promise((resolve) => setTimeout(resolve, 350))
          const firstPopup = browser.popupPositioner.popup
          await firstPopup?.whenReady()
          const firstInteraction = await firstPopup?.browserWindow.webContents.executeJavaScript(`(() => {
            const input = document.querySelector('input')
            input.value = 'typed in Ember'
            document.querySelector('button').click()
            return { value: input.value, clicked: document.body.dataset.clicked }
          })()`)
          checks.push(['extension popup content is interactive', firstInteraction?.value === 'typed in Ember' && firstInteraction.clicked === 'true'])
          const firstId = firstPopup?.extensionId

          await clickFixture(fixtureIds[1])
          await new Promise((resolve) => setTimeout(resolve, 350))
          const secondPopup = browser.popupPositioner.popup
          await secondPopup?.whenReady()
          checks.push(['different extension popup selected', !!firstId && secondPopup?.extensionId !== firstId])
          const popupBounds = secondPopup?.browserWindow.getBounds()
          const windowBounds = browser.win.getBounds()
          checks.push(['extension popup stays inside browser bounds', !!popupBounds
            && popupBounds.x >= windowBounds.x
            && popupBounds.y >= windowBounds.y
            && popupBounds.x + popupBounds.width <= windowBounds.x + windowBounds.width
            && popupBounds.y + popupBounds.height <= windowBounds.y + windowBounds.height])
        }

        await browser.recentUploadsReady
        await browser.recentUploads.add(browser.smokeUploadPaths)
        const uploadFixture = path.join(__dirname, '..', '..', 'test', 'fixtures', 'upload-page.html')
        await active.webContents.loadURL(pathToFileURL(uploadFixture).href)
        const clickInput = (id) => active.webContents.executeJavaScript(`document.getElementById(${JSON.stringify(id)}).click()`)

        await clickInput('single')
        const uploadOpened = await waitFor(() => browser.uploadPanel.overlay.open && browser.uploadPanel.overlay.loaded)
        checks.push(['real file input opens Ember picker', !!uploadOpened && browser.uploadPanel.overlay.view.getVisible()])
        checks.push(['picker shows real recent paths', browser.uploadPanel.overlay.state?.recents.some((item) => item.name === 'ember-icon.png')])
        checks.push(['picker shows live clipboard image', !!browser.uploadPanel.overlay.state?.clipboard])
        await browser.uploadPanel.overlay.view.webContents.executeJavaScript("document.getElementById('clipboard-slot').click()")
        const clipboardUpload = await waitFor(async () => {
          const value = await active.webContents.executeJavaScript('document.body.dataset.upload || null')
          return value && JSON.parse(value)
        })
        checks.push(['clipboard tile installs a real PNG File', clipboardUpload?.names[0]?.startsWith('clipboard-')
          && JSON.stringify(clipboardUpload.bytes) === JSON.stringify([137, 80, 78, 71, 13, 10, 26, 10])])

        await active.webContents.executeJavaScript('delete document.body.dataset.upload')
        await clickInput('single')
        await waitFor(() => browser.uploadPanel.overlay.open)
        await browser.uploadPanel.overlay.view.webContents.executeJavaScript(
          "[...document.querySelectorAll('.recent-file')].find((item) => item.textContent.includes('ember-icon.png')).click()"
        )
        const recentUpload = await waitFor(async () => {
          const value = await active.webContents.executeJavaScript('document.body.dataset.upload || null')
          return value && JSON.parse(value)
        })
        checks.push(['recent tile returns source bytes and metadata', recentUpload?.names[0] === 'ember-icon.png'
          && recentUpload.sizes[0] === (await fs.stat(browser.smokeUploadPaths[0])).size])

        await active.webContents.executeJavaScript('delete document.body.dataset.upload')
        await clickInput('multiple')
        await waitFor(() => browser.uploadPanel.overlay.open)
        await browser.uploadPanel.overlay.view.webContents.executeJavaScript("document.getElementById('show-all-files').click()")
        const multipleUpload = await waitFor(async () => {
          const value = await active.webContents.executeJavaScript('document.body.dataset.upload || null')
          return value && JSON.parse(value)
        })
        checks.push(['Show all files supports a real multiple selection', multipleUpload?.names.length === 2
          && multipleUpload.names.includes('ember-icon.png') && multipleUpload.names.includes('glass-toggler-map.webp')])

        browser.smokeClipboard.image = nativeImage.createEmpty()
        await clickInput('single')
        await waitFor(() => browser.uploadPanel.overlay.open)
        const clipboardAbsent = await browser.uploadPanel.overlay.view.webContents.executeJavaScript(
          "document.getElementById('clipboard-section').hidden"
        )
        checks.push(['clipboard tile disappears when no image exists', clipboardAbsent && !browser.uploadPanel.overlay.state.clipboard])
        await browser.uploadPanel.overlay.view.webContents.executeJavaScript(
          "window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))"
        )
        const uploadCanceled = await waitFor(() => !browser.uploadPanel.overlay.open)
        const cancelCount = await active.webContents.executeJavaScript("document.body.dataset.canceled")
        checks.push(['picker Escape cancels without selecting', !!uploadCanceled && cancelCount === '1'])
        browser.smokeClipboard.image = nativeImage.createFromPath(browser.smokeUploadPaths[1])

        await browser.chrome.webContents.executeJavaScript("document.getElementById('ext-btn').click()")
        await waitFor(() => browser.panel.open)
        await browser.panel.view.webContents.executeJavaScript(
          `document.querySelector(${JSON.stringify(`.ext-launch[data-extension-id="${fixtureIds[1]}"]`)}).click()`
        )
        await waitFor(() => browser.popupPositioner.popup?.extensionId === fixtureIds[1])

        const originalBookmarks = browser.bookmarks.snapshot()
        broadcastBookmarks({ ...originalBookmarks, visible: true })
        const bookmarksShown = await browser.chrome.webContents.executeJavaScript(
          "!document.getElementById('bookmarks-bar').hidden"
        )
        checks.push(['bookmarks bar updates live', bookmarksShown])

        for (const [width, height] of [[1280, 820], [900, 640], [620, 420], [900, 420]]) {
          browser.win.setBounds({ ...browser.win.getBounds(), width, height })
          browser.tabs.layout()
          browser.panel.layout()
          browser.popupPositioner.layout()
          const content = browser.win.getContentBounds()
          const page = active.view.getBounds()
          const { radius: _radius, ...expectedPage } = viewportBounds({
            ...content,
            sidebarOpen: browser.tabs.sidebarOpen,
            bookmarksVisible: browser.tabs.bookmarksVisible,
          })
          const panel = browser.panel.bounds
          checks.push([`layout ${width}x${height}`, JSON.stringify(page) === JSON.stringify(expectedPage)
            && panel.x >= 0 && panel.x + panel.width <= content.width
            && panel.y >= browser.tabs.chromeHeight - 6
            && panel.y + panel.height <= content.height])
          const popup = browser.popupPositioner.popup
          const popupBounds = popup?.browserWindow.getBounds()
          const windowBounds = browser.win.getBounds()
          checks.push([`popup ${width}x${height}`, !!popupBounds
            && popupBounds.x >= windowBounds.x
            && popupBounds.y >= windowBounds.y
            && popupBounds.x + popupBounds.width <= windowBounds.x + windowBounds.width
            && popupBounds.y + popupBounds.height <= windowBounds.y + windowBounds.height])
        }
        const constrainedPopupScrolls = await browser.popupPositioner.popup?.browserWindow.webContents.executeJavaScript(
          'document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight'
        )
        checks.push(['oversized popup remains scrollable', constrainedPopupScrolls])
        broadcastBookmarks(originalBookmarks)

        const chromeFits = await browser.chrome.webContents.executeJavaScript(
          'document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight'
        )
        checks.push(['chrome has no overflow', chromeFits])
        browser.panel.hide()
        await new Promise((resolve) => setTimeout(resolve, 50))
        const panelCollapsed = await browser.chrome.webContents.executeJavaScript(
          "document.getElementById('ext-btn').getAttribute('aria-expanded') === 'false'"
        )
        checks.push(['extensions button reports panel closed', panelCollapsed])

        browser.tabs.select(active.id)
        active.webContents.focus()
        const rightClick = async (x, y) => {
          active.webContents.sendInputEvent({ type: 'mouseDown', button: 'right', x, y, clickCount: 1 })
          active.webContents.sendInputEvent({ type: 'mouseUp', button: 'right', x, y, clickCount: 1 })
          return waitFor(() => browser.contextMenu.overlay.open)
        }
        let cornersClamped = true
        const pageBounds = active.view.getBounds()
        for (const [x, y] of [[1, 1], [pageBounds.width - 2, 1], [1, pageBounds.height - 2], [pageBounds.width - 2, pageBounds.height - 2]]) {
          await rightClick(x, y)
          const bounds = browser.contextMenu.overlay.bounds
          cornersClamped = cornersClamped && bounds.x >= pageBounds.x && bounds.y >= pageBounds.y
            && bounds.x + bounds.width <= pageBounds.x + pageBounds.width
            && bounds.y + bounds.height <= pageBounds.y + pageBounds.height
          browser.contextMenu.hide()
          active.webContents.focus()
        }
        checks.push(['context menu clamps at all four page corners', cornersClamped])

        await rightClick(20, 20)
        const contextState = browser.contextMenu.overlay.state
        checks.push(['right-click opens custom glass commands', contextState?.kind === 'context-menu'
          && contextState.items.some((item) => item.id === 'reload')])
        visual('the glass menu refracts a real capture of the page', !!contextState?.backdrop)
        const lensProbe = await browser.contextMenu.overlay.view.webContents.executeJavaScript(`(async () => {
          const enabled = [...document.querySelectorAll('.menu-item:not(:disabled)')]
          const lens = document.getElementById('selector-lens')
          const waitForY = async (predicate) => {
            const deadline = performance.now() + 1000
            let y = lens.getBoundingClientRect().y
            while (!predicate(y) && performance.now() < deadline) {
              // A view that is not painting never fires rAF, and the deadline
              // below would then never be re-read. The timer guarantees a tick.
              await new Promise((resolve) => { requestAnimationFrame(resolve); setTimeout(resolve, 50) })
              y = lens.getBoundingClientRect().y
            }
            return y
          }
          enabled[0].dispatchEvent(new PointerEvent('pointerenter'))
          enabled.at(-1).dispatchEvent(new PointerEvent('pointerenter'))
          const bottom = await waitForY((y) => y > 50)
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }))
          const top = await waitForY((y) => y < bottom - 20)
          return {
            oneLens: document.querySelectorAll('#selector-lens').length === 1,
            moved: bottom > top,
            oneActive: document.querySelectorAll('.menu-item[data-active="true"]').length === 1,
            disabledActive: !!document.querySelector('.menu-item:disabled[data-active="true"]'),
          }
        })()`)
        checks.push(['one liquid selector, on exactly one enabled item', lensProbe.oneLens
          && lensProbe.oneActive && !lensProbe.disabledActive])
        // Moving the lens is a CSS transition, which needs frames to advance.
        visual('the liquid selector retargets across pointer and keyboard', lensProbe.moved)
        await browser.contextMenu.overlay.view.webContents.executeJavaScript(
          "window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))"
        )
        checks.push(['context menu Escape closes', !!await waitFor(() => !browser.contextMenu.overlay.open)])

        const linkPoint = await active.webContents.executeJavaScript(`(() => {
          const rect = document.getElementById('fixture-link').getBoundingClientRect()
          return { x: Math.round(rect.left + 4), y: Math.round(rect.top + 4) }
        })()`)
        await rightClick(linkPoint.x, linkPoint.y)
        const linkActionVisible = browser.contextMenu.overlay.state?.items.some((item) => item.id === 'open-link')
        const previousTabCount = browser.tabs.tabs.length
        if (linkActionVisible) {
          await browser.contextMenu.overlay.view.webContents.executeJavaScript(
            "[...document.querySelectorAll('.menu-item')].find((item) => item.textContent.includes('Open link in new tab')).click()"
          )
        }
        await waitFor(() => browser.tabs.tabs.length > previousTabCount)
        checks.push(['context link command opens a real tab', linkActionVisible && browser.tabs.tabs.length === previousTabCount + 1])

        // ---- hibernation: the renderer really goes away, and really comes back ----
        const homeId = browser.tabs.activeId
        const sleeperId = browser.tabs.create(pathToFileURL(uploadFixture).href, { active: false })
        const sleeper = browser.tabs.tabs.find((tab) => tab.id === sleeperId)
        await waitFor(() => !sleeper.loading && !!sleeper.webContents?.getURL())
        // Show it once so the thumbnail cache has a frame to keep.
        browser.tabs.select(sleeperId)
        await new Promise((resolve) => setTimeout(resolve, 250))
        browser.tabs.select(homeId)
        await waitFor(() => browser.thumbnails.has(sleeperId), 2000)

        const liveBefore = webContents.getAllWebContents().length
        checks.push(['the active tab refuses to sleep', !(await browser.tabs.hibernate(homeId))])
        const slept = await browser.tabs.hibernate(sleeperId)
        // destroy() tears the renderer down on the next turn of the loop.
        const dropped = await waitFor(() => webContents.getAllWebContents().length === liveBefore - 1)
        checks.push(['sleeping a tab destroys its renderer', slept && sleeper.asleep
          && !sleeper.webContents && !sleeper.view && !!dropped])
        checks.push(['a sleeping tab keeps its identity', browser.tabs.tabs.some((tab) => tab.id === sleeperId)
          && sleeper.url.endsWith('upload-page.html') && !!sleeper.title])
        visual('a sleeping tab keeps a cached screenshot', !!browser.thumbnails.get(sleeperId)?.dataUrl)
        const sleepingState = browser.tabs.state().tabs.find((tab) => tab.id === sleeperId)
        checks.push(['the tab strip is told the tab is asleep', sleepingState?.asleep === true])

        browser.tabs.select(sleeperId)
        const woken = await waitFor(() => !sleeper.asleep && !sleeper.loading && !!sleeper.webContents?.getURL(), 8000)
        checks.push(['selecting a sleeping tab rebuilds it', !!woken && browser.tabs.activeId === sleeperId
          && webContents.getAllWebContents().length === liveBefore])

        // Never-sleep is honoured by the manual command too, through the menu.
        browser.tabs.select(homeId)
        browser.tabs.setNeverSleep(sleeperId, true)
        checks.push(['never-sleep is reported to the tab strip',
          browser.tabs.state().tabs.find((tab) => tab.id === sleeperId)?.neverSleep === true])
        checks.push(['a never-sleep tab is skipped by the sweep',
          !(await browser.hibernation.sweep(Date.now() + 86_400_000)).includes(sleeperId)])
        browser.tabs.close(sleeperId)
        checks.push(['closing a tab drops its thumbnail', !browser.thumbnails.has(sleeperId)])

        // ---- what survives the discard: the back stack, the scroll, the zoom ----
        const tallPage = (name) => 'data:text/html,' + encodeURIComponent(
          `<title>${name}</title><body style="height:6000px"><h1>${name}</h1>`)
        const keptId = browser.tabs.create(tallPage('first'), { active: true })
        const kept = browser.tabs.tabs.find((tab) => tab.id === keptId)
        await waitFor(() => !kept.loading && !!kept.webContents?.getURL())
        await kept.webContents.loadURL(tallPage('second'))
        await kept.webContents.executeJavaScript('window.scrollTo(0, 1200)')
        await waitFor(async () => (await kept.webContents.executeJavaScript('window.scrollY')) === 1200)
        kept.webContents.setZoomLevel(1)
        browser.tabs.select(homeId)
        await waitFor(() => browser.tabs.activeId === homeId)

        checks.push(['a tab has somewhere to go back to before it sleeps',
          kept.webContents.navigationHistory.canGoBack()])
        await browser.tabs.hibernate(keptId)
        checks.push(['sleeping keeps the back stack', (kept.history?.entries.length || 0) >= 2])
        checks.push(['sleeping keeps the scroll offset and zoom',
          kept.restore?.scroll?.y === 1200 && kept.restore?.zoomLevel === 1])

        browser.tabs.select(keptId)
        await waitFor(() => !kept.asleep && !kept.loading && !!kept.webContents?.getURL(), 8000)
        checks.push(['waking lands on the same page',
          (await kept.webContents.executeJavaScript('document.title')) === 'second'])
        checks.push(['waking restores the back button', kept.webContents.navigationHistory.canGoBack()])
        const scrolledBack = await waitFor(async () => {
          const y = await kept.webContents.executeJavaScript('window.scrollY')
          return y >= 1190 ? y : null
        }, 6000)
        checks.push(['waking puts the reader back where they were', !!scrolledBack])
        checks.push(['waking restores the zoom', kept.webContents.getZoomLevel() === 1])

        // Clicking a tab while its discard is already in flight must win.
        browser.tabs.select(homeId)
        await waitFor(() => browser.tabs.activeId === homeId)
        const raced = browser.tabs.hibernate(keptId)
        browser.tabs.select(keptId)
        checks.push(['a click beats a discard that is already in flight', (await raced) === false
          && !kept.asleep && !!kept.webContents && !kept.webContents.isDestroyed()])
        browser.tabs.select(homeId)
        browser.tabs.close(keptId)

        // ---- quick searches, from the keystroke to the navigation ----
        const omnibox = (script) => browser.chrome.webContents.executeJavaScript(`(() => {
          const box = document.getElementById('omnibox')
          const chip = document.getElementById('bang-chip')
          const tip = document.getElementById('bang-tip')
          const read = () => ({
            value: box.value,
            chip: chip.hidden ? null : chip.textContent,
            engaged: chip.classList.contains('engaged'),
            tip: !tip.hidden,
          })
          const type = (text) => { box.value = text; box.dispatchEvent(new Event('input')) }
          const press = (key) => box.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
          // The omnibox is one long-lived element, so each probe starts from
          // a known state rather than wherever the last one left it.
          press('Escape')
          type('')
          ${script}
        })()`)

        const typed = await omnibox("type('yt liquid glass'); return read()")
        checks.push(['the omnibox names the quick search as you type',
          typed.chip === 'YouTube' && !typed.engaged && !typed.tip])
        const plain = await omnibox("type('example.com'); return read()")
        checks.push(['a plain address shows no quick search', plain.chip === null])
        const bare = await omnibox("type('gh'); return read()")
        checks.push(['a keyword on its own offers Tab', bare.chip === 'GitHub' && bare.tip])

        const engagedState = await omnibox("type('gh'); press('Tab'); return read()")
        checks.push(['Tab commits to the engine and clears the keyword',
          engagedState.engaged && engagedState.value === '' && engagedState.chip === 'GitHub'])
        const backedOut = await omnibox("type('gh'); press('Tab'); press('Backspace'); return read()")
        checks.push(['Backspace out of an empty query gives the keyword back',
          !backedOut.engaged && backedOut.value === 'gh'])

        // The renderer answers from its own copy of the list, so a change made
        // here has to reach it before the omnibox can agree with the resolver.
        await browser.settings.set('bangs', [{ alias: 'zz', name: 'Probe', url: 'https://smoke.invalid/?q=%s' }])
        broadcastBangs()
        const custom = await waitFor(async () => {
          const state = await omnibox("type('zz cats'); return read()")
          return state.chip === 'Probe' ? state : null
        })
        checks.push(['a shortcut added in settings reaches the omnibox', !!custom])

        // Tab, type the query, press Enter: the address that comes out is the
        // template with the term in it. .invalid never resolves, so the failure
        // page records exactly where Ember tried to go.
        await omnibox("type('zz'); press('Tab'); type('cats'); box.form.dispatchEvent(new Event('submit', { cancelable: true })); return read()")
        const navigated = await waitFor(() => browser.tabs.active?.failedUrl, 8000)
        checks.push(['an engaged quick search navigates to the expanded template',
          navigated === 'https://smoke.invalid/?q=cats'])
        await browser.settings.set('bangs', [])
        broadcastBangs()
      } catch (error) {
        console.error('[ember] smoke probe error:', error)
        checks.push(['smoke probe completed', false])
      }
      if (skipped.length) {
        console.log(`[ember] smoke SKIPPED (this machine renders no frames): ${skipped.join(', ')}`)
      }
      const failed = checks.filter(([, ok]) => !ok).map(([name]) => name)
      console.log(failed.length ? `[ember] smoke FAILED: ${failed.join(', ')}` : '[ember] smoke ok')
      clearTimeout(watchdog)
      app.exit(failed.length ? 1 : 0)
    }, 6000)
  }
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

module.exports = { CHROME_HEIGHT }
