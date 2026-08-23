const test = require('node:test')
const assert = require('node:assert/strict')

const { ThumbnailCache } = require('../src/main/tab-thumbnails')

/** Stands in for an Electron NativeImage. */
function stubImage(width, height, { empty = false } = {}) {
  return {
    isEmpty: () => empty,
    getSize: () => ({ width, height }),
    resize: ({ width: target }) => stubImage(target, Math.round(height * (target / width))),
    toDataURL: () => `data:image/png;base64,${width}x${height}`,
  }
}

function stubContents(image, { destroyed = false } = {}) {
  return { isDestroyed: () => destroyed, capturePage: async () => image }
}

test('capture stores a downscaled screenshot', async () => {
  const cache = new ThumbnailCache({ width: 480 })
  const entry = await cache.capture(1, stubContents(stubImage(1200, 800)))
  assert.equal(entry.width, 480)
  assert.equal(entry.height, 320)
  assert.equal(cache.get(1).dataUrl, 'data:image/png;base64,480x320')
  assert.ok(entry.capturedAt > 0)
})

test('a small capture is kept at its own size', async () => {
  const cache = new ThumbnailCache({ width: 480 })
  const entry = await cache.capture(1, stubContents(stubImage(320, 200)))
  assert.equal(entry.width, 320)
})

test('an empty or impossible capture leaves the previous entry intact', async () => {
  const cache = new ThumbnailCache({ width: 480 })
  await cache.capture(1, stubContents(stubImage(480, 300)))
  const good = cache.get(1)

  assert.equal(await cache.capture(1, stubContents(stubImage(480, 300, { empty: true }))), null)
  assert.equal(await cache.capture(1, stubContents(stubImage(480, 300), { destroyed: true })), null)
  assert.equal(await cache.capture(1, null), null)
  assert.equal(await cache.capture(1, { isDestroyed: () => false }), null)
  assert.equal(await cache.capture(1, { isDestroyed: () => false, capturePage: async () => { throw new Error('no frame') } }), null)

  assert.deepEqual(cache.get(1), good)
})

test('the cache evicts the least recently written entry', async () => {
  const cache = new ThumbnailCache({ max: 2, width: 100 })
  await cache.capture(1, stubContents(stubImage(100, 60)))
  await cache.capture(2, stubContents(stubImage(100, 60)))
  await cache.capture(1, stubContents(stubImage(100, 60))) // refreshes 1
  await cache.capture(3, stubContents(stubImage(100, 60)))

  assert.equal(cache.size, 2)
  assert.ok(cache.has(1))
  assert.ok(cache.has(3))
  assert.ok(!cache.has(2), 'the oldest write is dropped, not the lowest id')
})

test('forget and clear drop entries', async () => {
  const cache = new ThumbnailCache()
  await cache.capture(1, stubContents(stubImage(100, 60)))
  cache.forget(1)
  assert.equal(cache.get(1), null)
  await cache.capture(2, stubContents(stubImage(100, 60)))
  cache.clear()
  assert.equal(cache.size, 0)
})
