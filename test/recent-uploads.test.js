const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')

const { RecentUploadStore } = require('../src/main/recent-uploads')

test('persists real recent paths, deduplicates newest first, and enforces its limit', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ember-recents-'))
  const file = path.join(dir, 'recent-uploads.json')
  const store = new RecentUploadStore(file, { limit: 3 })

  await store.load()
  await store.add(['C:\\one.png', 'C:\\two.pdf', 'C:\\three.jpg'])
  await store.add(['C:\\two.pdf', 'C:\\four.txt'])

  assert.deepEqual(store.snapshot().map((item) => item.path), [
    'C:\\two.pdf', 'C:\\four.txt', 'C:\\one.png',
  ])
  const restored = new RecentUploadStore(file, { limit: 3 })
  await restored.load()
  assert.deepEqual(restored.snapshot(), store.snapshot())
})

test('does not mutate in-memory recents when persistence fails', async () => {
  const io = {
    readFile: async () => { throw Object.assign(new Error('missing'), { code: 'ENOENT' }) },
    mkdir: async () => {},
    writeFile: async () => { throw new Error('disk full') },
    rename: async () => {},
  }
  const store = new RecentUploadStore('C:\\state\\recent.json', { io })
  await store.load()
  await assert.rejects(store.add(['C:\\new.png']), /disk full/)
  assert.deepEqual(store.snapshot(), [])
})
