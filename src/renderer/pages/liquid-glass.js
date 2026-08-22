// Liquid glass material, ported from rdev/liquid-glass-react (MIT) to vanilla JS.
//
// Ember has no build step and the npm package requires React 19, so this is a
// direct port of the library's optics rather than a wrapper around it: the same
// rounded-rect SDF displacement shader, the same three-pass chromatic filter
// chain, the same layered border highlights and the same prop names.
//
// Upstream reference: src/shader-utils.ts and src/index.tsx.
(function expose(root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.EmberLiquidGlass = api
}(typeof globalThis === 'object' ? globalThis : this, () => {
  const NS = 'http://www.w3.org/2000/svg'

  // Known-good material defaults (mode standard).
  const DEFAULTS = {
    mode: 'standard',
    displacementScale: 100,
    blurAmount: 0.5,
    saturation: 140,
    aberrationIntensity: 2,
    elasticity: 0,
    cornerRadius: 32,
    overLight: false,
  }

  // ---------------------------------------------------------------- shader

  const smoothStep = (a, b, t) => {
    const clamped = Math.max(0, Math.min(1, (t - a) / (b - a)))
    return clamped * clamped * (3 - 2 * clamped)
  }

  const length = (x, y) => Math.sqrt(x * x + y * y)

  function roundedRectSDF(x, y, width, height, radius) {
    const qx = Math.abs(x) - width + radius
    const qy = Math.abs(y) - height + radius
    return Math.min(Math.max(qx, qy), 0) + length(Math.max(qx, 0), Math.max(qy, 0)) - radius
  }

  /** The library's "standard" fragment: pinch space toward the rounded edge. */
  function liquidGlassFragment(uv) {
    const ix = uv.x - 0.5
    const iy = uv.y - 0.5
    const distanceToEdge = roundedRectSDF(ix, iy, 0.3, 0.2, 0.6)
    const displacement = smoothStep(0.8, 0, distanceToEdge - 0.15)
    const scaled = smoothStep(0, 1, displacement)
    return { x: ix * scaled + 0.5, y: iy * scaled + 0.5 }
  }

  /**
   * Render the displacement map for a surface of the given size.
   * R carries x displacement, G and B carry y (B kept for SVG compatibility).
   */
  function renderDisplacementMap(document, width, height, fragment = liquidGlassFragment) {
    const w = Math.max(1, Math.round(width))
    const h = Math.max(1, Math.round(height))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const context = canvas.getContext('2d')

    const raw = new Float32Array(w * h * 2)
    let maxScale = 0
    let index = 0
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const position = fragment({ x: x / w, y: y / h })
        const dx = position.x * w - x
        const dy = position.y * h - y
        maxScale = Math.max(maxScale, Math.abs(dx), Math.abs(dy))
        raw[index++] = dx
        raw[index++] = dy
      }
    }
    maxScale = Math.max(maxScale, 1)

    const image = context.createImageData(w, h)
    const data = image.data
    let rawIndex = 0
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const dx = raw[rawIndex++]
        const dy = raw[rawIndex++]
        // Fade the outermost 2px so the map has no hard border.
        const edgeFactor = Math.min(1, Math.min(x, y, w - x - 1, h - y - 1) / 2)
        const r = (dx * edgeFactor) / maxScale + 0.5
        const g = (dy * edgeFactor) / maxScale + 0.5
        const pixel = (y * w + x) * 4
        data[pixel] = Math.max(0, Math.min(255, r * 255))
        data[pixel + 1] = Math.max(0, Math.min(255, g * 255))
        data[pixel + 2] = Math.max(0, Math.min(255, g * 255))
        data[pixel + 3] = 255
      }
    }
    context.putImageData(image, 0, 0)
    return canvas.toDataURL()
  }

  // ---------------------------------------------------------------- filter

  const el = (document, name, attributes = {}) => {
    const node = document.createElementNS(NS, name)
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value))
    return node
  }

  function channelMatrix(document, input, result, values) {
    return el(document, 'feColorMatrix', { in: input, type: 'matrix', values, result })
  }

  /**
   * Build the library's filter: displace R, G and B by slightly different
   * amounts so the edge splits into colour, blend them back, then keep that
   * aberration only around the rim and leave the centre optically clean.
   */
  function buildFilter(document, { id, mapUrl, displacementScale, aberrationIntensity, mode }) {
    const filter = el(document, 'filter', {
      id,
      x: '-35%', y: '-35%', width: '170%', height: '170%',
      colorInterpolationFilters: 'sRGB',
    })

    const gradient = el(document, 'radialGradient', { id: `${id}-edge-mask`, cx: '50%', cy: '50%' })
    gradient.append(
      el(document, 'stop', { offset: '0%', 'stop-color': 'black', 'stop-opacity': '0' }),
      el(document, 'stop', {
        offset: `${Math.max(30, 80 - aberrationIntensity * 2)}%`,
        'stop-color': 'black', 'stop-opacity': '0',
      }),
      el(document, 'stop', { offset: '100%', 'stop-color': 'white', 'stop-opacity': '1' }),
    )

    const direction = mode === 'shader' ? 1 : -1
    filter.append(
      el(document, 'feImage', {
        id: `${id}-map`, x: '0', y: '0', width: '100%', height: '100%',
        result: 'DISPLACEMENT_MAP', href: mapUrl, preserveAspectRatio: 'xMidYMid slice',
      }),
      // Rim mask: white at the edge, transparent through the middle.
      el(document, 'feColorMatrix', {
        in: 'DISPLACEMENT_MAP', type: 'matrix', result: 'EDGE_INTENSITY',
        values: '0.3 0.3 0.3 0 0  0.3 0.3 0.3 0 0  0.3 0.3 0.3 0 0  0 0 0 1 0',
      }),
      (() => {
        const transfer = el(document, 'feComponentTransfer', { in: 'EDGE_INTENSITY', result: 'EDGE_MASK' })
        transfer.append(el(document, 'feFuncA', { type: 'discrete', tableValues: `0 ${aberrationIntensity * 0.05} 1` }))
        return transfer
      })(),
      el(document, 'feOffset', { in: 'SourceGraphic', dx: '0', dy: '0', result: 'CENTER_ORIGINAL' }),

      el(document, 'feDisplacementMap', {
        in: 'SourceGraphic', in2: 'DISPLACEMENT_MAP', scale: displacementScale * direction,
        xChannelSelector: 'R', yChannelSelector: 'B', result: 'RED_DISPLACED',
      }),
      channelMatrix(document, 'RED_DISPLACED', 'RED_CHANNEL', '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'),

      el(document, 'feDisplacementMap', {
        in: 'SourceGraphic', in2: 'DISPLACEMENT_MAP',
        scale: displacementScale * (direction - aberrationIntensity * 0.05),
        xChannelSelector: 'R', yChannelSelector: 'B', result: 'GREEN_DISPLACED',
      }),
      channelMatrix(document, 'GREEN_DISPLACED', 'GREEN_CHANNEL', '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0'),

      el(document, 'feDisplacementMap', {
        in: 'SourceGraphic', in2: 'DISPLACEMENT_MAP',
        scale: displacementScale * (direction - aberrationIntensity * 0.1),
        xChannelSelector: 'R', yChannelSelector: 'B', result: 'BLUE_DISPLACED',
      }),
      channelMatrix(document, 'BLUE_DISPLACED', 'BLUE_CHANNEL', '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0'),

      el(document, 'feBlend', { in: 'GREEN_CHANNEL', in2: 'BLUE_CHANNEL', mode: 'screen', result: 'GB_COMBINED' }),
      el(document, 'feBlend', { in: 'RED_CHANNEL', in2: 'GB_COMBINED', mode: 'screen', result: 'RGB_COMBINED' }),
      el(document, 'feGaussianBlur', {
        in: 'RGB_COMBINED', stdDeviation: Math.max(0.1, 0.5 - aberrationIntensity * 0.1), result: 'ABERRATED_BLURRED',
      }),
      el(document, 'feComposite', { in: 'ABERRATED_BLURRED', in2: 'EDGE_MASK', operator: 'in', result: 'EDGE_ABERRATION' }),
      (() => {
        const transfer = el(document, 'feComponentTransfer', { in: 'EDGE_MASK', result: 'INVERTED_MASK' })
        transfer.append(el(document, 'feFuncA', { type: 'table', tableValues: '1 0' }))
        return transfer
      })(),
      el(document, 'feComposite', { in: 'CENTER_ORIGINAL', in2: 'INVERTED_MASK', operator: 'in', result: 'CENTER_CLEAN' }),
      el(document, 'feComposite', { in: 'EDGE_ABERRATION', in2: 'CENTER_CLEAN', operator: 'over' }),
    )

    return { filter, gradient }
  }

  // ---------------------------------------------------------------- surface

  const BORDER_SHADOW =
    '0 0 0 0.5px rgba(255,255,255,0.5) inset, 0 1px 3px rgba(255,255,255,0.25) inset, 0 1px 4px rgba(0,0,0,0.35)'

  function borderGradient(offset, low, high) {
    return `linear-gradient(${135 + offset.x * 1.2}deg,
      rgba(255,255,255,0) 0%,
      rgba(255,255,255,${low + Math.abs(offset.x) * 0.008}) ${Math.max(10, 33 + offset.y * 0.3)}%,
      rgba(255,255,255,${high + Math.abs(offset.x) * 0.012}) ${Math.min(90, 66 + offset.y * 0.4)}%,
      rgba(255,255,255,0) 100%)`
  }

  /**
   * Turn `host` into a liquid glass surface. The host keeps its own children,
   * which stay sharp: only the backdrop is refracted.
   */
  function createLiquidGlass(host, options = {}) {
    const document = host.ownerDocument
    const settings = { ...DEFAULTS, ...options }
    const id = `liquid-glass-${Math.random().toString(36).slice(2, 8)}`

    let defsSvg = document.getElementById('ember-liquid-glass-defs')
    if (!defsSvg) {
      defsSvg = el(document, 'svg', { id: 'ember-liquid-glass-defs', 'aria-hidden': 'true', width: '0', height: '0' })
      defsSvg.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none'
      defsSvg.append(el(document, 'defs'))
      document.body.append(defsSvg)
    }
    const defs = defsSvg.firstChild

    // Layers sit behind the host's own content.
    const backdrop = document.createElement('span')
    const rimScreen = document.createElement('span')
    const rimOverlay = document.createElement('span')
    for (const layer of [backdrop, rimScreen, rimOverlay]) {
      layer.setAttribute('aria-hidden', 'true')
      layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;border-radius:inherit'
      host.prepend(layer)
    }
    backdrop.style.zIndex = '-1'
    rimScreen.style.mixBlendMode = 'screen'
    rimScreen.style.opacity = '0.2'
    rimOverlay.style.mixBlendMode = 'overlay'
    for (const rim of [rimScreen, rimOverlay]) {
      rim.style.padding = '1.5px'
      rim.style.webkitMask = 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)'
      rim.style.webkitMaskComposite = 'xor'
      rim.style.maskComposite = 'exclude'
      rim.style.boxShadow = BORDER_SHADOW
    }

    let currentFilter = null
    let size = { width: 0, height: 0 }
    const offset = { x: 0, y: 0 }

    function paintRims() {
      rimScreen.style.background = borderGradient(offset, 0.12, 0.4)
      rimOverlay.style.background = borderGradient(offset, 0.32, 0.6)
    }

    function paintHost() {
      const { overLight, blurAmount, saturation, cornerRadius } = settings
      host.style.borderRadius = `${cornerRadius}px`
      host.style.boxShadow = overLight
        ? '0px 16px 70px rgba(0,0,0,0.75)'
        : '0px 12px 40px rgba(0,0,0,0.25)'
      backdrop.style.backdropFilter =
        `url(#${id}) blur(${(overLight ? 12 : 4) + blurAmount * 32}px) saturate(${saturation}%)`
      backdrop.style.webkitBackdropFilter = backdrop.style.backdropFilter
      backdrop.style.background = overLight ? 'rgba(0,0,0,0.2)' : 'transparent'
    }

    function rebuild() {
      const rect = host.getBoundingClientRect()
      const width = Math.round(rect.width)
      const height = Math.round(rect.height)
      if (width < 8 || height < 8) return false
      if (width === size.width && height === size.height && currentFilter) return true
      size = { width, height }

      const mapUrl = renderDisplacementMap(document, width, height)
      const { filter, gradient } = buildFilter(document, {
        id,
        mapUrl,
        displacementScale: settings.overLight ? settings.displacementScale * 0.5 : settings.displacementScale,
        aberrationIntensity: settings.aberrationIntensity,
        mode: settings.mode,
      })
      currentFilter?.remove()
      document.getElementById(`${id}-edge-mask`)?.remove()
      defs.append(gradient, filter)
      currentFilter = filter
      paintHost()
      paintRims()
      host.dataset.liquidGlass = 'ready'
      return true
    }

    /** Elasticity: the surface leans toward the pointer. */
    function trackPointer(container) {
      if (!settings.elasticity) return
      container.addEventListener('pointermove', (event) => {
        const rect = host.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        offset.x = ((event.clientX - centerX) / rect.width) * 100
        offset.y = ((event.clientY - centerY) / rect.height) * 100
        const lean = settings.elasticity * 0.1
        host.style.transform = `translate(${(event.clientX - centerX) * lean}px, ${(event.clientY - centerY) * lean}px)`
        paintRims()
      })
      container.addEventListener('pointerleave', () => {
        offset.x = 0
        offset.y = 0
        host.style.transform = ''
        paintRims()
      })
    }

    function update(next = {}) {
      Object.assign(settings, next)
      size = { width: 0, height: 0 } // force a rebuild at the new settings
      return rebuild()
    }

    if (getComputedStyle(host).position === 'static') host.style.position = 'relative'
    host.style.isolation = 'isolate'

    return { rebuild, update, trackPointer, settings, id }
  }

  return {
    createLiquidGlass,
    renderDisplacementMap,
    liquidGlassFragment,
    roundedRectSDF,
    smoothStep,
    DEFAULTS,
  }
}))
