const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8')

test('new tab mounts the reusable Ember brand instead of generic uppercase text', () => {
  const html = read('src', 'renderer', 'pages', 'newtab.html')
  assert.match(html, /id="ember-brand"/)
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
  assert.doesNotMatch(js, /meta\.onclick/)
})
