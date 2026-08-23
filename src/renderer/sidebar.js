const favorites = document.getElementById('favorites')
let browserState = { tabs: [] }
let config = { favorites: [] }
const TAB_DRAG_TYPE = 'application/x-ember-tab'
let pulseFavoriteId = null

function assetUrl(asset) {
  return new URL(String(asset || '').replace(/^\//, ''), document.baseURI).href
}

function faviconFor(favorite) {
  if (favorite.icon) return favorite.icon
  try { return new URL('/favicon.ico', favorite.url).href } catch { return assetUrl(window.EmberBrand?.CHROME_ICON_ASSET || 'assets/icon-white-stroke.png') }
}

function favoriteNode(favorite) {
  const button = document.createElement('button')
  button.className = 'favorite'
  button.dataset.favoriteId = favorite.id
  button.title = favorite.name
  button.setAttribute('aria-label', `Open ${favorite.name}`)
  const isOpen = browserState.tabs.some((tab) => window.ember.sameFavoriteSite(favorite.url, tab.url))
  button.classList.toggle('is-open', isOpen)
  button.classList.toggle('satisfied', favorite.id === pulseFavoriteId)
  button.onclick = () => window.ember.openFavorite(favorite.id)
  button.oncontextmenu = (event) => {
    event.preventDefault()
    event.stopPropagation()
    window.ember.favoriteContextMenu(favorite.id, event.clientX, event.clientY)
  }
  const image = document.createElement('img')
  image.src = faviconFor(favorite)
  image.alt = ''
  image.onerror = () => image.remove()
  button.append(image)
  return button
}

function render() {
  favorites.replaceChildren(...config.favorites.map(favoriteNode))
}

function pulseFavorite(id) {
  pulseFavoriteId = id
  render()
  setTimeout(() => {
    if (pulseFavoriteId !== id) return
    pulseFavoriteId = null
    render()
  }, 520)
}

function carriesTab(event) {
  return event.dataTransfer?.types?.includes(TAB_DRAG_TYPE)
}

favorites.addEventListener('dragenter', (event) => {
  if (carriesTab(event)) favorites.classList.add('drop-ready')
})
favorites.addEventListener('dragover', (event) => {
  if (!carriesTab(event)) return
  event.preventDefault()
  event.dataTransfer.dropEffect = 'copy'
  favorites.classList.add('drop-ready')
})
favorites.addEventListener('dragleave', (event) => {
  if (!favorites.contains(event.relatedTarget)) favorites.classList.remove('drop-ready')
})
favorites.addEventListener('drop', async (event) => {
  if (!carriesTab(event)) return
  event.preventDefault()
  favorites.classList.remove('drop-ready')
  const id = Number(event.dataTransfer.getData(TAB_DRAG_TYPE))
  if (!Number.isFinite(id)) return
  const result = await window.ember.pinFavoriteFromTab(id)
  if (result?.id && (result.status === 'added' || result.status === 'existing')) pulseFavorite(result.id)
})

window.ember.onState((state) => { browserState = state; render() })
function applyConfig(next) {
  config = next
  document.body.classList.toggle('sidebar-closed', next?.sidebarOpen === false)
  render()
}

window.ember.getChromeConfig().then(applyConfig)
window.ember.onChromeConfig(applyConfig)
window.ember.onWindowState(({ maximized } = {}) => document.body.classList.toggle('maximized', !!maximized))
