const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { SettingsStore } = require('../src/main/settings')
const { DEFAULT_FAVORITES } = require('../src/shared/favorites')

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ember-shell-settings-')), 'settings.json')

test('the sidebar starts open with the target Favorite configuration', () => {
  const settings = new SettingsStore(tmp())
  assert.equal(settings.get('sidebarOpen'), true)
  assert.deepEqual(settings.get('favorites'), DEFAULT_FAVORITES)
})

test('sidebar state and sanitized Favorites survive restart', async () => {
  const file = tmp()
  const settings = new SettingsStore(file)
  await settings.set('sidebarOpen', false)
  await settings.set('favorites', [
    { id: 'docs', name: 'Docs', url: 'https://docs.example.com/path' },
    { id: 'bad', name: 'Bad', url: 'file:///secret' },
  ])

  const reopened = new SettingsStore(file)
  assert.equal(reopened.get('sidebarOpen'), false)
  assert.deepEqual(reopened.get('favorites'), [
    { id: 'docs', name: 'Docs', url: 'https://docs.example.com/path' },
  ])
})

test('non-boolean sidebar values do not change the preference', async () => {
  const settings = new SettingsStore(tmp())
  await settings.set('sidebarOpen', 'no')
  assert.equal(settings.get('sidebarOpen'), true)
})

