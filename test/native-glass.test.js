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

test('native glass is enabled only for Ember new tabs', () => {
  assert.equal(isNativeGlassUrl('ember://newtab'), true)
  assert.equal(isNativeGlassUrl('ember://history'), false)
  assert.equal(isNativeGlassUrl('https://example.com'), false)
})

test('native backdrop applies the live DWM material only to the new tab', async () => {
  const calls = []
  const backdrop = new NativeBackdrop({ getNativeWindowHandle: () => Buffer.alloc(8) }, {
    platform: 'win32',
    run: async (args) => calls.push(args),
  })
  await backdrop.setActiveUrl('ember://newtab')
  await backdrop.setActiveUrl('https://example.com')
  assert.deepEqual(calls.map((args) => args[1]), ['accent', 'none'])
})

test('native backdrop teardown is safe after the window is destroyed', () => {
  const backdrop = new NativeBackdrop({ getNativeWindowHandle: () => Buffer.alloc(8) }, {
    platform: 'win32',
    run: async () => {},
  })
  assert.doesNotThrow(() => backdrop.destroy())
})
