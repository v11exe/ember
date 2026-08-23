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

// ---- what it takes to get a frame out of Chromium ----

test('the capture asks for an explicit rect, and nudges the view first', async () => {
  const cache = new ThumbnailCache({ width: 480 })
  const calls = []
  let invalidated = 0
  const rect = { x: 0, y: 0, width: 900, height: 600 }
  await cache.capture(1, {
    isDestroyed: () => false,
    invalidate: () => { invalidated += 1 },
    capturePage: async (...args) => { calls.push(args); return stubImage(900, 600) },
  }, { rect })

  assert.equal(invalidated, 1)
  assert.deepEqual(calls, [[rect]], 'the whole-page form is the one Electron refuses')
})

test('a rejected capture is retried once, then given up on', async () => {
  const cache = new ThumbnailCache({ width: 480, retryDelay: 1 })
  let attempts = 0
  const entry = await cache.capture(1, {
    isDestroyed: () => false,
    capturePage: async () => { attempts += 1; throw new Error('Current display surface not available for capture') },
  })
  assert.equal(entry, null)
  assert.equal(attempts, 2)
})

test('a retry that succeeds is kept', async () => {
  const cache = new ThumbnailCache({ width: 480, retryDelay: 1 })
  let attempts = 0
  const entry = await cache.capture(1, {
    isDestroyed: () => false,
    capturePage: async () => {
      attempts += 1
      if (attempts === 1) throw new Error('UnknownVizError')
      return stubImage(480, 300)
    },
  })
  assert.equal(entry.width, 480)
  assert.equal(attempts, 2)
})

test('a capture that never answers cannot hold up its caller', async () => {
  const cache = new ThumbnailCache({ width: 480, retryDelay: 1, attemptTimeout: 20 })
  const started = Date.now()
  const entry = await cache.capture(1, {
    isDestroyed: () => false,
    capturePage: () => new Promise(() => {}), // never settles
  })
  assert.equal(entry, null)
  assert.ok(Date.now() - started < 1000, 'it gave up rather than waiting on the compositor')
})
