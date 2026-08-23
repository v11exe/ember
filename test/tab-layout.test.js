const test = require('node:test')
const assert = require('node:assert/strict')

const { TabManager } = require('../src/main/tabs')
const { SIDEBAR_TRANSITION_MS } = require('../src/shared/chrome-layout')

function fixture({ width = 1270, height = 740, sidebarOpen = true } = {}) {
  const chromeBounds = []
  const sidebarBounds = []
  const pageBounds = []
  const radii = []
  const win = {
    on: () => {},
    getContentBounds: () => ({ width, height }),
    contentView: { addChildView: () => {} },
  }
  const chrome = {
    setBounds: (bounds, options) => chromeBounds.push({ bounds, options }),
    webContents: { isDestroyed: () => false, send: () => {} },
  }
  const sidebar = {
    setBounds: (bounds, options) => sidebarBounds.push({ bounds, options }),
    getBounds: () => sidebarBounds.at(-1)?.bounds || { x: 0, y: 0, width: 168, height },
    setVisible: () => {},
    webContents: { isDestroyed: () => false, send: () => {} },
  }
  const page = {
    setBounds: (bounds, options) => pageBounds.push({ bounds, options }),
    getBounds: () => pageBounds.at(-1)?.bounds || { x: 168, y: 32, width: width - 176, height: height - 40 },
    setBorderRadius: (radius) => radii.push(radius),
  }
  const tabs = new TabManager(win, chrome, { sidebarOpen, sidebarView: sidebar })
  tabs.tabs = [{ id: 1, view: page, webContents: {}, url: 'https://example.com/' }]
  tabs.activeId = 1
  return { tabs, chromeBounds, sidebarBounds, pageBounds, radii }
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
