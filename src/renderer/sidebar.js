const favorites = document.getElementById('favorites')
let browserState = { tabs: [] }
let config = { favorites: [] }

function assetUrl(asset) {
  return new URL(String(asset || '').replace(/^\//, ''), document.baseURI).href
}

function faviconFor(favorite) {
  if (favorite.icon) return favorite.icon
  try { return new URL('/favicon.ico', favorite.url).href } catch { return assetUrl(window.EmberBrand?.CHROME_ICON_ASSET || 'assets/icon-white-stroke.png') }
}

function favoriteNode(favorite, activeUrl) {
  const button = document.createElement('button')
  button.className = 'favorite'
  button.title = favorite.name
  button.setAttribute('aria-label', `Open ${favorite.name}`)
  button.classList.toggle('active', window.ember.sameFavoriteSite(favorite.url, activeUrl))
  button.onclick = () => window.ember.openFavorite(favorite.id)
  const image = document.createElement('img')
  image.src = faviconFor(favorite)
  image.alt = ''
  image.onerror = () => image.remove()
  button.append(image)
  return button
}

function render() {
  const active = browserState.tabs.find((tab) => tab.active)
  favorites.replaceChildren(...config.favorites.map((favorite) => favoriteNode(favorite, active?.url)))
}

window.ember.onState((state) => { browserState = state; render() })
window.ember.getChromeConfig().then((next) => { config = next; render() })
window.ember.onChromeConfig((next) => { config = next; render() })
window.ember.onWindowState(({ maximized } = {}) => document.body.classList.toggle('maximized', !!maximized))
