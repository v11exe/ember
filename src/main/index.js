const path = require('node:path')
const { app, BaseWindow, WebContentsView, ipcMain, session, shell } = require('electron')

const { IPC, NEW_TAB_URL, WEB_STORE_URL } = require('../shared/ipc')
const { toNavigationUrl } = require('../shared/urls')
const { TabManager, CHROME_HEIGHT } = require('./tabs')
const { setupExtensions, applyStoreRebranding, listExtensions, removeExtension } = require('./extensions')
const { registerSchemePrivileges, handleInternalPages } = require('./protocol')
const { ExtensionPanel } = require('./panel')

registerSchemePrivileges()

/** @type {{ win: BaseWindow, chrome: WebContentsView, tabs: TabManager }|null} */
let browser = null

function createBrowser() {
  const win = new BaseWindow({
    width: 1280,
    height: 820,
    minWidth: 620,
    minHeight: 420,
    frame: false,
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
  browser = { win, chrome, tabs, panel }
  tabs.onPageFocus = () => panel.hide()

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

  chrome.webContents.once('did-finish-load', () => {
    tabs.create(NEW_TAB_URL)
    tabs.layout()
  })

  win.on('resize', () => { tabs.layout(); panel.layout() })
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
    setTimeout(() => {
      const ok = !!browser && browser.tabs.tabs.length > 0 && !!browser.chrome.webContents.getTitle()
      console.log(ok ? '[ember] smoke ok' : '[ember] smoke FAILED')
      app.exit(ok ? 0 : 1)
    }, 6000)
  }
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

module.exports = { CHROME_HEIGHT }
