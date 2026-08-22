(function configureNativeGlass() {
  const search = document.querySelector('[data-native-glass-search]')
  if (!search) return

  async function configure() {
    const settings = await window.ember?.nativeGlass?.getSettings?.()
    if (!settings?.search) return
    const { search: material } = settings
    const root = document.documentElement
    root.style.setProperty('--native-glass-corner-radius', `${material.cornerRadius}px`)
    root.style.setProperty('--native-glass-border-width', `${material.borderWidth}px`)
    root.style.setProperty('--native-glass-padding', material.padding)
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
