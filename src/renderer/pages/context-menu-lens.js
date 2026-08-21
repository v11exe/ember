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

  function lensFrame(shellRect, itemRect) {
    const x = itemRect.left - shellRect.left
    const y = itemRect.top - shellRect.top
    return {
      x, y, width: itemRect.width, height: itemRect.height,
      textureX: -x, textureY: -y,
    }
  }

  function createLensController(shell, lens) {
    let buttons = []
    let frames = []
    let activeIndex = -1

    function move(frame) {
      if (!frame) return
      lens.style.setProperty('--lens-x', `${frame.x}px`)
      lens.style.setProperty('--lens-y', `${frame.y}px`)
      lens.style.setProperty('--lens-width', `${frame.width}px`)
      lens.style.setProperty('--lens-height', `${frame.height}px`)
      lens.dataset.visible = 'true'
    }

    function refresh() {
      const shellRect = shell.getBoundingClientRect()
      frames = buttons.map((button) => lensFrame(shellRect, button.getBoundingClientRect()))
      if (activeIndex >= 0) move(frames[activeIndex])
    }

    function activate(start, { focus = true, direction = 1 } = {}) {
      const next = findEnabledIndex(buttons, start, direction)
      if (next < 0) return -1
      activeIndex = next
      buttons.forEach((button, index) => button.dataset.active = String(index === next))
      move(frames[next])
      if (focus) buttons[next].focus({ preventScroll: true })
      buttons[next].scrollIntoView({ block: 'nearest' })
      return next
    }

    function setButtons(next) {
      buttons = next
      activeIndex = -1
      refresh()
    }

    return { activate, refresh, setButtons, get activeIndex() { return activeIndex } }
  }

  return { createLensController, findEnabledIndex, lensFrame }
}))
