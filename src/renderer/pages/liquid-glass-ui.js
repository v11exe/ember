// Shared Liquid Glass UI for ember:// pages.
//
// The new tab search pill (liquid-glass-search.js) is the reference material.
// This module mounts the same optical stack — an aberration-filtered warp layer
// over the live backdrop, plus the screen and overlay rims — on any element, and
// lends lists the dropdown menu's sliding selector lens.
//
// One difference from the search pill: elasticity is 0. Nothing stretches,
// leans or scales towards the cursor. Every other value is unchanged, including
// the pointer-tracked highlight angle, which was never an elasticity term.
(function expose(root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.EmberLiquidGlass = api
}(typeof globalThis === 'object' ? globalThis : this, () => {
  const NS = 'http://www.w3.org/2000/svg'

  /** Mirrors NATIVE_GLASS_DEFAULTS.search, with elasticity taken out. */
  const DEFAULT_MATERIAL = Object.freeze({
    displacementScale: 0,
    blurAmount: 0.05,
    saturation: 95,
    aberrationIntensity: 20,
    elasticity: 0,
  })

  /** Same ramp the search pill uses: 4px of blur plus the material's share. */
  function blurRadius(material) { return 4 + material.blurAmount * 32 }

  function backdropFilter(material) {
    return `blur(${blurRadius(material)}px) saturate(${material.saturation}%)`
  }

  /**
   * Per-channel displacement: red, green and blue are pushed by increasing
   * amounts, then screened back together. With displacementScale 0 the red
   * channel stays put and the other two fringe by the aberration intensity.
   */
  function createFilter(document, id, material) {
    const svg = (tag, attributes = {}) => {
      const element = document.createElementNS(NS, tag)
      for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
      return element
    }
    const host = svg('svg', { class: 'lg-filter', 'aria-hidden': 'true' })
    host.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none'
    const defs = svg('defs')
    const filter = svg('filter', {
      id, x: '-35%', y: '-35%', width: '170%', height: '170%', colorInterpolationFilters: 'sRGB',
    })
    filter.append(
      svg('feTurbulence', { type: 'fractalNoise', baseFrequency: '.012', numOctaves: '2', seed: '8', result: 'DISPLACEMENT_MAP' }),
      svg('feDisplacementMap', { in: 'SourceGraphic', in2: 'DISPLACEMENT_MAP', scale: String(-material.displacementScale), xChannelSelector: 'R', yChannelSelector: 'B', result: 'RED_DISPLACED' }),
      svg('feDisplacementMap', { in: 'SourceGraphic', in2: 'DISPLACEMENT_MAP', scale: String(-material.displacementScale - material.aberrationIntensity), xChannelSelector: 'R', yChannelSelector: 'B', result: 'GREEN_DISPLACED' }),
      svg('feDisplacementMap', { in: 'SourceGraphic', in2: 'DISPLACEMENT_MAP', scale: String(-material.displacementScale - material.aberrationIntensity * 2), xChannelSelector: 'R', yChannelSelector: 'B', result: 'BLUE_DISPLACED' }),
      svg('feBlend', { in: 'GREEN_DISPLACED', in2: 'BLUE_DISPLACED', mode: 'screen', result: 'GB_COMBINED' }),
      svg('feBlend', { in: 'RED_DISPLACED', in2: 'GB_COMBINED', mode: 'screen' }),
    )
    defs.append(filter)
    host.append(defs)
    return host
  }

  /**
   * The highlight sweeps with the pointer and brightens as it comes alongside,
   * fading out 200px beyond the element. Straight from the search pill, minus
   * the elastic transform.
   * @returns {{ angle: number, intensity: number }}
   */
  function highlightFor(rect, point) {
    const deltaX = point.x - (rect.left + rect.width / 2)
    const deltaY = point.y - (rect.top + rect.height / 2)
    const edgeX = Math.max(0, Math.abs(deltaX) - rect.width / 2)
    const edgeY = Math.max(0, Math.abs(deltaY) - rect.height / 2)
    const fade = Math.max(0, 1 - Math.hypot(edgeX, edgeY) / 200)
    const width = Math.max(rect.width, 1)
    return {
      angle: 135 + (deltaX / width) * 120 * fade,
      intensity: 0.12 + Math.min(0.28, (Math.abs(deltaX) / width) * 0.28) * fade,
    }
  }

  /**
   * Write a glass element's label without wiping its optical layers. Anything
   * that reaches for .textContent on a mounted surface would remove the warp
   * and both rims, so it goes through the wrapper wrapText() left behind.
   */
  function setLabel(element, text) {
    if (!element) return
    const label = element.querySelector(':scope > .lg-text')
    if (label) label.textContent = text
    else element.textContent = text
  }

  /** Loose text would paint under the warp layer, so give it an element. */
  function wrapText(element) {
    for (const node of [...element.childNodes]) {
      if (node.nodeType !== 3 || !node.textContent.trim()) continue
      const span = element.ownerDocument.createElement('span')
      span.className = 'lg-text'
      node.replaceWith(span)
      span.append(node)
    }
  }

  function createGlass(document, options = {}) {
    const material = { ...DEFAULT_MATERIAL, ...options.material }
    const filterId = options.filterId || 'ember-lg-aberration'
    const tracked = new Set()
    let filterMounted = false
    let point = null
    let frame = 0

    function ensureFilter() {
      if (filterMounted || document.getElementById(filterId)) { filterMounted = true; return }
      document.body.append(createFilter(document, filterId, material))
      filterMounted = true
    }

    /**
     * Children only stack above the warp once they are positioned and given a
     * rung. Anything that already carries its own position or z-index is left
     * alone — a control that deliberately layers itself, like the settings
     * segmented thumb, must keep the order it asked for.
     */
    function raiseChildren(element) {
      for (const child of element.children) {
        if (child.classList.contains('lg-layer') || child.classList.contains('lg-lens')) continue
        const style = getComputedStyle(child)
        if (style.position === 'static') child.style.position = 'relative'
        if (style.zIndex === 'auto') child.style.zIndex = '1'
      }
    }

    function apply(element) {
      if (!element) return element
      ensureFilter()
      if (element.dataset.lgReady) { raiseChildren(element); return element }

      element.classList.add('lg')
      wrapText(element)

      const warp = document.createElement('span')
      warp.className = 'lg-layer lg-warp'
      warp.style.filter = `url(#${filterId})`
      warp.style.backdropFilter = backdropFilter(material)
      warp.style.webkitBackdropFilter = warp.style.backdropFilter
      element.prepend(warp)

      const highlight = document.createElement('span')
      highlight.className = 'lg-layer lg-highlight'
      const overlay = document.createElement('span')
      overlay.className = 'lg-layer lg-highlight lg-highlight-overlay'
      element.append(highlight, overlay)

      raiseChildren(element)
      element.dataset.lgReady = 'true'
      tracked.add(element)
      return element
    }

    function refresh(scope = document, selector = options.selector || '[data-lg]') {
      const elements = [...scope.querySelectorAll(selector)]
      for (const element of elements) apply(element)
      document.documentElement.dataset.lgReady = 'true'
      return elements
    }

    // ---- pointer-tracked highlight -----------------------------------------
    function paint() {
      frame = 0
      if (!point) return
      for (const element of tracked) {
        if (!element.isConnected) { tracked.delete(element); continue }
        const rect = element.getBoundingClientRect()
        if (!rect.width || !rect.height) continue
        const { angle, intensity } = highlightFor(rect, point)
        element.style.setProperty('--lg-angle', `${angle}deg`)
        element.style.setProperty('--lg-highlight', String(intensity))
      }
    }

    function onMove(event) {
      point = { x: event.clientX, y: event.clientY }
      if (!frame) frame = requestAnimationFrame(paint)
    }

    function track() {
      document.addEventListener('mousemove', onMove, { passive: true })
    }

    return { apply, refresh, track, material, filterId, get tracked() { return tracked } }
  }

  /**
   * The dropdown menu's hover: one pill-shaped lens that slides between rows on
   * the shared motion curve, refracting whatever it passes over.
   *
   * Safe to call again after the host's children are replaced — the lens is
   * looked up rather than remembered, so a re-render cannot orphan it.
   *
   * @param {Element} host container the lens lives in
   * @param {{ items: string, radius?: number|string }} options
   */
  const wired = new WeakSet()

  function attachLens(host, { items, radius } = {}) {
    if (!host || !items) return null
    const document = host.ownerDocument
    const lensOf = () => host.querySelector(':scope > .lg-lens')

    function mountLens() {
      const lens = document.createElement('span')
      lens.className = 'lg-lens'
      lens.setAttribute('aria-hidden', 'true')
      if (radius !== undefined) {
        lens.style.setProperty('--lens-radius', typeof radius === 'number' ? `${radius}px` : radius)
      }
      // Under the rows, over the warp — whichever of the two mounted first.
      const warp = host.querySelector(':scope > .lg-warp')
      if (warp) warp.after(lens)
      else host.prepend(lens)
      return lens
    }

    if (!lensOf()) mountLens()
    host.classList.add('lg-lens-host')
    if (wired.has(host)) return { get lens() { return lensOf() } }
    wired.add(host)

    let current = null

    function place(item) {
      const lens = lensOf() || mountLens()
      const hostRect = host.getBoundingClientRect()
      const rect = item.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      lens.style.setProperty('--lens-x', `${rect.left - hostRect.left}px`)
      lens.style.setProperty('--lens-y', `${rect.top - hostRect.top}px`)
      lens.style.setProperty('--lens-width', `${rect.width}px`)
      lens.style.setProperty('--lens-height', `${rect.height}px`)
      lens.dataset.visible = 'true'
    }

    function hide() {
      current = null
      const lens = lensOf()
      if (lens) lens.dataset.visible = 'false'
    }

    host.addEventListener('pointerover', (event) => {
      const item = event.target.closest?.(items)
      if (!item || !host.contains(item) || item.disabled) { hide(); return }
      current = item
      place(item)
    })
    host.addEventListener('pointerleave', hide)
    // A row can move under a still cursor: filtering a list, or a resize.
    const reposition = () => { if (current?.isConnected) place(current); else hide() }
    document.addEventListener('scroll', reposition, { capture: true, passive: true })
    host.ownerDocument.defaultView?.addEventListener('resize', reposition)

    return { get lens() { return lensOf() }, hide, reposition }
  }

  return {
    DEFAULT_MATERIAL, attachLens, backdropFilter, blurRadius,
    createFilter, createGlass, highlightFor, setLabel, wrapText,
  }
}))
