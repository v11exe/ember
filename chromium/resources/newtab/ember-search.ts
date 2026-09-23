// @ts-nocheck — Electron's canonical search optics, emitted by Chromium's WebUI pipeline.
(function mountLiquidGlassSearch() {
  const host = document.getElementById('native-liquid-glass')
  if (!host) return

  const svgNs = 'http://www.w3.org/2000/svg'
  const svg = (tag, attributes = {}) => {
    const element = document.createElementNS(svgNs, tag)
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value))
    return element
  }

  function mount(material) {
    const root = document.createElement('div')
    root.className = 'liquid-glass-root'
    root.style.setProperty('--glass-radius', `${material.cornerRadius}px`)
    root.style.setProperty('--glass-padding', material.padding)
    root.style.setProperty('--glass-blur', `${4 + material.blurAmount * 32}px`)
    root.style.setProperty('--glass-saturation', `${material.saturation}%`)

    const glass = document.createElement('div')
    glass.className = 'glass'
    const warp = document.createElement('span')
    warp.className = 'glass__warp'

    const content = document.createElement('div')
    content.className = 'glass__content'
    const form = document.createElement('form')
    form.className = 'liquid-glass-search'
    form.id = 'search-form'
    form.setAttribute('role', 'search')
    // Both the glyph and the word are submit buttons: either one runs the
    // search, the same as pressing Enter.
    // Internal Chromium pages enforce Trusted Types. Build the same controls
    // as Electron without assigning an HTML string to the DOM.
    const searchGlyph = document.createElement('button')
    searchGlyph.type = 'submit'
    searchGlyph.className = 'liquid-glass-search-glyph'
    searchGlyph.setAttribute('aria-label', 'Search')
    const searchIcon = svg('svg', { class: 'liquid-glass-search-icon', viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' })
    searchIcon.append(
      svg('circle', { cx: '11', cy: '11', r: '6.75', stroke: 'currentColor', 'stroke-width': '2' }),
      svg('path', { d: 'M16.2 16.2L21 21', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' }),
    )
    searchGlyph.append(searchIcon)
    const chip = document.createElement('span')
    chip.className = 'liquid-glass-search-chip'
    chip.id = 'q-chip'
    chip.hidden = true
    const input = document.createElement('input')
    input.id = 'q'
    input.type = 'search'
    input.autocomplete = 'off'
    input.spellcheck = false
    input.autofocus = true
    input.placeholder = 'Search Google or type a URL'
    input.setAttribute('aria-label', 'Search')
    const searchLabel = document.createElement('button')
    searchLabel.type = 'submit'
    searchLabel.textContent = 'Search'
    form.append(searchGlyph, chip, input, searchLabel)
    content.append(form)
    glass.append(warp, content)

    const highlight = document.createElement('span')
    highlight.className = 'liquid-glass-highlight'
    const highlightOverlay = document.createElement('span')
    highlightOverlay.className = 'liquid-glass-highlight liquid-glass-highlight-overlay'
    // The whole NTP already reveals Windows' native backdrop. Renderer-side
    // SVG/backdrop filters repeatedly sampled Chromium's transparent surface
    // and fed prior frames back into the next one, duplicating the logo and
    // search contents after tab switches and fullscreen transitions.
    root.append(glass, highlight, highlightOverlay)
    host.replaceChildren(root)

    let active = false
    let point = { x: 0, y: 0 }
    function calculateDirectionalScale() {
      const rect = root.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const deltaX = point.x - centerX
      const deltaY = point.y - centerY
      const edgeX = Math.max(0, Math.abs(deltaX) - rect.width / 2)
      const edgeY = Math.max(0, Math.abs(deltaY) - rect.height / 2)
      const edgeDistance = Math.hypot(edgeX, edgeY)
      const fade = Math.max(0, 1 - edgeDistance / 200)
      const distance = Math.hypot(deltaX, deltaY) || 1
      const stretch = Math.min(distance / 300, 1) * material.elasticity * fade
      const scaleX = 1 + Math.abs(deltaX / distance) * stretch * .3 - Math.abs(deltaY / distance) * stretch * .15
      const scaleY = 1 + Math.abs(deltaY / distance) * stretch * .3 - Math.abs(deltaX / distance) * stretch * .15
      const translateX = deltaX * material.elasticity * .1 * fade
      const translateY = deltaY * material.elasticity * .1 * fade
      root.style.transform = active ? `translate(${translateX}px, ${translateY}px) scale(.96)` : `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`
      root.style.setProperty('--glass-angle', `${135 + deltaX / Math.max(rect.width, 1) * 120}deg`)
      root.style.setProperty('--glass-highlight', String(.12 + Math.min(.28, Math.abs(deltaX) / Math.max(rect.width, 1) * .28)))
    }
    function onMove(event) { point = { x: event.clientX, y: event.clientY }; calculateDirectionalScale() }
    document.body.addEventListener('mousemove', onMove)
    glass.addEventListener('mousedown', () => { active = true; calculateDirectionalScale() })
    document.addEventListener('mouseup', () => { if (active) { active = false; calculateDirectionalScale() } })
    root.addEventListener('click', () => {})
    document.documentElement.dataset.nativeGlassReady = 'true'
    document.dispatchEvent(new Event('native-liquid-glass-ready'))
  }

  Promise.resolve(window.ember?.nativeGlass?.getSettings?.()).then((settings) => mount(settings?.search || {
    displacementScale: 0,
    blurAmount: .05,
    saturation: 95,
    aberrationIntensity: 20,
    elasticity: .46,
    cornerRadius: 48,
    padding: '20px 25px',
  }))
}())
