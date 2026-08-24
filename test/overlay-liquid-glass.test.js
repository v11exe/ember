const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const glass = require('../src/renderer/pages/overlay-liquid-glass')

test('overlay liquid glass uses the requested upstream material settings', () => {
  assert.deepEqual(glass.BASE_MATERIAL, {
    displacementScale: 100,
    blurAmount: 0.5,
    saturation: 140,
    aberrationIntensity: 2,
    elasticity: 0,
    cornerRadius: 32,
  })
  assert.deepEqual(glass.CONTROL_MATERIAL, {
    displacementScale: 0,
    blurAmount: 1,
    saturation: 140,
    aberrationIntensity: 2,
    elasticity: 0,
  })
})

test('overlay blur and displacement math stays faithful to liquid-glass-react', () => {
  assert.equal(glass.blurRadius(glass.BASE_MATERIAL), 20)
  assert.equal(glass.blurRadius(glass.CONTROL_MATERIAL), 36)
  assert.equal(glass.backdropFilter(glass.BASE_MATERIAL), 'blur(20px) saturate(140%)')
  assert.deepEqual(glass.channelScales(glass.BASE_MATERIAL), {
    red: -100,
    green: -110.00000000000001,
    blue: -120,
  })
  assert.deepEqual(glass.channelScales(glass.CONTROL_MATERIAL), {
    red: 0,
    green: 0,
    blue: 0,
  })
})

test('the standard displacement map is the pinned upstream asset', () => {
  const bytes = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'assets', 'liquid-glass-map.jpg'))
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), '6945d824fd543cb4bb080cf5a58460f29b17a661719ca10ccc718d953bfd7af6')
})

test('captured backdrops keep FloatingPanel bleed aligned and expose a readable fallback', () => {
  const attributes = new Map()
  const image = {
    style: {},
    set src(value) { attributes.set('src', value) },
    get src() { return attributes.get('src') },
    removeAttribute(name) { attributes.delete(name); if (name === 'style') this.style = {} },
  }
  const documentRef = { documentElement: { dataset: {} } }

  glass.setBackdrop(image, 'data:image/png;base64,page', { x: -40, y: -24, width: 348, height: 166 }, documentRef)
  assert.equal(image.src, 'data:image/png;base64,page')
  assert.deepEqual(image.style, { left: '-40px', top: '-24px', width: '348px', height: '166px' })
  assert.equal(documentRef.documentElement.dataset.liquidGlassCapture, 'ready')

  glass.setBackdrop(image, null, null, documentRef)
  assert.equal(image.src, undefined)
  assert.deepEqual(image.style, {})
  assert.equal(documentRef.documentElement.dataset.liquidGlassCapture, 'missing')
})
