const test = require('node:test')
const assert = require('node:assert/strict')

const { TabManager } = require('../src/main/tabs')
const { SIDEBAR_TRANSITION_MS } = require('../src/shared/chrome-layout')

function fixture({ width = 1270, height = 740, sidebarOpen = true } = {}) {
  const chromeBounds = []
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
  const page = {
    setBounds: (bounds, options) => pageBounds.push({ bounds, options }),
    setBorderRadius: (radius) => radii.push(radius),
  }
  const tabs = new TabManager(win, chrome, { sidebarOpen })
  tabs.tabs = [{ id: 1, view: page, webContents: {}, url: 'https://example.com/' }]
  tabs.activeId = 1
  return { tabs, chromeBounds, pageBounds, radii }
}

test('layout keeps chrome beneath the complete window and insets the native page', () => {
  const { tabs, chromeBounds, pageBounds, radii } = fixture()
  tabs.layout()

  assert.deepEqual(chromeBounds.at(-1), {
    bounds: { x: 0, y: 0, width: 1270, height: 740 }, options: undefined,
  })
  assert.deepEqual(pageBounds.at(-1), {
    bounds: { x: 170, y: 52, width: 1092, height: 680 }, options: undefined,
  })
  assert.equal(radii.at(-1), 9)
})

test('sidebar toggling animates the real page to the collapsed rail', () => {
  const { tabs, pageBounds } = fixture()
  tabs.setSidebarOpen(false, { animate: true })

  assert.equal(tabs.sidebarOpen, false)
  assert.deepEqual(pageBounds.at(-1), {
    bounds: { x: 8, y: 52, width: 1254, height: 680 },
    options: { animate: { duration: SIDEBAR_TRANSITION_MS, easing: 'ease-in-out' } },
  })
})

test('an explicitly visible bookmarks bar is part of the shared viewport contract', () => {
  const { tabs, pageBounds } = fixture({ width: 900, height: 600 })
  tabs.setBookmarksVisible(true)
  assert.deepEqual(pageBounds.at(-1).bounds, { x: 170, y: 82, width: 722, height: 510 })
})

