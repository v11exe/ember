// ember://session-prompt — asked as the window closes.
// Answers: yes | no | always | never. Escape cancels the close entirely.

const els = {
  backdrop: document.getElementById('backdrop'),
  detail: document.getElementById('detail'),
  yes: document.getElementById('yes'),
  no: document.getElementById('no'),
  always: document.getElementById('always'),
  never: document.getElementById('never'),
}

function answer(value) {
  window.emberOverlay.action('session', { answer: value })
}

els.yes.onclick = () => answer('yes')
els.no.onclick = () => answer('no')
els.always.onclick = () => answer('always')
els.never.onclick = () => answer('never')

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    answer('cancel') // closing was a mistake: keep the window open
  } else if (event.key === 'Enter' && document.activeElement === document.body) {
    event.preventDefault()
    answer('yes')
  }
})

window.emberOverlay.onState((state) => {
  if (state?.backdrop) els.backdrop.src = state.backdrop
  window.EmberBackdropContrast?.apply(state?.backdrop)
  const count = Number(state?.tabCount) || 0
  els.detail.textContent = count
    ? `Ember will reopen ${count} tab${count === 1 ? '' : 's'} the next time you open it.`
    : 'Ember can restore this session when you open it again.'
  els.yes.focus()
})
