const test = require('node:test')
const assert = require('node:assert/strict')

const {
  ACCENT_BLUR_TINT,
  NATIVE_GLASS_DEFAULTS,
  isNativeGlassUrl,
} = require('../src/shared/native-glass')
const { NativeBackdrop, normalizeGlassRect } = require('../src/main/native-backdrop')

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

test('search-layer geometry stays inside the new-tab viewport', () => {
  assert.deepEqual(
    normalizeGlassRect({ x: -12, y: 44, width: 712, height: 58 }, { width: 680, height: 520 }),
    { x: 0, y: 44, width: 680, height: 58 },
  )
  assert.equal(normalizeGlassRect({ x: 12, y: 520, width: 200, height: 58 }, { width: 680, height: 520 }), null)
})

test('native backdrop stacks a second live blur only beneath the active new-tab search', () => {
  class FakeView {
    constructor() { this.calls = [] }
    setBackgroundColor(value) { this.calls.push(['color', value]) }
    setBackgroundBlur(value) { this.calls.push(['blur', value]) }
    setVisible(value) { this.calls.push(['visible', value]) }
    setBounds(value) { this.calls.push(['bounds', value]) }
  }
  const layers = []
  const win = { contentView: { addChildView: (view) => layers.push(view), removeChildView() {} } }
  const backdrop = new NativeBackdrop(win, FakeView)
  backdrop.layoutPage({ chromeHeight: 84, width: 1280, height: 820 })
  backdrop.layoutSearch({ x: 300, y: 200, width: 680, height: 58 })
  backdrop.setActiveUrl('ember://newtab')

  assert.equal(layers.length, 2)
  assert.ok(layers[0].calls.some((call) => JSON.stringify(call) === JSON.stringify(['blur', 18])))
  assert.ok(layers[1].calls.some((call) => JSON.stringify(call) === JSON.stringify(['blur', 2])))
  assert.deepEqual(layers[0].calls.at(-1), ['visible', true])
  assert.ok(layers[1].calls.some((call) => JSON.stringify(call) === JSON.stringify([
    'bounds', { x: 300, y: 284, width: 680, height: 58 },
  ])))
  assert.deepEqual(layers[1].calls.at(-1), ['visible', true])

  backdrop.setActiveUrl('https://example.com')
  assert.deepEqual(layers[0].calls.at(-1), ['visible', false])
  assert.deepEqual(layers[1].calls.at(-1), ['visible', false])
})
