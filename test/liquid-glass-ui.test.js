const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const glass = require('../src/renderer/pages/liquid-glass-ui')
const { NATIVE_GLASS_DEFAULTS } = require('../src/shared/native-glass')

const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8')
const page = (name) => read('src', 'renderer', 'pages', name)

test('the shared material is the new tab search glass with elasticity removed', () => {
  const search = NATIVE_GLASS_DEFAULTS.search
  assert.equal(glass.DEFAULT_MATERIAL.elasticity, 0)
  assert.notEqual(search.elasticity, 0) // the pill it is derived from still stretches
  for (const key of ['displacementScale', 'blurAmount', 'saturation', 'aberrationIntensity']) {
    assert.equal(glass.DEFAULT_MATERIAL[key], search[key], key)
  }
  assert.equal(glass.blurRadius(glass.DEFAULT_MATERIAL), 4 + 0.05 * 32)
  assert.equal(glass.backdropFilter(glass.DEFAULT_MATERIAL), 'blur(5.6px) saturate(95%)')
})

test('the highlight tracks the pointer and dies out past the fade distance', () => {
  const rect = { left: 100, top: 100, width: 200, height: 40 }
  const centred = glass.highlightFor(rect, { x: 200, y: 120 })
  assert.equal(centred.angle, 135)
  assert.equal(centred.intensity, 0.12)

  const right = glass.highlightFor(rect, { x: 290, y: 120 })
  assert.ok(right.angle > 135, 'the sweep leans towards the cursor')
  assert.ok(right.intensity > 0.12, 'and brightens as it comes alongside')

  const far = glass.highlightFor(rect, { x: 900, y: 900 })
  assert.equal(far.angle, 135, 'beyond 200px the element is back at rest')
  assert.equal(far.intensity, 0.12)
})

test('the aberration filter fringes green and blue against a fixed red channel', () => {
  const scales = []
  const document = {
    createElementNS: () => ({
      attributes: {},
      style: {},
      setAttribute(name, value) { this.attributes[name] = value; if (name === 'scale') scales.push(value) },
      append() {},
    }),
  }
  glass.createFilter(document, 'test', glass.DEFAULT_MATERIAL)
  assert.deepEqual(scales, ['0', '-20', '-40'])
})

test('every internal page sits on the shared material, not the ambient wash', () => {
  for (const name of ['history', 'downloads', 'settings']) {
    const html = page(`${name}.html`)
    assert.match(html, /class="native-glass-page"/, name)
    assert.match(html, /href="\/liquid-glass-ui\.css"/, name)
    assert.match(html, /src="\/liquid-glass-ui\.js"/, name)
    assert.doesNotMatch(html, /page-glass\.js/, name)
    assert.doesNotMatch(html, /data-glass/, name)
  }
  const css = page('liquid-glass-ui.css')
  assert.match(css, /body\.native-glass-page\s*\{[^}]*background:\s*transparent/)
  assert.match(css, /\.native-glass-page \.ambient \{ display: none; \}/)
  // The dropdown menu's motion, reused verbatim.
  assert.match(css, /--lg-motion: 170ms cubic-bezier\(\.5, 0, \.1, 1\)/)
  assert.match(css, /@property --lens-x/)
})

test('the new tab keeps its own elastic pill', () => {
  const html = page('newtab.html')
  assert.match(html, /liquid-glass-search\.js/)
  assert.doesNotMatch(html, /liquid-glass-ui\.js/)
  assert.match(page('liquid-glass-search.js'), /material\.elasticity/)
})
