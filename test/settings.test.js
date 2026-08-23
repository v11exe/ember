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

test('a second window can mirror shared preferences without racing another file write', async () => {
  const file = tmp()
  const writer = new SettingsStore(file)
  const peer = new SettingsStore(file)
  const favorites = [{ id: 'mail', name: 'Mail', url: 'https://mail.example.com/' }]

  const snapshot = await writer.set('favorites', favorites)
  peer.sync('favorites', snapshot.favorites)
  peer.rememberWindow({ x: 40, y: 50, width: 900, height: 620 })
  await new Promise((resolve) => setTimeout(resolve, 550))

  const reopened = new SettingsStore(file)
  assert.deepEqual(reopened.get('favorites'), favorites)
})
