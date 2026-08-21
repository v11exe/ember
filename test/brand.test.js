const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const brand = require('../src/renderer/brand')

test('exports independently reusable canonical Ember icon and full-logo mounts', () => {
  assert.equal(typeof brand.mountIcon, 'function')
  assert.equal(typeof brand.mountBrand, 'function')
  assert.equal(brand.ICON_ASSET, '/assets/ember-icon.png')
  assert.equal(brand.LOGO_ASSET, '/assets/ember-logo.png')
})

test('ships the supplied logo files byte-for-byte instead of a generated approximation', () => {
  const digest = (name) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'assets', name)))
    .digest('hex')
    .toUpperCase()

  assert.equal(digest('ember-logo.png'), 'F8E86C0B1601750A22FDD5A9520A4A6D75DBB942C5C397C8C2488036D68B4F66')
  assert.equal(digest('ember-icon.png'), '514FD2830E7F8BA53F6105188AC635FDD6B91819CFBFE9619B315C34078BAF2D')
})
