const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const brand = require('../src/renderer/brand')

test('exports reusable transparent-meteor icon and wordmark mounts', () => {
  assert.equal(typeof brand.mountIcon, 'function')
  assert.equal(typeof brand.mountBrand, 'function')
  assert.equal(brand.ICON_ASSET, '/assets/ember-icon.png')
  assert.equal(brand.CHROME_ICON_ASSET, '/assets/icon-white-stroke.png')
  assert.equal(typeof brand.mountChromeIcon, 'function')
  assert.equal(brand.WORDMARK_FONT_ASSET, '/assets/Necosmic-PersonalUse.otf')
  assert.equal(Object.hasOwn(brand, 'LOGO_ASSET'), false)
})

test('ships the supplied white-stroke source for browser chrome', () => {
  const icon = path.join(__dirname, '..', 'src', 'renderer', 'assets', 'icon-white-stroke.png')
  assert.equal(fs.existsSync(icon), true)
  const bytes = fs.readFileSync(icon)
  assert.equal(bytes.readUInt32BE(16), 2175)
  assert.equal(bytes.readUInt32BE(20), 723)
})

test('ships the supplied transparent meteor and Necosmic font byte-for-byte', () => {
  const digest = (name) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'assets', name)))
    .digest('hex')
    .toUpperCase()

  assert.equal(digest('ember-icon.png'), 'E7922A46BE91DE7B8C6118FD3078DFA7DBB665AF98A966079A41E9009A8A00B6')
  assert.equal(digest('Necosmic-PersonalUse.otf'), '66FE3298A1A892AB71ED5B8DBBAD739D4D4E92251560DB7F4348499FE9FFB072')
})

test('uses a dedicated square meteor crop for the native Ember window', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'index.js'), 'utf8')
  assert.match(source, /icon: path\.join\(__dirname, '\.\.', 'renderer', 'assets', 'ember-app-icon\.png'\)/)
  const icon = path.join(__dirname, '..', 'src', 'renderer', 'assets', 'ember-app-icon.png')
  assert.equal(fs.existsSync(icon), true)
  const bytes = fs.readFileSync(icon)
  assert.equal(bytes.readUInt32BE(16), bytes.readUInt32BE(20))
})

test('resolves the meteor relative to each internal document', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'brand.js'), 'utf8')
  assert.match(source, /new URL\(ICON_ASSET\.slice\(1\), target\.ownerDocument\.baseURI\)\.href/)
})

test('does not actively reference the deprecated combined raster logo', () => {
  const sources = [
    'src/renderer/brand.js',
    'src/renderer/brand.css',
    'src/renderer/pages/newtab.css',
    'src/main/protocol.js',
    'src/main/index.js',
    'scripts/capture-ui.js',
  ].map((file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8'))

  for (const source of sources) assert.doesNotMatch(source, /ember-logo\.png/)
})

test('uses the meteor PNG for the smoke-test clipboard fixture', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'index.js'), 'utf8')
  assert.match(source, /image: nativeImage\.createFromPath\(smokeUploadPaths\[0\]\)/)
})
