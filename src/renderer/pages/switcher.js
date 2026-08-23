// ember://switcher — the Ctrl+Tab card row.
//
// The full payload carries a screenshot per tab, so moving the highlight
// arrives as a patch. This page keeps the last full state and merges.

const els = {
  backdrop: document.getElementById('backdrop'),
  cards: document.getElementById('cards'),
}

let state = { tabs: [], index: 0 }
let buttons = []

function card(tab, position) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'card'
  button.setAttribute('role', 'option')
  button.dataset.asleep = String(!!tab.asleep)
  button.title = tab.asleep ? `${tab.title} — sleeping` : tab.title

  const shot = document.createElement('div')
  shot.className = tab.thumbnail ? 'shot' : 'shot empty'
  if (tab.thumbnail) {
    const image = document.createElement('img')
    image.src = tab.thumbnail
    image.alt = ''
    shot.append(image)
  }

  const meta = document.createElement('div')
  meta.className = 'meta'
  if (tab.favicon) {
    const icon = document.createElement('img')
    icon.src = tab.favicon
    icon.alt = ''
    icon.onerror = () => icon.remove()
    meta.append(icon)
  }
  const text = document.createElement('div')
  text.className = 'text'
  const title = document.createElement('div')
  title.className = 'title'
  title.textContent = tab.title
  const domain = document.createElement('div')
  domain.className = 'domain'
  domain.textContent = tab.domain || ''
  text.append(title, domain)
  meta.append(text)

  button.append(shot, meta)
  button.onclick = () => window.emberOverlay.action('switch-pick', { id: tab.id })
  button.dataset.position = String(position)
  return button
}

function renderSelection() {
  buttons.forEach((button, position) => {
    const selected = position === state.index
    button.setAttribute('aria-selected', String(selected))
    if (selected) button.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })
}

function renderAll() {
  buttons = state.tabs.map(card)
  els.cards.replaceChildren(...buttons)
  renderSelection()
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    window.emberOverlay.action('switch-cancel')
  }
})

// Letting go of Ctrl is what commits. The main process watches for it too, for
// the moment before this view exists, but once the switcher is up the keys are
// arriving here and this is the reliable place to notice.
window.addEventListener('keyup', (event) => {
  if (event.key === 'Control' || event.key === 'Meta') {
    window.emberOverlay.action('switch-commit')
  }
})

window.emberOverlay.onState((incoming) => {
  if (!incoming) return
  if (incoming.patch) {
    state = { ...state, ...incoming }
    renderSelection()
    return
  }
  state = incoming
  if (incoming.backdrop) els.backdrop.src = incoming.backdrop
  else els.backdrop.removeAttribute('src')
  window.EmberBackdropContrast?.apply(incoming.backdrop)
  renderAll()
})
