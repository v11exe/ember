const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { HistoryStore, isRecordable, hostOf } = require('../src/main/history')

function store(options) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-history-'))
  return new HistoryStore(path.join(dir, 'history.json'), options)
}

test('only real web pages are recordable', () => {
  assert.equal(isRecordable('https://example.com'), true)
  assert.equal(isRecordable('http://localhost:3000/x'), true)
  assert.equal(isRecordable('ember://newtab'), false)
  assert.equal(isRecordable('about:blank'), false)
  assert.equal(isRecordable('file:///c:/secret.txt'), false)
  assert.equal(isRecordable(''), false)
  assert.equal(isRecordable(undefined), false)
})

test('hostOf survives malformed urls', () => {
  assert.equal(hostOf('https://www.example.com/a?b=1'), 'www.example.com')
  assert.equal(hostOf('not a url'), '')
})

test('records a visit with host and title', () => {
  const history = store()
  const entry = history.record({ url: 'https://example.com/a', title: 'Example' })
  assert.equal(entry.host, 'example.com')
  assert.equal(entry.title, 'Example')
  assert.equal(history.snapshot().entries.length, 1)
})

test('untitled visits fall back to the url', () => {
  const history = store()
  assert.equal(history.record({ url: 'https://example.com/a' }).title, 'https://example.com/a')
})

test('internal pages are not recorded', () => {
  const history = store()
  assert.equal(history.record({ url: 'ember://history' }), null)
  assert.equal(history.snapshot().entries.length, 0)
})

test('a rapid repeat of the same url updates instead of stacking', () => {
  const history = store()
  const first = history.record({ url: 'https://example.com', title: 'Old', visitedAt: 1_000 })
  history.record({ url: 'https://example.com', title: 'New', visitedAt: 5_000 })
  const entries = history.snapshot().entries
  assert.equal(entries.length, 1)
  assert.equal(entries[0].title, 'New')
  assert.equal(entries[0].visitedAt, 5_000)
  assert.equal(entries[0].id, first.id)
})

test('a later revisit is its own entry', () => {
  const history = store()
  history.record({ url: 'https://example.com', visitedAt: 1_000 })
  history.record({ url: 'https://example.com', visitedAt: 1_000 + 60_000 })
  assert.equal(history.snapshot().entries.length, 2)
})

test('newest visit sorts first', () => {
  const history = store()
  history.record({ url: 'https://a.com', visitedAt: 1_000 })
  history.record({ url: 'https://b.com', visitedAt: 2_000 })
  assert.deepEqual(history.snapshot().entries.map((e) => e.host), ['b.com', 'a.com'])
})

test('decorate fills in a title that arrived after navigation', () => {
  const history = store()
  history.record({ url: 'https://example.com', visitedAt: 1_000 })
  history.decorate('https://example.com', { title: 'Loaded', favicon: 'data:image/png;base64,x' })
  const entry = history.snapshot().entries[0]
  assert.equal(entry.title, 'Loaded')
  assert.equal(entry.favicon, 'data:image/png;base64,x')
})

test('decorate ignores urls that were never recorded', () => {
  const history = store()
  assert.equal(history.decorate('https://missing.com', { title: 'x' }), null)
})

test('the log is capped so the file cannot grow without bound', () => {
  const history = store({ max: 3 })
  for (let i = 0; i < 10; i++) history.record({ url: `https://example.com/${i}`, visitedAt: i * 60_000 })
  const entries = history.snapshot().entries
  assert.equal(entries.length, 3)
  assert.equal(entries[0].url, 'https://example.com/9')
})

test('recently closed tabs are tracked newest first and deduped', () => {
  const history = store()
  history.noteClosedTab({ url: 'https://a.com', title: 'A', closedAt: 1_000 })
  history.noteClosedTab({ url: 'https://b.com', title: 'B', closedAt: 2_000 })
  history.noteClosedTab({ url: 'https://a.com', title: 'A again', closedAt: 3_000 })
  const closed = history.snapshot().recentlyClosed
  assert.deepEqual(closed.map((c) => c.host), ['a.com', 'b.com'])
  assert.equal(closed[0].title, 'A again')
})

test('closing an internal page is not offered back', () => {
  const history = store()
  assert.equal(history.noteClosedTab({ url: 'ember://newtab' }), null)
  assert.equal(history.snapshot().recentlyClosed.length, 0)
})

test('remove deletes only the named entries', async () => {
  const history = store()
  const a = history.record({ url: 'https://a.com', visitedAt: 1_000 })
  history.record({ url: 'https://b.com', visitedAt: 2_000 })
  const after = await history.remove([a.id])
  assert.deepEqual(after.entries.map((e) => e.host), ['b.com'])
})

test('clear with a cutoff keeps older entries', async () => {
  const history = store()
  history.record({ url: 'https://old.com', visitedAt: 1_000 })
  history.record({ url: 'https://new.com', visitedAt: 9_000 })
  const after = await history.clear({ since: 5_000 })
  assert.deepEqual(after.entries.map((e) => e.host), ['old.com'])
})

test('clear with no range empties history and recently closed', async () => {
  const history = store()
  history.record({ url: 'https://a.com' })
  history.noteClosedTab({ url: 'https://b.com' })
  const after = await history.clear({})
  assert.equal(after.entries.length, 0)
  assert.equal(after.recentlyClosed.length, 0)
})

test('entries survive a reload from disk', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-history-'))
  const file = path.join(dir, 'history.json')
  const history = new HistoryStore(file)
  history.record({ url: 'https://example.com', title: 'Kept' })
  await history.clear({ since: Number.MAX_SAFE_INTEGER }) // forces a write, keeps the entry
  const reopened = new HistoryStore(file)
  assert.equal(reopened.snapshot().entries[0].title, 'Kept')
})

test('a corrupt store falls back to empty rather than throwing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-history-'))
  const file = path.join(dir, 'history.json')
  fs.writeFileSync(file, '{ not json')
  assert.equal(new HistoryStore(file).snapshot().entries.length, 0)
})

test('snapshots are copies, so callers cannot mutate the store', () => {
  const history = store()
  history.record({ url: 'https://example.com', title: 'Original' })
  const snapshot = history.snapshot()
  snapshot.entries[0].title = 'Tampered'
  assert.equal(history.snapshot().entries[0].title, 'Original')
})
