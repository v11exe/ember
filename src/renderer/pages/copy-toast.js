const toast = document.getElementById('copy-toast')
let openSequence = Symbol('unopened')

window.emberOverlay.onState((state) => {
  if (state?.patch && state.closing) {
    toast.classList.remove('opening')
    void toast.offsetWidth
    toast.classList.add('closing')
    return
  }
  if (!state || state.kind !== 'copy-toast' || state.openSequence === openSequence) return
  openSequence = state.openSequence
  toast.style.setProperty('--toast-life', `${Number(state.lifetime) || 2600}ms`)
  toast.classList.remove('closing')
  toast.classList.remove('opening')
  void toast.offsetWidth
  toast.classList.add('opening')
})
