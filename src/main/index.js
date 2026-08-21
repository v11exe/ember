const path = require('node:path')
const fs = require('node:fs/promises')
const { pathToFileURL } = require('node:url')
const { app, BaseWindow, WebContentsView, clipboard, dialog, ipcMain, nativeImage, session, shell } = require('electron')

const { IPC, NEW_TAB_URL, WEB_STORE_URL } = require('../shared/ipc')
const { toNavigationUrl } = require('../shared/urls')
const { TabManager, CHROME_HEIGHT } = require('./tabs')
const { setupExtensions, applyStoreRebranding, listExtensions, removeExtension } = require('./extensions')
const { registerSchemePrivileges, handleInternalPages } = require('./protocol')
const { ExtensionPanel } = require('./panel')
const { BookmarkStore } = require('./bookmarks')
const { PopupPositioner } = require('./popup-positioner')
const { RecentUploadStore } = require('./recent-uploads')
const { UploadPanel } = require('./upload-panel')
const { ContextMenuPanel } = require('./context-menu-panel')

if (process.env.EMBER_SMOKE_USER_DATA) app.setPath('userData', process.env.EMBER_SMOKE_USER_DATA)
registerSchemePrivileges()

/** @type {{ win: BaseWindow, chrome: WebContentsView, tabs: TabManager, uploadPanel: UploadPanel, contextMenu: ContextMenuPanel }|null} */
let browser = null

function broadcastBookmarks(snapshot) {
  if (!browser) return snapshot
  browser.tabs.setBookmarksVisible(snapshot.visible)
  browser.panel.setTop(browser.tabs.chromeHeight - 6)
  browser.popupPositioner?.layout()
  browser.chrome.webContents.send(IPC.BOOKMARKS_CHANGED, snapshot)
  return snapshot
}

function createBrowser() {
  const win = new BaseWindow({
    width: 1280,
    height: 820,
    minWidth: 620,
    minHeight: 420,
    frame: false,
    icon: path.join(__dirname, '..', 'renderer', 'assets', 'ember-app-icon.png'),
    backgroundColor: '#000000',
    title: 'Ember',
  })

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

  const tabs = new TabManager(win, chrome)
  const panel = new ExtensionPanel(win)
  const bookmarks = new BookmarkStore(path.join(app.getPath('userData'), 'bookmarks.json'))
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
  browser = {
    win, chrome, tabs, panel, bookmarks, recentUploads, recentUploadsReady,
    uploadPanel, contextMenu, smokeClipboard, smokeUploadPaths, popupPositioner: null,
  }
  tabs.onPageFocus = () => { panel.hide(); uploadPanel.cancel(); contextMenu.hide() }
  tabs.onSelectionChange = () => { panel.hide(); uploadPanel.cancel(); contextMenu.hide() }
  tabs.onContextMenu = (tab, event, params) => {
    event.preventDefault()
    panel.hide()
    uploadPanel.cancel()
    contextMenu.open({ tab, params }).catch((error) => {
      console.error('[ember] context menu could not open:', error.message)
    })
  }
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
    tabs.create(NEW_TAB_URL)
    broadcastBookmarks(bookmarks.snapshot())
    tabs.layout()
  })

  win.on('resize', () => {
    tabs.layout(); panel.layout(); uploadPanel.layout(); contextMenu.layout(); browser?.popupPositioner?.layout()
  })
  win.on('closed', () => { browser = null })
  return browser
}

// ---------------- IPC: renderer -> main ----------------
function activeTabs() { return browser?.tabs }

ipcMain.on(IPC.TAB_CREATE, (_e, url) => activeTabs()?.create(url || NEW_TAB_URL))
ipcMain.on(IPC.TAB_CLOSE, (_e, id) => activeTabs()?.close(id))
ipcMain.on(IPC.TAB_SELECT, (_e, id) => activeTabs()?.select(id))
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
  if (current.uploadPanel.isSender(event.sender)) {
    current.uploadPanel.handleAction(event.sender, command, payload)
    return
  }
  if (current.contextMenu.isSender(event.sender)) {
    current.contextMenu.handleAction(event.sender, command).catch((error) => {
      console.error('[ember] context menu action failed:', error.message)
    })
  }
})
ipcMain.on(IPC.OVERLAY_CLOSE, (event) => {
  if (browser?.uploadPanel.isSender(event.sender)) browser.uploadPanel.cancel()
  else if (browser?.contextMenu.isSender(event.sender)) browser.contextMenu.hide()
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
ipcMain.on(IPC.BOOKMARKS_VISIBILITY, async (_e, visible) => {
  if (!browser) return
  try {
    broadcastBookmarks(await browser.bookmarks.setVisible(visible))
  } catch (error) {
    console.error('[ember] bookmark visibility could not be saved:', error.message)
  }
})

ipcMain.on(IPC.NAV_GO, (_e, input) => {
  const url = toNavigationUrl(input)
  if (url) activeTabs()?.go(url)
})

ipcMain.on(IPC.WIN_MINIMIZE, () => browser?.win.minimize())
ipcMain.on(IPC.WIN_MAXIMIZE, () => {
  const win = browser?.win
  if (!win) return
  win.isMaximized() ? win.unmaximize() : win.maximize()
})
ipcMain.on(IPC.WIN_CLOSE, () => browser?.win.close())

// ---------------- app lifecycle ----------------
app.on('web-contents-created', (_e, wc) => {
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
      try {
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
          const panel = browser.panel.bounds
          checks.push([`layout ${width}x${height}`, page.y === browser.tabs.chromeHeight
            && page.width === content.width
            && page.height === content.height - browser.tabs.chromeHeight
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
          && contextState.items.some((item) => item.id === 'reload') && !!contextState.backdrop])
        const lensProbe = await browser.contextMenu.overlay.view.webContents.executeJavaScript(`(async () => {
          const enabled = [...document.querySelectorAll('.menu-item:not(:disabled)')]
          const lens = document.getElementById('selector-lens')
          const waitForY = async (predicate) => {
            const deadline = performance.now() + 1000
            let y = lens.getBoundingClientRect().y
            while (!predicate(y) && performance.now() < deadline) {
              await new Promise((resolve) => requestAnimationFrame(resolve))
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
        checks.push(['one liquid selector retargets across pointer and keyboard', lensProbe.oneLens
          && lensProbe.moved && lensProbe.oneActive && !lensProbe.disabledActive])
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
      } catch (error) {
        console.error('[ember] smoke probe error:', error)
        checks.push(['smoke probe completed', false])
      }
      const failed = checks.filter(([, ok]) => !ok).map(([name]) => name)
      console.log(failed.length ? `[ember] smoke FAILED: ${failed.join(', ')}` : '[ember] smoke ok')
      app.exit(failed.length ? 1 : 0)
    }, 6000)
  }
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

module.exports = { CHROME_HEIGHT }
