// Vanilla DOM port of rdev/liquid-glass-react's standard material for Ember's
// bounded overlays. The optical math and layer order intentionally follow the
// upstream MIT-licensed component; only React state management is omitted.
(function expose(root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.EmberOverlayGlass = api
}(typeof globalThis === 'object' ? globalThis : this, () => {
  const NS = 'http://www.w3.org/2000/svg'
  const MAP = '/assets/liquid-glass-map.jpg'

  const BASE_MATERIAL = Object.freeze({
    displacementScale: 100,
    blurAmount: 0.5,
    saturation: 140,
    aberrationIntensity: 2,
    elasticity: 0,
    cornerRadius: 32,
  })
  const CONTROL_MATERIAL = Object.freeze({
    displacementScale: 0,
    blurAmount: 1,
    saturation: 140,
    aberrationIntensity: 2,
    elasticity: 0,
  })

  function blurRadius(material) {
    return 4 + material.blurAmount * 32
  }

  function backdropFilter(material) {
    return `blur(${blurRadius(material)}px) saturate(${material.saturation}%)`
  }

  function channelScales(material) {
    const { displacementScale, aberrationIntensity } = material
    if (displacementScale === 0) return { red: 0, green: 0, blue: 0 }
    return {
      red: displacementScale * -1,
      green: displacementScale * (-1 - aberrationIntensity * 0.05),
      blue: displacementScale * (-1 - aberrationIntensity * 0.1),
    }
  }

  function setBackdrop(image, dataUrl, rect, documentRef = document) {
    const root = documentRef.documentElement
    if (!dataUrl) {
      image.removeAttribute('src')
      image.removeAttribute('style')
      root.dataset.liquidGlassCapture = 'missing'
      return null
    }
    const viewport = documentRef.defaultView || (typeof window === 'object' ? window : { innerWidth: 0, innerHeight: 0 })
    const frame = rect || { x: 0, y: 0, width: viewport.innerWidth, height: viewport.innerHeight }
    image.src = dataUrl
    Object.assign(image.style, {
      left: `${frame.x}px`, top: `${frame.y}px`, width: `${frame.width}px`, height: `${frame.height}px`,
    })
    root.dataset.liquidGlassCapture = 'ready'
    return frame
  }

  function svg(documentRef, tag, attributes = {}) {
    const node = documentRef.createElementNS(NS, tag)
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value))
    return node
  }

  // Edge-only standard-mode filter from liquid-glass-react. The clean centre
  // is composited back over the displaced RGB perimeter.
  function createFilter(documentRef, id, material, mapHref = MAP) {
    const host = svg(documentRef, 'svg', { class: 'overlay-liquid-glass__filter', 'aria-hidden': 'true' })
    const defs = svg(documentRef, 'defs')
    const filter = svg(documentRef, 'filter', {
      id, x: '-35%', y: '-35%', width: '170%', height: '170%', colorInterpolationFilters: 'sRGB',
    })
    const map = svg(documentRef, 'feImage', {
      x: 0, y: 0, width: '100%', height: '100%', result: 'DISPLACEMENT_MAP', href: mapHref,
      preserveAspectRatio: 'xMidYMid slice',
    })
    const edgeMatrix = svg(documentRef, 'feColorMatrix', {
      in: 'DISPLACEMENT_MAP', type: 'matrix',
      values: '0.3 0.3 0.3 0 0  0.3 0.3 0.3 0 0  0.3 0.3 0.3 0 0  0 0 0 1 0',
      result: 'EDGE_INTENSITY',
    })
    const edgeTransfer = svg(documentRef, 'feComponentTransfer', { in: 'EDGE_INTENSITY', result: 'EDGE_MASK' })
    edgeTransfer.append(svg(documentRef, 'feFuncA', {
      type: 'discrete', tableValues: `0 ${material.aberrationIntensity * 0.05} 1`,
    }))
    const centre = svg(documentRef, 'feOffset', { in: 'SourceGraphic', dx: 0, dy: 0, result: 'CENTER_ORIGINAL' })
    const scales = channelScales(material)

    const channel = (name, scale, matrix) => {
      const displaced = svg(documentRef, 'feDisplacementMap', {
        in: 'SourceGraphic', in2: 'DISPLACEMENT_MAP', scale,
        xChannelSelector: 'R', yChannelSelector: 'B', result: `${name}_DISPLACED`,
      })
      const isolated = svg(documentRef, 'feColorMatrix', {
        in: `${name}_DISPLACED`, type: 'matrix', values: matrix, result: `${name}_CHANNEL`,
      })
      return [displaced, isolated]
    }

    const red = channel('RED', scales.red, '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0')
    const green = channel('GREEN', scales.green, '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0')
    const blue = channel('BLUE', scales.blue, '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0')
    const blur = Math.max(0.1, 0.5 - material.aberrationIntensity * 0.1)
    const invert = svg(documentRef, 'feComponentTransfer', { in: 'EDGE_MASK', result: 'INVERTED_MASK' })
    invert.append(svg(documentRef, 'feFuncA', { type: 'table', tableValues: '1 0' }))

    filter.append(
      map, edgeMatrix, edgeTransfer, centre,
      ...red, ...green, ...blue,
      svg(documentRef, 'feBlend', { in: 'GREEN_CHANNEL', in2: 'BLUE_CHANNEL', mode: 'screen', result: 'GB_COMBINED' }),
      svg(documentRef, 'feBlend', { in: 'RED_CHANNEL', in2: 'GB_COMBINED', mode: 'screen', result: 'RGB_COMBINED' }),
      svg(documentRef, 'feGaussianBlur', { in: 'RGB_COMBINED', stdDeviation: blur, result: 'ABERRATED_BLURRED' }),
      svg(documentRef, 'feComposite', { in: 'ABERRATED_BLURRED', in2: 'EDGE_MASK', operator: 'in', result: 'EDGE_ABERRATION' }),
      invert,
      svg(documentRef, 'feComposite', { in: 'CENTER_ORIGINAL', in2: 'INVERTED_MASK', operator: 'in', result: 'CENTER_CLEAN' }),
      svg(documentRef, 'feComposite', { in: 'EDGE_ABERRATION', in2: 'CENTER_CLEAN', operator: 'over' }),
    )
    defs.append(filter)
    host.append(defs)
    return host
  }

  function createGlass(documentRef) {
    let serial = 0
    const tracked = new Set()
    let pointer = null
    let frame = 0

    function materialFor(element) {
      return element.dataset.liquidGlass === 'control' ? CONTROL_MATERIAL : BASE_MATERIAL
    }

    function apply(element) {
      if (!element || element.dataset.liquidGlassReady) return element
      const material = materialFor(element)
      const id = `ember-overlay-glass-${++serial}`
      const warp = documentRef.createElement('span')
      warp.className = 'overlay-liquid-glass__warp'
      warp.setAttribute('aria-hidden', 'true')
      warp.style.filter = `url(#${id})`
      warp.style.backdropFilter = backdropFilter(material)
      warp.style.webkitBackdropFilter = warp.style.backdropFilter

      const rim = documentRef.createElement('span')
      rim.className = 'overlay-liquid-glass__rim'
      rim.setAttribute('aria-hidden', 'true')
      const rimOverlay = rim.cloneNode()
      rimOverlay.className = 'overlay-liquid-glass__rim overlay-liquid-glass__rim--overlay'

      element.classList.add('overlay-liquid-glass')
      if (material.cornerRadius) element.style.setProperty('--liquid-glass-radius', `${material.cornerRadius}px`)
      element.prepend(createFilter(documentRef, id, material), warp)
      element.append(rim, rimOverlay)
      element.dataset.liquidGlassReady = 'true'
      tracked.add(element)
      return element
    }

    function refresh(scope = documentRef) {
      for (const element of scope.querySelectorAll('[data-liquid-glass]')) apply(element)
    }

    function paint() {
      frame = 0
      if (!pointer) return
      for (const element of tracked) {
        if (!element.isConnected) { tracked.delete(element); continue }
        const rect = element.getBoundingClientRect()
        if (!rect.width || !rect.height) continue
        const offsetX = ((pointer.x - (rect.left + rect.width / 2)) / rect.width) * 100
        const offsetY = ((pointer.y - (rect.top + rect.height / 2)) / rect.height) * 100
        element.style.setProperty('--liquid-angle', `${135 + offsetX * 1.2}deg`)
        element.style.setProperty('--liquid-highlight', String(0.12 + Math.abs(offsetX) * 0.008))
        element.style.setProperty('--liquid-highlight-strong', String(0.4 + Math.abs(offsetX) * 0.012))
        element.style.setProperty('--liquid-stop-a', `${Math.max(10, 33 + offsetY * 0.3)}%`)
        element.style.setProperty('--liquid-stop-b', `${Math.min(90, 66 + offsetY * 0.4)}%`)
      }
    }

    documentRef.addEventListener('mousemove', (event) => {
      pointer = { x: event.clientX, y: event.clientY }
      if (!frame) frame = requestAnimationFrame(paint)
    }, { passive: true })

    return { apply, refresh }
  }

  function autoMount(documentRef) {
    const glass = createGlass(documentRef)
    glass.refresh()
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue
          if (node.matches?.('[data-liquid-glass]')) glass.apply(node)
          glass.refresh(node)
        }
      }
    }).observe(documentRef.documentElement, { childList: true, subtree: true })
    return glass
  }

  if (typeof document === 'object') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => autoMount(document))
    else autoMount(document)
  }

  return {
    BASE_MATERIAL, CONTROL_MATERIAL, MAP,
    backdropFilter, blurRadius, channelScales, createFilter, createGlass, setBackdrop,
  }
}))
