const test = require('node:test')
const assert = require('node:assert/strict')

const {
  TOPBAR_HEIGHT,
  SIDEBAR_WIDTH,
  SHELL_INSET,
  VIEWPORT_RADIUS,
  viewportBounds,
  dynamicTabMax,
} = require('../src/shared/chrome-layout')

test('the reference window insets the page beneath one compact top row', () => {
  assert.equal(TOPBAR_HEIGHT, 52)
  assert.equal(SIDEBAR_WIDTH, 170)
  assert.equal(SHELL_INSET, 8)
  assert.equal(VIEWPORT_RADIUS, 9)
  assert.deepEqual(viewportBounds({ width: 1570, height: 796, sidebarOpen: true }), {
    x: 170, y: 52, width: 1392, height: 736, radius: 9,
  })
})

test('closing the sidebar releases its width while retaining the outer rail', () => {
  assert.deepEqual(viewportBounds({ width: 1570, height: 796, sidebarOpen: false }), {
    x: 8, y: 52, width: 1554, height: 736, radius: 9,
  })
})

test('an explicitly shown bookmarks bar extends chrome without becoming default furniture', () => {
  assert.deepEqual(viewportBounds({
    width: 900, height: 600, sidebarOpen: true, bookmarksVisible: true,
  }), { x: 170, y: 82, width: 722, height: 510, radius: 9 })
})

test('tiny windows never produce negative native view sizes', () => {
  assert.deepEqual(viewportBounds({ width: 5, height: 4, sidebarOpen: true }), {
    x: 5, y: 4, width: 0, height: 0, radius: 9,
  })
})

test('tab maximum protects the plus button, gaps, and drag reserve', () => {
  assert.equal(dynamicTabMax({ availableWidth: 800, count: 5 }), 127)
  assert.equal(dynamicTabMax({ availableWidth: 1200, count: 2 }), 190)
  assert.equal(dynamicTabMax({ availableWidth: 420, count: 8 }), 95)
  assert.equal(dynamicTabMax({ availableWidth: 0, count: 0 }), 190)
})

