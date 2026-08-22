const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { SessionStore, serialiseTabs, isRestorable } = require('../src/main/session')
const { SettingsStore, SESSION_RESTORE, sanitiseBounds } = require('../src/main/settings')

const tmp = (name) => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ember-session-')), name)

// ---------------------------------------------------------------- session

test('only real pages are worth restoring', () => {
  assert.equal(isRestorable('https://example.com'), true)
  assert.equal(isRestorable('ember://history'), true)
  assert.equal(isRestorable('ember://newtab'), false) // a blank tab restores nothing
  assert.equal(isRestorable('ember://newtab/'), false) // Chromium appends the slash
  assert.equal(isRestorable('about:blank'), false)
  assert.equal(isRestorable(''), false)
})

test('serialising keeps url, title and which tab was active', () => {
  const tabs = [
    { id: 1, url: 'https://a.com', title: 'A' },
    { id: 2, url: 'https://b.com', title: 'B' },
  ]
  assert.deepEqual(serialiseTabs(tabs, 2), [
    { url: 'https://a.com', title: 'A', active: false },
    { url: 'https://b.com', title: 'B', active: true },
  ])
})

test('serialising drops blank tabs', () => {
  const tabs = [
    { id: 1, url: 'ember://newtab', title: 'New tab' },
    { id: 2, url: 'https://b.com', title: 'B' },
  ]
  assert.deepEqual(serialiseTabs(tabs, 2).map((t) => t.url), ['https://b.com'])
})

test('an untitled tab falls back to its url', () => {
  assert.equal(serialiseTabs([{ id: 1, url: 'https://a.com' }], 1)[0].title, 'https://a.com')
})

test('saving then reloading restores the same tabs', () => {
  const file = tmp('session.json')
  const store = new SessionStore(file)
  store.saveSync([
    { id: 1, url: 'https://a.com', title: 'A' },
    { id: 2, url: 'https://b.com', title: 'B' },
  ], 1)

  const reopened = new SessionStore(file)
  assert.equal(reopened.hasSession(), true)
  assert.equal(reopened.count, 2)
  assert.equal(reopened.snapshot().tabs[0].active, true)
})

test('clearing removes the saved session', () => {
  const file = tmp('session.json')
  const store = new SessionStore(file)
  store.saveSync([{ id: 1, url: 'https://a.com', title: 'A' }], 1)
  store.clearSync()
  assert.equal(store.hasSession(), false)
  assert.equal(new SessionStore(file).hasSession(), false)
})

test('a session of only blank tabs counts as nothing to restore', () => {
  const store = new SessionStore(tmp('session.json'))
  store.saveSync([{ id: 1, url: 'ember://newtab', title: 'New tab' }], 1)
  assert.equal(store.hasSession(), false)
})

test('a corrupt session file does not throw', () => {
  const file = tmp('session.json')
  fs.writeFileSync(file, '{{{')
  assert.equal(new SessionStore(file).hasSession(), false)
})

test('session snapshots are copies', () => {
  const store = new SessionStore(tmp('session.json'))
  store.saveSync([{ id: 1, url: 'https://a.com', title: 'A' }], 1)
  const snapshot = store.snapshot()
  snapshot.tabs[0].title = 'tampered'
  assert.equal(store.snapshot().tabs[0].title, 'A')
})

// ---------------------------------------------------------------- settings

test('session restore defaults to asking', () => {
  assert.equal(new SettingsStore(tmp('settings.json')).get('sessionRestore'), SESSION_RESTORE.ASK)
})

test('"don\'t ask again" persists across restarts', async () => {
  const file = tmp('settings.json')
  const settings = new SettingsStore(file)
  await settings.set('sessionRestore', SESSION_RESTORE.ALWAYS)
  assert.equal(new SettingsStore(file).get('sessionRestore'), SESSION_RESTORE.ALWAYS)
})

test('an unknown preference value is ignored', async () => {
  const settings = new SettingsStore(tmp('settings.json'))
  await settings.set('sessionRestore', 'sometimes')
  assert.equal(settings.get('sessionRestore'), SESSION_RESTORE.ASK)
})

test('a corrupt settings file falls back to defaults', () => {
  const file = tmp('settings.json')
  fs.writeFileSync(file, 'nope')
  assert.equal(new SettingsStore(file).get('sessionRestore'), SESSION_RESTORE.ASK)
})

test('window bounds are validated before being stored', () => {
  assert.equal(sanitiseBounds(null), null)
  assert.equal(sanitiseBounds({ width: 10, height: 10 }), null) // absurdly small
  assert.equal(sanitiseBounds({ width: Number.NaN, height: 800 }), null)
  assert.deepEqual(sanitiseBounds({ x: 1.6, y: 2.4, width: 1280.5, height: 820, maximized: true }), {
    x: 2, y: 2, width: 1281, height: 820, maximized: true,
  })
})

test('remembered window geometry survives a restart', async () => {
  const file = tmp('settings.json')
  const settings = new SettingsStore(file)
  await settings.set('window', { x: 100, y: 50, width: 1400, height: 900, maximized: false })
  const reopened = new SettingsStore(file).get('window')
  assert.equal(reopened.width, 1400)
  assert.equal(reopened.x, 100)
})
