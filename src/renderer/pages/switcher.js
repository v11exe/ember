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
  button.dataset.liquidGlass = 'control'
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

// Letting go of Ctrl is what commits — but which surface is told about that
// key-up is not dependable. Focus moves between the page, the chrome and this
// view as the chord is held, and a long hold with several taps could lose the
// event entirely, leaving the switcher up until it was clicked. So the release
// is recognised from any of the signals that mean the same thing, and the
// first one to arrive wins; committing twice is a no-op in main.
let committed = false
function commit() {
  if (committed) return
  committed = true
  window.emberOverlay.action('switch-commit')
}

for (const target of [window, document]) {
  target.addEventListener('keyup', (event) => {
    if (event.key === 'Control' || event.key === 'Meta') commit()
  }, true)
  // A key that arrives without the modifier means the modifier is already gone.
  target.addEventListener('keydown', (event) => {
    if (event.key !== 'Control' && event.key !== 'Meta' && !event.ctrlKey && !event.metaKey) commit()
  }, true)
}
// Focus leaving the overlay is the release we were never told about.
window.addEventListener('blur', commit)
// Last resort: the modifier state as any pointer movement reports it. This
// costs nothing while the chord is held and catches the case where no
// keyboard event is delivered to this view at all.
window.addEventListener('pointermove', (event) => {
  if (!event.ctrlKey && !event.metaKey) commit()
}, true)

window.emberOverlay.onState((incoming) => {
  if (!incoming) return
  if (incoming.patch) {
    state = { ...state, ...incoming }
    renderSelection()
    return
  }
  state = incoming
  // A fresh opening arms the release detector again.
  committed = false
  window.EmberOverlayGlass.setBackdrop(els.backdrop, incoming.backdrop, incoming.backdropRect)
  window.EmberBackdropContrast?.apply(incoming.backdrop)
  renderAll()
})
