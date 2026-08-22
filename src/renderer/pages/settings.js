// ember://settings — the few preferences Ember actually stores.

const api = window.ember?.settings

const lg = window.EmberLiquidGlass
const glass = lg ? lg.createGlass(document) : null
glass?.track()

const SESSION_OPTIONS = [
  { value: 'ask', label: 'Ask me', detail: 'Ember asks whether to reopen your tabs each time you close it.' },
  { value: 'always', label: 'Reopen tabs', detail: 'Your open tabs come back automatically next time.' },
  { value: 'never', label: 'Start fresh', detail: 'Ember always opens with a single new tab.' },
]

const group = document.getElementById('session-restore')
const detail = document.getElementById('startup-detail')

function moveThumb(thumb, active) {
  if (!thumb || !active) return
  // Measure against the first segment, not the first child: the glass mounts an
  // optical layer ahead of them, and it deliberately overhangs the control.
  const first = active.parentElement.querySelector('.segment')
  thumb.style.width = `${active.offsetWidth}px`
  thumb.style.transform = `translateX(${active.offsetLeft - (first?.offsetLeft ?? 0)}px)`
}

function renderSessionRestore(current) {
  const thumb = document.createElement('span')
  thumb.className = 'thumb'

  const buttons = SESSION_OPTIONS.map((option) => {
    const button = document.createElement('button')
    button.className = 'segment'
    button.type = 'button'
    button.role = 'radio'
    button.textContent = option.label
    button.setAttribute('aria-checked', String(option.value === current))
    button.onclick = async () => {
      if (button.getAttribute('aria-checked') === 'true') return
      for (const other of buttons) other.setAttribute('aria-checked', String(other === button))
      detail.textContent = option.detail
      moveThumb(thumb, button)
      await api?.set('sessionRestore', option.value)
    }
    return button
  })

  group.replaceChildren(...buttons, thumb)
  const active = buttons[SESSION_OPTIONS.findIndex((option) => option.value === current)] || buttons[0]
  detail.textContent = SESSION_OPTIONS.find((option) => option.value === current)?.detail || SESSION_OPTIONS[0].detail
  // Wait for layout before measuring, and skip the opening slide.
  requestAnimationFrame(() => {
    const previous = thumb.style.transition
    thumb.style.transition = 'none'
    moveThumb(thumb, active)
    requestAnimationFrame(() => { thumb.style.transition = previous })
  })
}

for (const button of document.querySelectorAll('[data-open]')) {
  button.onclick = () => window.ember?.navigate(button.dataset.open)
}

async function load() {
  const settings = await api?.get()
  renderSessionRestore(settings?.sessionRestore || 'ask')
  document.getElementById('version').textContent = settings?.appVersion ? `Version ${settings.appVersion}` : ''
  glass?.refresh()
  // Each card is a small menu, so it gets the dropdown's sliding lens too.
  for (const card of document.querySelectorAll('.card')) {
    lg?.attachLens(card, { items: '.setting', radius: 13 })
  }
}

load()
