// Real liquid glass for full-page surfaces (history, downloads).
//
// Overlays (upload, context menu) refract a captured screenshot of the page
// behind them. Full pages cannot do that — there is nothing to capture — so they
// refract their own ambient wash instead, using the same canonical displacement
// map and the same feImage -> feGaussianBlur -> feDisplacementMap chain.
//
// One filter is generated per distinct element size and reused, because the map
// is rendered pixel by pixel and would be wasteful per element otherwise.
(function expose(root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.EmberPageGlass = api
}(typeof globalThis === 'object' ? globalThis : this, () => {
  const NS = 'http://www.w3.org/2000/svg'

  /** Rounded to keep the filter cache small; a few px either way is invisible. */
  function sizeKey(width, height, edge) {
    return `${Math.round(width / 8) * 8}x${Math.round(height / 8) * 8}x${edge}`
  }

  function createDefs(document) {
    let svg = document.getElementById('ember-glass-defs')
    if (svg) return svg
    svg = document.createElementNS(NS, 'svg')
    svg.id = 'ember-glass-defs'
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('width', '0')
    svg.setAttribute('height', '0')
    svg.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none'
    svg.append(document.createElementNS(NS, 'defs'))
    document.body.append(svg)
    return svg
  }

  /**
   * @param {object} options
   * @param {string} options.selector elements to glassify
   * @param {number} [options.edge] px of refracting perimeter
   * @param {number} [options.scale] displacement strength, objectBoundingBox units
   * @param {number} [options.blur] backdrop blur in px behind the refraction
   */
  function createPageGlass(document, optics, {
    selector = '[data-glass]',
    edge = 22,
    scale = 0.055,
    blur = 16,
    saturate = 1.45,
    source = '/assets/glass-switcher-map.webp',
  } = {}) {
    const filters = new Map()
    const defs = createDefs(document).firstChild

    const sourceImage = new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('glass source map unavailable'))
      image.src = source
    })

    let sourcePixels = null
    async function readSource() {
      if (sourcePixels) return sourcePixels
      const image = await sourceImage
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d', { willReadFrequently: true })
      context.drawImage(image, 0, 0)
      sourcePixels = {
        data: context.getImageData(0, 0, canvas.width, canvas.height).data,
        width: canvas.width,
        height: canvas.height,
      }
      return sourcePixels
    }

    async function filterFor(width, height) {
      const key = sizeKey(width, height, edge)
      if (filters.has(key)) return filters.get(key)

      const pending = (async () => {
        const map = await readSource()
        const w = Math.max(1, Math.round(width))
        const h = Math.max(1, Math.round(height))
        const pixels = optics.renderDisplacementMap(map.data, map.width, map.height, w, h, edge)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').putImageData(new ImageData(pixels, w, h), 0, 0)

        const id = `ember-glass-${key}`
        const filter = document.createElementNS(NS, 'filter')
        filter.id = id
        filter.setAttribute('primitiveUnits', 'objectBoundingBox')

        const feImage = document.createElementNS(NS, 'feImage')
        feImage.setAttribute('x', '0')
        feImage.setAttribute('y', '0')
        feImage.setAttribute('width', '1')
        feImage.setAttribute('height', '1')
        feImage.setAttribute('preserveAspectRatio', 'none')
        feImage.setAttribute('result', 'map')
        feImage.setAttribute('href', canvas.toDataURL('image/png'))

        const feBlur = document.createElementNS(NS, 'feGaussianBlur')
        feBlur.setAttribute('in', 'SourceGraphic')
        feBlur.setAttribute('stdDeviation', '0.004')
        feBlur.setAttribute('result', 'blurred')

        const feDisplace = document.createElementNS(NS, 'feDisplacementMap')
        feDisplace.setAttribute('in', 'blurred')
        feDisplace.setAttribute('in2', 'map')
        feDisplace.setAttribute('scale', String(scale))
        feDisplace.setAttribute('xChannelSelector', 'R')
        feDisplace.setAttribute('yChannelSelector', 'G')

        filter.append(feImage, feBlur, feDisplace)
        defs.append(filter)
        return id
      })()

      filters.set(key, pending)
      return pending
    }

    async function apply(element) {
      const { width, height } = element.getBoundingClientRect()
      if (width < 8 || height < 8) return false
      try {
        const id = await filterFor(width, height)
        element.style.backdropFilter = `url(#${id}) blur(${blur}px) saturate(${saturate})`
        element.style.webkitBackdropFilter = element.style.backdropFilter
        element.dataset.glassReady = 'true'
        return true
      } catch {
        // Plain blur still looks like frosted glass, just without refraction.
        element.dataset.glassReady = 'fallback'
        return false
      }
    }

    let observer = null
    async function refresh() {
      const elements = [...document.querySelectorAll(selector)]
      const results = await Promise.all(elements.map(apply))
      document.documentElement.dataset.glassReady = results.some(Boolean) ? 'true' : 'fallback'
      return results.every(Boolean)
    }

    function observe() {
      if (observer || typeof ResizeObserver !== 'function') return
      let queued = null
      observer = new ResizeObserver(() => {
        clearTimeout(queued)
        queued = setTimeout(refresh, 120)
      })
      for (const element of document.querySelectorAll(selector)) observer.observe(element)
    }

    return { refresh, observe, apply, filterFor }
  }

  return { createPageGlass, sizeKey }
}))
