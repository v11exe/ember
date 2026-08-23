// ember://conversion — the popup that appears beside a selected price,
// measurement or time. Two lines and a Copy button; nothing else fits, and
// nothing else is wanted.

const els = {
  shell: document.getElementById('shell'),
  backdrop: document.getElementById('backdrop'),
  from: document.getElementById('from'),
  to: document.getElementById('to'),
  note: document.getElementById('note'),
  copy: document.getElementById('copy'),
}

let openSequence = Symbol('unopened')

els.copy.onclick = () => window.emberOverlay.action('copy')

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    window.emberOverlay.close()
  }
})

window.emberOverlay.onState((state) => {
  if (!state) return
  if (state.backdrop) els.backdrop.src = state.backdrop
  else els.backdrop.removeAttribute('src')
  window.EmberBackdropContrast?.apply(state.backdrop)

  els.from.textContent = state.from || ''
  // A converted figure is an estimate unless it is an exact clock time.
  els.to.textContent = state.approximate ? `≈ ${state.to}` : state.to
  els.note.textContent = state.note || ''
  els.note.hidden = !state.note
  els.copy.textContent = 'Copy'

  // Replay the entrance only when this is a new selection, not a relayout.
  if (state.openSequence !== openSequence) {
    openSequence = state.openSequence
    els.shell.getAnimations?.().forEach((animation) => { animation.currentTime = 0 })
  }
})
