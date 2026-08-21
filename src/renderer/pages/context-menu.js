const menu = document.getElementById('context-menu')
const backdrop = document.getElementById('glass-backdrop')

const glyphs = {
  back: '←', forward: '→', reload: '↻', undo: '↶', redo: '↷',
  cut: '✂', copy: '▣', paste: '▤', delete: '⌫', 'select-all': '□',
  'open-link': '↗', 'copy-link': '⛓', 'open-image': '▧', 'copy-image': '▣',
  'copy-image-address': '⛓', 'dictionary-add': '+', 'save-page': '⇩',
  print: '▦', 'view-source': '‹›', inspect: '⌖',
}

let buttons = []
let activeIndex = -1

function glyphFor(id) {
  if (id.startsWith('spell:')) return '✓'
  return glyphs[id] || '·'
}

function activate(index, focus = true, direction = 1) {
  if (!buttons.length) return
  let next = index
  for (let attempts = 0; attempts < buttons.length; attempts += 1) {
    next = (next + buttons.length) % buttons.length
    if (!buttons[next].disabled) break
    next += direction
  }
  activeIndex = next
  buttons.forEach((button, position) => button.dataset.active = String(position === activeIndex))
  if (focus) buttons[activeIndex].focus({ preventScroll: true })
  buttons[activeIndex].scrollIntoView({ block: 'nearest' })
}

function render(state) {
  if (state.backdrop) backdrop.src = state.backdrop
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
    button.onclick = () => window.emberOverlay.action(item.id)
    return button
  })
  menu.replaceChildren(...nodes)
  buttons = [...menu.querySelectorAll('.menu-item')]
  activeIndex = buttons.findIndex((button) => !button.disabled)
  if (activeIndex >= 0) activate(activeIndex, false)
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { event.preventDefault(); window.emberOverlay.close(); return }
  if (!buttons.length) return
  if (event.key === 'ArrowDown') { event.preventDefault(); activate(activeIndex + 1, true, 1) }
  else if (event.key === 'ArrowUp') { event.preventDefault(); activate(activeIndex - 1, true, -1) }
  else if (event.key === 'Home') { event.preventDefault(); activate(0, true, 1) }
  else if (event.key === 'End') { event.preventDefault(); activate(buttons.length - 1, true, -1) }
  else if ((event.key === 'Enter' || event.key === ' ') && activeIndex >= 0) {
    event.preventDefault(); buttons[activeIndex].click()
  }
})

window.emberOverlay.onState(render)
