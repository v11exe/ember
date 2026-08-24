const test = require('node:test')
const assert = require('node:assert/strict')

const {
  ACCENT_BLUR_TINT,
  NATIVE_GLASS_DEFAULTS,
  isNativeGlassUrl,
} = require('../src/shared/native-glass')
const { NativeBackdrop } = require('../src/main/native-backdrop')

test('native glass keeps the requested AccentBlur tint and mutable Liquid Glass defaults together', () => {
  assert.equal(ACCENT_BLUR_TINT, '#8C000000')
  assert.deepEqual(NATIVE_GLASS_DEFAULTS.search, {
    displacementScale: 0,
    blurAmount: 0.05,
    saturation: 95,
    aberrationIntensity: 20,
    elasticity: 0.46,
    cornerRadius: 48,
    borderWidth: 2,
    mode: 'standard',
    padding: '20px 25px',
    mouseContainer: 'pageRef',
    globalMousePos: 'internal',
    onClick: 'function',
  })
})

test('native glass backs every internal page, and nothing else', () => {
  for (const url of ['ember://newtab', 'ember://history', 'ember://downloads', 'ember://settings']) {
    assert.equal(isNativeGlassUrl(url), true, url)
  }
  // The dropdown panel's document renders in a bounded view, with no window
  // material behind it.
  assert.equal(isNativeGlassUrl('ember://extensions'), false)
  assert.equal(isNativeGlassUrl('https://example.com'), false)
  assert.equal(isNativeGlassUrl('ember://elsewhere'), false)
  assert.equal(isNativeGlassUrl(undefined), false)
})

test('native backdrop applies the live DWM material to internal pages only', async () => {
  const calls = []
  const backdrop = new NativeBackdrop({ getNativeWindowHandle: () => Buffer.alloc(8) }, {
    platform: 'win32',
    run: async (args) => calls.push(args),
  })
  await backdrop.setActiveUrl('ember://newtab')
  // Two internal pages in a row want the same material, so the second one is
  // not a change and must not reach the native bridge at all.
  await backdrop.setActiveUrl('ember://history')
  await backdrop.setActiveUrl('https://example.com')
  assert.deepEqual(calls.map((args) => args[1]), ['accent', 'none'])
})

test('native backdrop never runs two bridge processes against one window', async () => {
  const calls = []
  let running = 0
  let peak = 0
  const backdrop = new NativeBackdrop({ getNativeWindowHandle: () => Buffer.alloc(8) }, {
    platform: 'win32',
    run: async (args) => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise((resolve) => setTimeout(resolve, 5))
      calls.push(args[1])
      running -= 1
    },
  })

  // Closing tabs quickly used to fire one of these per keystroke, and racing
  // composition-attribute calls on one handle took the whole window down.
  await Promise.all([
    backdrop.setActiveUrl('ember://newtab'),
    backdrop.setActiveUrl('https://example.com'),
    backdrop.setActiveUrl('ember://history'),
    backdrop.setActiveUrl('https://example.org'),
  ])

  assert.equal(peak, 1)
  assert.equal(calls.at(-1), 'none')
  assert.ok(calls.length <= 2, `expected the queue to coalesce, ran ${calls.length}`)
})

test('native backdrop teardown is safe after the window is destroyed', () => {
  const backdrop = new NativeBackdrop({ getNativeWindowHandle: () => Buffer.alloc(8) }, {
    platform: 'win32',
    run: async () => {},
  })
  assert.doesNotThrow(() => backdrop.destroy())
})
