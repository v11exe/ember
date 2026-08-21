const shell = document.getElementById('menu-shell')
const menu = document.getElementById('context-menu')
const backdrop = document.getElementById('outer-texture')
const lens = document.getElementById('selector-lens')
const lensController = EmberMenuLens.createLensController(shell, lens)

const glyphs = {
  back: '←', forward: '→', reload: '↻', undo: '↶', redo: '↷',
  cut: '✂', copy: '▣', paste: '▤', delete: '⌫', 'select-all': '□',
  'open-link': '↗', 'copy-link': '⛓', 'open-image': '▧', 'copy-image': '▣',
  'copy-image-address': '⛓', 'dictionary-add': '+', 'save-page': '⇩',
  print: '▦', 'view-source': '‹›', inspect: '⌖',
}

let buttons = []

function glyphFor(id) {
  if (id.startsWith('spell:')) return '✓'
  return glyphs[id] || '·'
}

function setBackdrop(state) {
  if (!state.backdrop) {
    backdrop.removeAttribute('src')
    backdrop.removeAttribute('style')
    return
  }
  const rect = state.backdropRect || { x: 0, y: 0, width: innerWidth, height: innerHeight }
  backdrop.src = state.backdrop
  Object.assign(backdrop.style, {
    left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px`,
  })
  shell.style.setProperty('--backdrop-x', `${rect.x}px`)
  shell.style.setProperty('--backdrop-y', `${rect.y}px`)
  shell.style.setProperty('--backdrop-width', `${rect.width}px`)
  shell.style.setProperty('--backdrop-height', `${rect.height}px`)
}

function render(state) {
  setBackdrop(state)
  const nodes = state.items.map((item) => {
    if (item.type === 'separator') {
      const separator = document.createElement('div')
      separator.className = 'menu-separator'
      separator.setAttribute('role', 'separator')
      return separator
    }
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'menu-item'
    button.disabled = item.enabled === false
    button.setAttribute('role', 'menuitem')
    const icon = document.createElement('span')
    icon.className = 'menu-icon'
    icon.textContent = glyphFor(item.id)
    const label = document.createElement('span')
    label.className = 'menu-label'
    label.textContent = item.label
    const shortcut = document.createElement('span')
    shortcut.className = 'menu-shortcut'
    shortcut.textContent = item.shortcut || ''
    button.append(icon, label, shortcut)
    button.addEventListener('pointerenter', () => {
      if (!button.disabled) lensController.activate(buttons.indexOf(button), { focus: false })
    })
    button.onclick = () => window.emberOverlay.action(item.id)
    return button
  })
  menu.replaceChildren(...nodes)
  buttons = [...menu.querySelectorAll('.menu-item')]
  lensController.setButtons(buttons)
  const first = EmberMenuLens.findEnabledIndex(buttons, 0, 1)
  if (first >= 0) lensController.activate(first, { focus: false })
}

window.addEventListener('resize', () => lensController.refresh())
menu.addEventListener('scroll', () => lensController.refresh())
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { event.preventDefault(); window.emberOverlay.close(); return }
  if (!buttons.length) return
  const active = lensController.activeIndex
  if (event.key === 'ArrowDown') { event.preventDefault(); lensController.activate(active + 1, { direction: 1 }) }
  else if (event.key === 'ArrowUp') { event.preventDefault(); lensController.activate(active - 1, { direction: -1 }) }
  else if (event.key === 'Home') { event.preventDefault(); lensController.activate(0, { direction: 1 }) }
  else if (event.key === 'End') { event.preventDefault(); lensController.activate(buttons.length - 1, { direction: -1 }) }
  else if ((event.key === 'Enter' || event.key === ' ') && active >= 0) {
    event.preventDefault(); buttons[active].click()
  }
})

window.emberOverlay.onState(render)
