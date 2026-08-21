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
