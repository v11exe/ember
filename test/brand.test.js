const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const brand = require('../src/renderer/brand')

test('exports independently reusable Ember icon, wordmark, and combined mounts', () => {
  assert.equal(typeof brand.mountIcon, 'function')
  assert.equal(typeof brand.mountWordmark, 'function')
  assert.equal(typeof brand.mountBrand, 'function')
  assert.match(brand.iconMarkup, /viewBox="0 0 460 130"/)
})

test('ships the supplied Necosmic wordmark font as an OpenType asset', () => {
  const file = path.join(__dirname, '..', 'src', 'renderer', 'assets', 'Necosmic-PersonalUse.otf')
  const signature = fs.readFileSync(file).subarray(0, 4).toString('ascii')
  assert.equal(signature, 'OTTO')
})
