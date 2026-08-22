(function configureNativeGlass() {
  const search = document.querySelector('[data-native-glass-search]')
  if (!search) return
  let elasticity = 0.46

  async function configure() {
    const settings = await window.ember?.nativeGlass?.getSettings?.()
    if (!settings?.search) return
    const { search: material } = settings
    const root = document.documentElement
    root.style.setProperty('--native-glass-corner-radius', `${material.cornerRadius}px`)
    root.style.setProperty('--native-glass-border-width', `${material.borderWidth}px`)
    root.style.setProperty('--native-glass-padding', material.padding)
    root.style.setProperty('--native-glass-blur', `${4 + material.blurAmount * 32}px`)
    root.style.setProperty('--native-glass-saturation', `${material.saturation}%`)
    root.style.setProperty('--native-glass-elasticity', String(material.elasticity))
    elasticity = Number(material.elasticity) || 0
    root.style.setProperty('--native-glass-aberration', String(material.aberrationIntensity))
    search.dataset.displacementScale = String(material.displacementScale)
    search.dataset.blurAmount = String(material.blurAmount)
    search.dataset.saturation = String(material.saturation)
    search.dataset.aberrationIntensity = String(material.aberrationIntensity)
    search.dataset.elasticity = String(material.elasticity)
    search.dataset.mode = material.mode
    search.dataset.mouseContainer = material.mouseContainer
    search.dataset.globalMousePos = material.globalMousePos
    search.dataset.onClick = material.onClick
    document.documentElement.dataset.nativeGlassReady = 'true'
  }

  let pointerFrame = null
  let pointerX = 0
  let pointerY = 0
  function paintPointerState() {
    pointerFrame = null
    const rect = search.getBoundingClientRect()
    const x = Math.max(-1, Math.min(1, (pointerX - rect.left) / rect.width * 2 - 1))
    const y = Math.max(-1, Math.min(1, (pointerY - rect.top) / rect.height * 2 - 1))
    search.style.setProperty('--native-glass-tilt-x', `${x * 2.2 * elasticity}deg`)
    search.style.setProperty('--native-glass-tilt-y', `${y * -1.5 * elasticity}deg`)
    search.style.setProperty('--native-glass-light-x', `${50 + x * 32}%`)
    search.style.setProperty('--native-glass-light-y', `${38 + y * 28}%`)
  }
  function onPointerMove(event) {
    pointerX = event.clientX
    pointerY = event.clientY
    if (!pointerFrame) pointerFrame = requestAnimationFrame(paintPointerState)
  }
  function resetPointerState() {
    search.style.setProperty('--native-glass-tilt-x', '0deg')
    search.style.setProperty('--native-glass-tilt-y', '0deg')
    search.style.setProperty('--native-glass-light-x', '50%')
    search.style.setProperty('--native-glass-light-y', '38%')
  }
  search.addEventListener('pointermove', onPointerMove)
  search.addEventListener('pointerleave', resetPointerState)
  search.addEventListener('pointerdown', () => search.dataset.pressed = 'true')
  search.addEventListener('pointerup', () => { delete search.dataset.pressed })
  search.addEventListener('pointercancel', () => { delete search.dataset.pressed })

  let frame = null
  function layoutSearch() {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      const rect = search.getBoundingClientRect()
      window.ember?.nativeGlass?.layoutSearch?.({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      })
    })
  }

  new ResizeObserver(layoutSearch).observe(search)
  window.addEventListener('resize', layoutSearch)
  configure().then(layoutSearch)
}())
