const test = require('node:test')
const assert = require('node:assert/strict')

const { matchesAccept, dialogFiltersForAccept, mimeForPath } = require('../src/shared/file-selection')

test('matches extension, exact MIME, wildcard MIME, and unrestricted file inputs', () => {
  const png = { name: 'Ember.PNG', type: 'image/png' }
  assert.equal(matchesAccept(png, ''), true)
  assert.equal(matchesAccept(png, '.png'), true)
  assert.equal(matchesAccept(png, 'image/png'), true)
  assert.equal(matchesAccept(png, 'image/*'), true)
  assert.equal(matchesAccept(png, '.pdf,text/plain'), false)
})

test('builds a useful native-dialog filter while retaining the all-files fallback', () => {
  assert.deepEqual(dialogFiltersForAccept('image/*,.pdf'), [
    { name: 'Accepted files', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'pdf'] },
    { name: 'All files', extensions: ['*'] },
  ])
  assert.deepEqual(dialogFiltersForAccept(''), [])
})

test('derives upload MIME types for common image and document files', () => {
  assert.equal(mimeForPath('photo.webp'), 'image/webp')
  assert.equal(mimeForPath('notes.txt'), 'text/plain')
  assert.equal(mimeForPath('archive.unknown'), 'application/octet-stream')
})
