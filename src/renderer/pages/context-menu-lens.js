(function expose(root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.EmberMenuLens = api
}(typeof globalThis === 'object' ? globalThis : this, () => {
  function findEnabledIndex(buttons, start, direction) {
    if (!buttons.length) return -1
    let index = start
    for (let attempts = 0; attempts < buttons.length; attempts += 1) {
      index = (index + buttons.length) % buttons.length
      if (!buttons[index].disabled) return index
      index += direction
    }
    return -1
  }

  function lensFrame(shellRect, itemRect, backdropRect = { x: 0, y: 0 }) {
    const x = itemRect.left - shellRect.left
    const y = itemRect.top - shellRect.top
    return {
      x, y, width: itemRect.width, height: itemRect.height,
      sampleX: backdropRect.x - x, sampleY: backdropRect.y - y,
    }
  }

  function keyboardStart(activeIndex, key, length) {
    if (key === 'ArrowDown') return activeIndex < 0 ? 0 : activeIndex + 1
    if (key === 'ArrowUp') return activeIndex < 0 ? length - 1 : activeIndex - 1
    if (key === 'Home') return 0
    if (key === 'End') return length - 1
    return activeIndex
  }

  function createLensController(shell, lens) {
    let buttons = []
    let frames = []
    let activeIndex = -1
    let backdropRect = { x: 0, y: 0 }

    function move(frame) {
      if (!frame) return
      lens.style.setProperty('--lens-x', `${frame.x}px`)
      lens.style.setProperty('--lens-y', `${frame.y}px`)
      lens.style.setProperty('--lens-width', `${frame.width}px`)
      lens.style.setProperty('--lens-height', `${frame.height}px`)
      lens.style.setProperty('--sample-x', `${frame.sampleX}px`)
      lens.style.setProperty('--sample-y', `${frame.sampleY}px`)
      lens.dataset.visible = 'true'
    }

    function refresh() {
      const shellRect = shell.getBoundingClientRect()
      frames = buttons.map((button) => lensFrame(shellRect, button.getBoundingClientRect(), backdropRect))
      if (activeIndex >= 0) move(frames[activeIndex])
    }

    function activate(start, { focus = true, direction = 1 } = {}) {
      const next = findEnabledIndex(buttons, start, direction)
      if (next < 0) return -1
      activeIndex = next
      buttons.forEach((button, index) => button.dataset.active = String(index === next))
      if (focus) buttons[next].focus({ preventScroll: true })
      buttons[next].scrollIntoView({ block: 'nearest' })
      refresh()
      move(frames[next])
      return next
    }

    function setButtons(next) {
      buttons = next
      activeIndex = -1
      lens.dataset.visible = 'false'
      buttons.forEach((button) => { button.dataset.active = 'false' })
      refresh()
    }

    function setBackdropRect(rect) {
      backdropRect = { x: rect?.x || 0, y: rect?.y || 0 }
      refresh()
    }

    return { activate, refresh, setBackdropRect, setButtons, get activeIndex() { return activeIndex } }
  }

  return { createLensController, findEnabledIndex, keyboardStart, lensFrame }
}))
