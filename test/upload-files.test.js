const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')

const { payloadFromPath, payloadFromClipboardImage } = require('../src/main/upload-files')

test('turns a selected disk file into the real bytes and metadata a page File needs', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ember-upload-'))
  const file = path.join(dir, 'notes.txt')
  await fs.writeFile(file, 'real upload bytes')
  const payload = await payloadFromPath(file)

  assert.equal(payload.name, 'notes.txt')
  assert.equal(payload.type, 'text/plain')
  assert.equal(payload.data.toString(), 'real upload bytes')
  assert.equal(Number.isFinite(payload.lastModified), true)
})

test('turns a non-empty clipboard image into a named PNG upload', () => {
  const image = { isEmpty: () => false, toPNG: () => Buffer.from([1, 2, 3]) }
  const payload = payloadFromClipboardImage(image, new Date('2026-08-21T12:34:56Z'))
  assert.equal(payload.name, 'clipboard-20260821-123456.png')
  assert.equal(payload.type, 'image/png')
  assert.deepEqual([...payload.data], [1, 2, 3])
})

test('returns null when the clipboard does not contain an image', () => {
  assert.equal(payloadFromClipboardImage({ isEmpty: () => true }, new Date()), null)
})
