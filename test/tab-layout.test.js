const test = require('node:test')
const assert = require('node:assert/strict')

const { TabManager } = require('../src/main/tabs')
const { SIDEBAR_TRANSITION_MS } = require('../src/shared/chrome-layout')
const { IPC } = require('../src/shared/ipc')

function fixture({ width = 1270, height = 740, sidebarOpen = true } = {}) {
  const chromeBounds = []
  const sidebarBounds = []
  const pageBounds = []
  const radii = []
  const fullscreen = []
  const shellMetrics = { chrome: [], sidebar: [], right: [], bottom: [], masks: {} }
  const webContents = (target) => ({
    isDestroyed: () => false,
    send: (channel, payload) => { if (channel === IPC.SHELL_METRICS) target.push(payload) },
  })
  const win = {
    on: () => {},
    getContentBounds: () => ({ width, height }),
    contentView: { addChildView: () => {} },
    setFullScreen: (open) => fullscreen.push(open),
  }
  const chrome = {
    setBounds: (bounds, options) => chromeBounds.push({ bounds, options }),
    webContents: webContents(shellMetrics.chrome),
  }
  const sidebar = {
    setBounds: (bounds, options) => sidebarBounds.push({ bounds, options }),
    getBounds: () => sidebarBounds.at(-1)?.bounds || { x: 0, y: 0, width: 168, height },
    setVisible: () => {},
    webContents: webContents(shellMetrics.sidebar),
  }
  const frameView = (target) => ({
    setBounds(bounds) { this.bounds = bounds },
    getBounds() { return this.bounds },
    webContents: webContents(target),
  })
  const frameViews = {
    right: frameView(shellMetrics.right),
    bottom: frameView(shellMetrics.bottom),
  }
  const pageCornerMasks = ['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((corner) => {
    const target = shellMetrics.masks[corner] = []
    return {
      corner,
      view: {
        setBounds(bounds) { this.bounds = bounds },
        setVisible: () => {},
        webContents: webContents(target),
      },
    }
  })
  const page = {
    setBounds: (bounds, options) => pageBounds.push({ bounds, options }),
    getBounds: () => pageBounds.at(-1)?.bounds || { x: 168, y: 32, width: width - 176, height: height - 40 },
    setBorderRadius: (radius) => radii.push(radius),
  }
  const tabs = new TabManager(win, chrome, { sidebarOpen, sidebarView: sidebar, frameViews, pageCornerMasks })
  tabs.tabs = [{
    id: 1,
    view: page,
    webContents: { navigationHistory: { canGoBack: () => false, canGoForward: () => false } },
    url: 'https://example.com/',
  }]
  tabs.activeId = 1
  return { tabs, chromeBounds, sidebarBounds, pageBounds, radii, fullscreen, frameViews, pageCornerMasks, shellMetrics }
}

test('layout keeps bounded chrome away from the translucent native page', () => {
  const { tabs, chromeBounds, sidebarBounds, pageBounds, radii } = fixture()
  tabs.layout()

  assert.deepEqual(chromeBounds.at(-1), {
    bounds: { x: 0, y: 0, width: 1270, height: 32 }, options: undefined,
  })
  assert.deepEqual(sidebarBounds.at(-1), {
    bounds: { x: 0, y: 0, width: 168, height: 740 }, options: undefined,
  })
  assert.deepEqual(pageBounds.at(-1), {
    bounds: { x: 168, y: 32, width: 1094, height: 700 }, options: undefined,
  })
  assert.equal(radii.at(-1), 12)
})

test('HTML fullscreen gives the active page the entire native display surface', () => {
  const { tabs, chromeBounds, sidebarBounds, pageBounds, radii, fullscreen } = fixture()
  tabs.enterHtmlFullscreen(tabs.active)

  assert.deepEqual(fullscreen, [true])
  assert.deepEqual(pageBounds.at(-1).bounds, { x: 0, y: 0, width: 1270, height: 740 })
  assert.equal(radii.at(-1), 0)
  assert.deepEqual(chromeBounds.at(-1).bounds, { x: 0, y: 0, width: 0, height: 0 })
  assert.deepEqual(sidebarBounds.at(-1).bounds, { x: 0, y: 0, width: 0, height: 0 })

  tabs.leaveHtmlFullscreen(tabs.active)
  assert.deepEqual(fullscreen, [true, false])
  assert.deepEqual(pageBounds.at(-1).bounds, { x: 168, y: 32, width: 1094, height: 700 })
})

test('sidebar toggling animates the real page and retains the Ember rail', async () => {
  const { tabs, pageBounds } = fixture()
  tabs.layout()
  const before = pageBounds.length
  tabs.setSidebarOpen(false, { animate: true })
  await new Promise((resolve) => setTimeout(resolve, SIDEBAR_TRANSITION_MS + 45))

  assert.equal(tabs.sidebarOpen, false)
  assert.ok(pageBounds.length > before + 2, 'native page receives intermediate frame-synchronous bounds')
  assert.deepEqual(pageBounds.at(-1), {
    bounds: { x: 8, y: 32, width: 1254, height: 700 },
    options: undefined,
  })
})

test('an explicitly visible bookmarks bar is part of the shared viewport contract', () => {
  const { tabs, pageBounds } = fixture({ width: 900, height: 600 })
  tabs.setBookmarksVisible(true)
  assert.deepEqual(pageBounds.at(-1).bounds, { x: 168, y: 62, width: 724, height: 530 })
})

test('moving a sleeping tab changes only physical strip order', () => {
  const { tabs } = fixture()
  const first = tabs.tabs[0]
  const sleeping = {
    id: 2,
    asleep: true,
    view: null,
    webContents: null,
    url: 'https://sleep.test/',
    title: 'Sleeping',
  }
  tabs.tabs.push(sleeping)
  tabs.activeId = first.id

  assert.equal(tabs.move(2, 1), true)
  assert.deepEqual(tabs.tabs.map((tab) => tab.id), [2, 1])
  assert.equal(tabs.tabs[0], sleeping)
  assert.equal(tabs.tabs[1], first)
  assert.equal(tabs.activeId, first.id)
  assert.equal(sleeping.asleep, true)
  assert.equal(sleeping.view, null)
})

test('moving before the current position or an unknown tab is a no-op', () => {
  const { tabs } = fixture()
  const second = { id: 2, view: null, webContents: null, url: 'https://two.test/' }
  tabs.tabs.push(second)

  assert.equal(tabs.move(1, 2), false)
  assert.equal(tabs.move(999, null), false)
  assert.deepEqual(tabs.tabs.map((tab) => tab.id), [1, 2])
})

test('every bounded shell surface receives its absolute window-coordinate material metrics', () => {
  const { tabs, shellMetrics, frameViews } = fixture()
  tabs.layout()

  // outerRadius is 0: DWM rounds the window, so the shell paints square into
  // the corner rather than leaving a gap for the window background to show.
  const radii = { outerRadius: 0, contentRadius: 12, frameInset: 8 }
  assert.deepEqual(shellMetrics.chrome.at(-1), { width: 1270, height: 740, x: 0, y: 0, ...radii })
  assert.deepEqual(shellMetrics.sidebar.at(-1), { width: 1270, height: 740, x: 0, y: 0, ...radii })
  assert.deepEqual(frameViews.right.getBounds(), { x: 1262, y: 32, width: 8, height: 700 })
  assert.deepEqual(frameViews.bottom.getBounds(), { x: 168, y: 732, width: 1102, height: 8 })
  assert.deepEqual(shellMetrics.right.at(-1), { width: 1270, height: 740, x: 1262, y: 32, ...radii })
  assert.deepEqual(shellMetrics.bottom.at(-1), { width: 1270, height: 740, x: 168, y: 732, ...radii })
  assert.deepEqual(shellMetrics.masks['bottom-right'].at(-1), {
    width: 1270, height: 740, x: 1250, y: 720, ...radii,
  })
})
