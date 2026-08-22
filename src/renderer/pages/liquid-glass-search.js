(function mountLiquidGlassSearch() {
  const host = document.getElementById('native-liquid-glass')
  if (!host) return

  const svgNs = 'http://www.w3.org/2000/svg'
  const svg = (tag, attributes = {}) => {
    const element = document.createElementNS(svgNs, tag)
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value))
    return element
  }

  function createFilter(id, material) {
    const filterSvg = svg('svg', { class: 'liquid-glass-filter', 'aria-hidden': 'true' })
    const defs = svg('defs')
    const filter = svg('filter', { id, x: '-35%', y: '-35%', width: '170%', height: '170%', colorInterpolationFilters: 'sRGB' })
    filter.append(
      svg('feTurbulence', { type: 'fractalNoise', baseFrequency: '.012', numOctaves: '2', seed: '8', result: 'DISPLACEMENT_MAP' }),
      svg('feDisplacementMap', { in: 'SourceGraphic', in2: 'DISPLACEMENT_MAP', scale: String(-material.displacementScale), xChannelSelector: 'R', yChannelSelector: 'B', result: 'RED_DISPLACED' }),
      svg('feDisplacementMap', { in: 'SourceGraphic', in2: 'DISPLACEMENT_MAP', scale: String(-material.displacementScale - material.aberrationIntensity), xChannelSelector: 'R', yChannelSelector: 'B', result: 'GREEN_DISPLACED' }),
      svg('feDisplacementMap', { in: 'SourceGraphic', in2: 'DISPLACEMENT_MAP', scale: String(-material.displacementScale - material.aberrationIntensity * 2), xChannelSelector: 'R', yChannelSelector: 'B', result: 'BLUE_DISPLACED' }),
      svg('feBlend', { in: 'GREEN_DISPLACED', in2: 'BLUE_DISPLACED', mode: 'screen', result: 'GB_COMBINED' }),
      svg('feBlend', { in: 'RED_DISPLACED', in2: 'GB_COMBINED', mode: 'screen' }),
    )
    defs.append(filter)
    filterSvg.append(defs)
    return filterSvg
  }

  function mount(material) {
    const filterId = `ember-liquid-glass-${Math.random().toString(36).slice(2)}`
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
    warp.style.filter = `url(#${filterId})`
    warp.style.backdropFilter = `blur(${4 + material.blurAmount * 32}px) saturate(${material.saturation}%)`
    warp.style.webkitBackdropFilter = warp.style.backdropFilter

    const content = document.createElement('div')
    content.className = 'glass__content'
    const form = document.createElement('form')
    form.className = 'liquid-glass-search'
    form.id = 'search-form'
    form.setAttribute('role', 'search')
    form.innerHTML = `<svg class="liquid-glass-search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="6.75" stroke="currentColor" stroke-width="2" /><path d="M16.2 16.2L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg><input id="q" type="search" autocomplete="off" spellcheck="false" autofocus placeholder="Search Google or type a URL" aria-label="Search" /><button type="submit">Search</button>`
    content.append(form)
    glass.append(warp, content)

    const highlight = document.createElement('span')
    highlight.className = 'liquid-glass-highlight'
    const highlightOverlay = document.createElement('span')
    highlightOverlay.className = 'liquid-glass-highlight liquid-glass-highlight-overlay'
    root.append(createFilter(filterId, material), glass, highlight, highlightOverlay)
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
