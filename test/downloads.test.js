const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { EventEmitter } = require('node:events')

const { DownloadStore, formatBytes, progressOf, stateOf } = require('../src/main/downloads')

/** Stands in for Electron's DownloadItem, which only exists inside a session. */
class FakeItem extends EventEmitter {
  constructor({ url = 'https://example.com/file.zip', filename = 'file.zip', total = 1000 } = {}) {
    super()
    this.url = url
    this.filename = filename
    this.total = total
    this.received = 0
    this.state = 'progressing'
    this.paused = false
    this.resumable = true
    this.cancelled = false
  }
  getURL() { return this.url }
  getFilename() { return this.filename }
  getSavePath() { return `C:/Downloads/${this.filename}` }
  getMimeType() { return 'application/zip' }
  getReceivedBytes() { return this.received }
  getTotalBytes() { return this.total }
  getState() { return this.state }
  getStartTime() { return 1_700_000 }
  isPaused() { return this.paused }
  canResume() { return this.resumable }
  pause() { this.paused = true; this.emit('updated', {}, 'progressing') }
  resume() { this.paused = false; this.emit('updated', {}, 'progressing') }
  cancel() { this.cancelled = true; this.state = 'cancelled'; this.emit('done', {}, 'cancelled') }
  progress(bytes) { this.received = bytes; this.emit('updated', {}, 'progressing') }
  finish() { this.state = 'completed'; this.received = this.total; this.emit('done', {}, 'completed') }
}

function store() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-downloads-'))
  return new DownloadStore(path.join(dir, 'downloads.json'))
}

test('formatBytes uses sensible units', () => {
  assert.equal(formatBytes(0), '0 B')
  assert.equal(formatBytes(512), '512 B')
  assert.equal(formatBytes(1024), '1 KB')
  assert.equal(formatBytes(1536), '1.5 KB')
  assert.equal(formatBytes(10 * 1024 * 1024), '10 MB')
  assert.equal(formatBytes(-1), '')
  assert.equal(formatBytes(Number.NaN), '')
})

test('progressOf is null when the total size is unknown', () => {
  assert.equal(progressOf({ receivedBytes: 50, totalBytes: 100 }), 0.5)
  assert.equal(progressOf({ receivedBytes: 5, totalBytes: 0 }), null)
  assert.equal(progressOf(null), null)
})

test('a tracked download shows up as active, not finished', () => {
  const downloads = store()
  downloads.track(new FakeItem())
  const snapshot = downloads.snapshot()
  assert.equal(snapshot.active.length, 1)
  assert.equal(snapshot.entries.length, 0)
  assert.equal(snapshot.active[0].filename, 'file.zip')
})

test('progress updates the active entry in place', () => {
  const downloads = store()
  const item = new FakeItem({ total: 1000 })
  downloads.track(item)
  item.progress(250)
  const active = downloads.snapshot().active[0]
  assert.equal(active.receivedBytes, 250)
  assert.equal(active.totalBytes, 1000)
  assert.equal(downloads.snapshot().active.length, 1)
})

test('completion moves the download from active to the finished list', () => {
  const downloads = store()
  const item = new FakeItem()
  downloads.track(item)
  item.finish()
  const snapshot = downloads.snapshot()
  assert.equal(snapshot.active.length, 0)
  assert.equal(snapshot.entries.length, 1)
  assert.equal(snapshot.entries[0].state, 'completed')
  assert.ok(snapshot.entries[0].endedAt > 0)
})

test('cancelling records the download as cancelled rather than dropping it', () => {
  const downloads = store()
  const item = new FakeItem()
  const id = downloads.track(item)
  downloads.cancel(id)
  const snapshot = downloads.snapshot()
  assert.equal(snapshot.active.length, 0)
  assert.equal(snapshot.entries[0].state, 'cancelled')
})

test('pause and resume are reflected in the snapshot', () => {
  const downloads = store()
  const id = downloads.track(new FakeItem())
  downloads.pause(id)
  assert.equal(downloads.snapshot().active[0].state, 'paused')
  downloads.resume(id)
  assert.equal(downloads.snapshot().active[0].state, 'progressing')
})

test('resume is ignored when the transfer cannot be resumed', () => {
  const downloads = store()
  const item = new FakeItem()
  item.resumable = false
  const id = downloads.track(item)
  downloads.pause(id)
  downloads.resume(id)
  assert.equal(downloads.snapshot().active[0].state, 'paused')
})

test('actions on an unknown id do not throw', () => {
  const downloads = store()
  assert.doesNotThrow(() => { downloads.pause('nope'); downloads.resume('nope'); downloads.cancel('nope') })
})

test('onChange fires as the transfer progresses and finishes', () => {
  const downloads = store()
  let calls = 0
  downloads.onChange = () => { calls += 1 }
  const item = new FakeItem()
  downloads.track(item)
  item.progress(10)
  item.finish()
  assert.ok(calls >= 3, `expected at least 3 change events, got ${calls}`)
})

test('newest finished download sorts first', () => {
  const downloads = store()
  const a = new FakeItem({ filename: 'a.zip' })
  const b = new FakeItem({ filename: 'b.zip' })
  downloads.track(a); a.finish()
  downloads.track(b); b.finish()
  assert.deepEqual(downloads.snapshot().entries.map((e) => e.filename), ['b.zip', 'a.zip'])
})

test('remove deletes one finished download', async () => {
  const downloads = store()
  const item = new FakeItem()
  downloads.track(item)
  item.finish()
  const id = downloads.snapshot().entries[0].id
  const after = await downloads.remove(id)
  assert.equal(after.entries.length, 0)
})

test('clear empties finished downloads but leaves running ones alone', async () => {
  const downloads = store()
  const done = new FakeItem({ filename: 'done.zip' })
  downloads.track(done)
  done.finish()
  downloads.track(new FakeItem({ filename: 'running.zip' }))
  const after = await downloads.clear()
  assert.equal(after.entries.length, 0)
  assert.equal(after.active.length, 1)
})

test('the finished list is capped', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-downloads-'))
  const downloads = new DownloadStore(path.join(dir, 'downloads.json'), { max: 2 })
  for (let i = 0; i < 5; i++) {
    const item = new FakeItem({ filename: `f${i}.zip` })
    downloads.track(item)
    item.finish()
  }
  const entries = downloads.snapshot().entries
  assert.equal(entries.length, 2)
  assert.equal(entries[0].filename, 'f4.zip')
})

test('stateOf reports paused ahead of the underlying state', () => {
  const item = new FakeItem()
  assert.equal(stateOf(item), 'progressing')
  item.paused = true
  assert.equal(stateOf(item), 'paused')
})

test('snapshots are copies', () => {
  const downloads = store()
  const item = new FakeItem()
  downloads.track(item)
  item.finish()
  const snapshot = downloads.snapshot()
  snapshot.entries[0].filename = 'tampered'
  assert.equal(downloads.snapshot().entries[0].filename, 'file.zip')
})

test('a corrupt store falls back to empty', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-downloads-'))
  const file = path.join(dir, 'downloads.json')
  fs.writeFileSync(file, 'not json at all')
  assert.equal(new DownloadStore(file).snapshot().entries.length, 0)
})
