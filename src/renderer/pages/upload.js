const byId = (id) => document.getElementById(id)
const backdrop = byId('upload-texture')
const hoverLens = byId('upload-hover-lens')
const hoverSource = byId('upload-hover-source')
const clipboardSection = byId('clipboard-section')
const clipboardSlot = byId('clipboard-slot')
const recentFiles = byId('recent-files')
const shell = byId('upload-shell')
let openSequence = Symbol('unopened')
let backdropRect = { x: 0, y: 0, width: innerWidth, height: innerHeight }
const optics = EmberUploadOptics.createOuterOptics(shell, byId('upload-switcher-map'))

window.EmberBrand.mountIcon(byId('upload-brand'))

function preview(thumbnail, name) {
  const frame = document.createElement('span')
  frame.className = 'file-preview'
  if (thumbnail) {
    const image = document.createElement('img')
    image.src = thumbnail
    image.alt = ''
    frame.append(image)
  } else {
    const glyph = document.createElement('span')
    glyph.className = 'file-glyph'
    const extension = name.includes('.') ? name.split('.').pop() : 'FILE'
    glyph.textContent = extension.slice(0, 5).toUpperCase()
    frame.append(glyph)
  }
  return frame
}

function animateHover(button) {
  button.addEventListener('pointerenter', () => {
    const shellRect = shell.getBoundingClientRect()
    const rect = button.getBoundingClientRect()
    const x = rect.left - shellRect.left
    const y = rect.top - shellRect.top
    shell.style.setProperty('--hover-x', `${x}px`)
    shell.style.setProperty('--hover-y', `${y}px`)
    shell.style.setProperty('--hover-width', `${rect.width}px`)
    shell.style.setProperty('--hover-height', `${rect.height}px`)
    shell.style.setProperty('--sample-x', `${backdropRect.x - x}px`)
    shell.style.setProperty('--sample-y', `${backdropRect.y - y}px`)
    hoverLens.dataset.visible = 'true'
  })
  button.addEventListener('pointerleave', () => {
    hoverLens.dataset.visible = 'false'
  })
}

function setBackdrop(state) {
  if (!state.backdrop) {
    backdrop.removeAttribute('src'); backdrop.removeAttribute('style')
    document.documentElement.dataset.backdrop = 'dark'
    hoverSource.style.removeProperty('background-image')
    backdropRect = { x: 0, y: 0, width: innerWidth, height: innerHeight }
    return
  }
  backdropRect = state.backdropRect || { x: 0, y: 0, width: innerWidth, height: innerHeight }
  window.EmberBackdropContrast?.apply(state.backdrop)
  backdrop.src = state.backdrop
  Object.assign(backdrop.style, { left: `${backdropRect.x}px`, top: `${backdropRect.y}px`, width: `${backdropRect.width}px`, height: `${backdropRect.height}px` })
  hoverSource.style.backgroundImage = `url("${state.backdrop}")`
  hoverSource.style.backgroundSize = `${backdropRect.width}px ${backdropRect.height}px`
}

function playOpening(state) {
  if (state.openSequence === openSequence) return
  openSequence = state.openSequence
  shell.dataset.opening = 'true'
  shell.getAnimations?.().forEach((animation) => animation.cancel())
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  shell.animate([
    { opacity: 0, transform: 'translate3d(0, -10px, 0) scale(.92)' },
    { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
  ], {
    duration: reduced ? 1 : 320, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'both',
  })
}

function render(state) {
  playOpening(state)
  setBackdrop(state)
  byId('upload-title').textContent = state.multiple ? 'Choose files' : 'Choose a file'
  byId('upload-origin').textContent = state.origin
  byId('accept-label').textContent = state.accept || 'All file types'
  byId('upload-error').textContent = state.error || ''

  clipboardSection.hidden = !state.clipboard
  if (state.clipboard) {
    byId('clipboard-name').textContent = state.clipboard.name
    const clipboardPreview = byId('clipboard-preview')
    clipboardPreview.replaceChildren()
    clipboardPreview.append(preview(state.clipboard.thumbnail, state.clipboard.name))
  }

  const cards = state.recents.map((file) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'glass-button recent-file'
    button.setAttribute('aria-label', `Choose ${file.name}`)
    button.append(preview(file.thumbnail, file.name))
    const name = document.createElement('span')
    name.className = 'file-name'
    name.textContent = file.name
    name.title = file.name
    button.append(name)
    button.onclick = () => window.emberOverlay.action('recent', { path: file.path })
    animateHover(button)
    return button
  })
  recentFiles.replaceChildren(...cards)
  byId('upload-empty').hidden = cards.length > 0
  void optics.refresh()
}

for (const button of [byId('show-all-files'), clipboardSlot, byId('upload-close')]) animateHover(button)
byId('show-all-files').onclick = () => window.emberOverlay.action('browse')
clipboardSlot.onclick = () => window.emberOverlay.action('clipboard')
byId('upload-close').onclick = () => window.emberOverlay.close()
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') window.emberOverlay.close()
})
window.addEventListener('resize', () => { void optics.refresh() })
window.emberOverlay.onState(render)
