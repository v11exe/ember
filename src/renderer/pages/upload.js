const byId = (id) => document.getElementById(id)
const backdrop = byId('glass-backdrop')
const clipboardSection = byId('clipboard-section')
const clipboardSlot = byId('clipboard-slot')
const recentFiles = byId('recent-files')

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

function render(state) {
  if (state.backdrop) backdrop.src = state.backdrop
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
    return button
  })
  recentFiles.replaceChildren(...cards)
  byId('upload-empty').hidden = cards.length > 0
}

byId('show-all-files').onclick = () => window.emberOverlay.action('browse')
clipboardSlot.onclick = () => window.emberOverlay.action('clipboard')
byId('upload-close').onclick = () => window.emberOverlay.close()
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') window.emberOverlay.close()
})
window.emberOverlay.onState(render)
