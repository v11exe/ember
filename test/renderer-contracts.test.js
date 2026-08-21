const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8')

test('new tab mounts the reusable Ember brand instead of generic uppercase text', () => {
  const html = read('src', 'renderer', 'pages', 'newtab.html')
  const protocol = read('src', 'main', 'protocol.js')
  assert.match(html, /id="ember-brand"/)
  assert.match(html, /href="\/theme\.css"/)
  assert.match(protocol, /\['\/theme\.css', path\.join\(RENDERER, 'theme\.css'\)\]/)
  assert.match(html, /\/brand\.js/)
  assert.match(html, /\/brand\.css/)
  assert.doesNotMatch(html, /<h1 class="wordmark">EMBER<\/h1>/)
})

test('browser chrome provides a compact live bookmarks bar', () => {
  const html = read('src', 'renderer', 'chrome.html')
  assert.match(html, /id="bookmarks-bar"/)
  assert.match(html, /id="bookmarks-items"/)
  assert.match(html, /id="import-bookmarks"/)
})

test('extension icon and metadata share one keyboard-accessible launcher', () => {
  const js = read('src', 'renderer', 'pages', 'extensions.js')
  assert.match(js, /launch\.append\(icon, meta\)/)
  assert.match(js, /launch\.dataset\.extensionId = ext\.id/)
  assert.match(js, /img\.alt = ''/)
  assert.match(js, /remove\.setAttribute\('aria-label', `Remove \$\{ext\.name\}`\)/)
  assert.doesNotMatch(js, /meta\.onclick/)
})

test('browser chrome mirrors authoritative extension-panel visibility', () => {
  const js = read('src', 'renderer', 'chrome.js')
  assert.match(js, /window\.ember\.onPanelChanged/)
  assert.match(js, /setAttribute\('aria-expanded', String\(open\)\)/)
})

test('upload picker is a real glass overlay with browse, clipboard, and recent actions', () => {
  const html = read('src', 'renderer', 'pages', 'upload.html')
  const js = read('src', 'renderer', 'pages', 'upload.js')
  assert.match(html, /href="\/glass\.css"/)
  assert.match(html, /id="show-all-files"/)
  assert.match(html, /id="clipboard-slot"/)
  assert.match(html, /id="recent-files"/)
  assert.match(js, /window\.emberOverlay\.action\('browse'/)
  assert.match(js, /window\.emberOverlay\.action\('clipboard'/)
  assert.match(js, /window\.emberOverlay\.action\('recent'/)
})

test('shared glass surface includes refractive edges, backdrop sampling, and specular light', () => {
  const css = read('src', 'renderer', 'glass.css')
  assert.match(css, /glass-backdrop/)
  assert.match(css, /filter: blur/)
  assert.match(css, /inset 0 1px/)
  assert.match(css, /radial-gradient/)
})

test('context menu renders real commands in a keyboard-navigable glass surface', () => {
  const html = read('src', 'renderer', 'pages', 'context-menu.html')
  const css = read('src', 'renderer', 'pages', 'context-menu.css')
  const js = read('src', 'renderer', 'pages', 'context-menu.js')
  assert.match(html, /glass\.css/)
  assert.match(html, /id="context-menu"/)
  assert.match(css, /\.menu-item:focus-visible/)
  assert.match(js, /window\.emberOverlay\.action\(item\.id\)/)
  assert.match(js, /ArrowDown/)
  assert.match(js, /ArrowUp/)
  assert.match(js, /Home/)
  assert.match(js, /End/)
  assert.match(js, /Escape/)
})
