const test = require('node:test')
const assert = require('node:assert/strict')

const {
  TOPBAR_HEIGHT,
  SIDEBAR_WIDTH,
  OUTER_INSET,
  SHELL_INSET,
  VIEWPORT_RADIUS,
  viewportBounds,
  dynamicTabMax,
} = require('../src/shared/chrome-layout')

test('the reference window insets the page beneath one compact top row', () => {
  assert.equal(TOPBAR_HEIGHT, 32)
  assert.equal(SIDEBAR_WIDTH, 168)
  assert.equal(OUTER_INSET, 0)
  assert.equal(SHELL_INSET, 8)
  assert.equal(VIEWPORT_RADIUS, 12)
  assert.deepEqual(viewportBounds({ width: 1570, height: 796, sidebarOpen: true }), {
    x: 168, y: 32, width: 1394, height: 756, radius: 12,
  })
})

test('closing the sidebar releases its width while retaining the outer rail', () => {
  assert.deepEqual(viewportBounds({ width: 1570, height: 796, sidebarOpen: false }), {
    x: 8, y: 32, width: 1554, height: 756, radius: 12,
  })
})

test('an explicitly shown bookmarks bar extends chrome without becoming default furniture', () => {
  assert.deepEqual(viewportBounds({
    width: 900, height: 600, sidebarOpen: true, bookmarksVisible: true,
  }), { x: 168, y: 62, width: 724, height: 530, radius: 12 })
})

test('tiny windows never produce negative native view sizes', () => {
  assert.deepEqual(viewportBounds({ width: 5, height: 4, sidebarOpen: true }), {
    x: 5, y: 4, width: 0, height: 0, radius: 12,
  })
})

test('tab maximum protects the plus button, gaps, and drag reserve', () => {
  assert.equal(dynamicTabMax({ availableWidth: 800, count: 5 }), 127)
  assert.equal(dynamicTabMax({ availableWidth: 1200, count: 2 }), 190)
  assert.equal(dynamicTabMax({ availableWidth: 420, count: 8 }), 95)
  assert.equal(dynamicTabMax({ availableWidth: 0, count: 0 }), 190)
})
