const favorites = document.getElementById('favorites')
const addressForm = document.getElementById('sidebar-address')
const addressInput = document.getElementById('sidebar-address-input')
const addressCopy = document.getElementById('sidebar-address-copy')
let browserState = { tabs: [] }
let config = { favorites: [], favoriteGrid: { columns: 2, rows: 2 } }
const TAB_DRAG_TYPE = 'application/x-ember-tab'
const FAVORITE_DRAG_TYPE = 'application/x-ember-favorite'
const TILE_HEIGHT = 43
const TILE_GAP = 10
const FOUR_ROW_INNER_HEIGHT = TILE_HEIGHT * 4 + TILE_GAP * 3
let pulseFavoriteId = null
let previewFavorites = null
let hoveredIndex = null
let draggedFavoriteId = null
let dropPending = false
let addressEditing = false

function assetUrl(asset) {
  return new URL(String(asset || '').replace(/^\//, ''), document.baseURI).href
}

function faviconFor(favorite) {
  if (favorite.icon) return favorite.icon
  try { return new URL('/favicon.ico', favorite.url).href } catch { return assetUrl(window.EmberBrand?.CHROME_ICON_ASSET || 'assets/icon-white-stroke.png') }
}

function gridMetrics(grid = {}) {
  const columns = Math.min(4, Math.max(1, Math.round(Number(grid.columns) || 2)))
  const rows = Math.min(7, Math.max(1, Math.round(Number(grid.rows) || 2)))
  const gap = rows <= 4 ? TILE_GAP : Math.max(4, TILE_GAP - (rows - 4) * 2)
  const tileHeight = rows <= 4
    ? TILE_HEIGHT
    : (FOUR_ROW_INNER_HEIGHT - gap * (rows - 1)) / rows
  return {
    columns,
    rows,
    capacity: columns * rows,
    gap,
    tileHeight,
    gridHeight: tileHeight * rows + gap * (rows - 1) + 2,
  }
}

function applyGridMetrics(metrics) {
  favorites.style.setProperty('--favorite-columns', metrics.columns)
  favorites.style.setProperty('--favorite-rows', metrics.rows)
  favorites.style.setProperty('--favorite-tile-height', `${metrics.tileHeight.toFixed(2)}px`)
  favorites.style.setProperty('--favorite-gap', `${metrics.gap}px`)
  favorites.style.setProperty('--favorite-grid-height', `${metrics.gridHeight.toFixed(2)}px`)
}

function dragImageFor(button) {
  const image = button.cloneNode(true)
  image.classList.add('favorite-drag-preview')
  document.body.append(image)
  setTimeout(() => image.remove(), 0)
  return image
}

function activeUrl() {
  return browserState.tabs.find((tab) => tab.active)?.url || browserState.nav?.url || ''
}

function syncAddress() {
  if (addressEditing) return
  addressInput.value = activeUrl()
}

function setAddressEditing(editing) {
  addressEditing = !!editing
  window.ember.setSidebarEditing(addressEditing)
}

function favoriteNode(favorite) {
  const button = document.createElement('button')
  const isPreview = favorite.id === 'drop-preview'
  button.className = 'favorite' + (isPreview ? ' drop-preview' : '')
  button.dataset.favoriteId = favorite.id
  button.title = isPreview ? 'Drop site here' : favorite.name
  button.setAttribute('aria-label', isPreview ? 'Proposed quick site position' : `Open ${favorite.name}`)
  if (!isPreview) {
    const isOpen = browserState.tabs.some((tab) => window.ember.sameFavoriteSite(favorite.url, tab.url))
    button.classList.toggle('is-open', isOpen)
    button.classList.toggle('satisfied', favorite.id === pulseFavoriteId)
    button.draggable = true
    button.onclick = () => window.ember.openFavorite(favorite.id)
    button.oncontextmenu = (event) => {
      event.preventDefault()
      event.stopPropagation()
      window.ember.favoriteContextMenu(favorite.id, event.clientX, event.clientY)
    }
    button.addEventListener('dragstart', (event) => {
      draggedFavoriteId = favorite.id
      button.classList.add('dragging')
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData(FAVORITE_DRAG_TYPE, favorite.id)
      event.dataTransfer.setDragImage(dragImageFor(button), event.offsetX, event.offsetY)
    })
    button.addEventListener('dragend', () => {
      draggedFavoriteId = null
      button.classList.remove('dragging')
      if (!dropPending) resetPreview()
    })
  }
  const image = document.createElement('img')
  image.src = faviconFor(favorite)
  image.alt = ''
  image.onerror = () => image.remove()
  button.append(image)
  return button
}

function render(list = previewFavorites || config.favorites, { animate = true } = {}) {
  const previous = new Map([...favorites.querySelectorAll('.favorite[data-favorite-id]')]
    .map((node) => [node.dataset.favoriteId, node.getBoundingClientRect()]))
  const metrics = gridMetrics(config.favoriteGrid)
  applyGridMetrics(metrics)
  const slots = Array.from({ length: metrics.capacity }, (_, index) => {
    const slot = document.createElement('div')
    slot.className = 'favorite-slot' + (index === hoveredIndex ? ' drop-hover' : '')
    slot.dataset.index = String(index)
    const favorite = list[index]
    if (favorite) slot.append(favoriteNode(favorite))
    return slot
  })
  favorites.replaceChildren(...slots)
  if (!animate || !previous.size) return
  requestAnimationFrame(() => {
    for (const node of favorites.querySelectorAll('.favorite[data-favorite-id]')) {
      const before = previous.get(node.dataset.favoriteId)
      const after = node.getBoundingClientRect()
      if (!before) {
        node.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'scale(1)' }], {
          duration: 170, easing: 'cubic-bezier(.2, .8, .2, 1)',
        })
        continue
      }
      const x = before.left - after.left
      const y = before.top - after.top
      const scaleX = before.width / Math.max(1, after.width)
      const scaleY = before.height / Math.max(1, after.height)
      if (Math.abs(x) < .5 && Math.abs(y) < .5 && Math.abs(scaleX - 1) < .01 && Math.abs(scaleY - 1) < .01) continue
      node.animate([
        { transformOrigin: 'top left', transform: `translate(${x}px, ${y}px) scale(${scaleX}, ${scaleY})` },
        { transformOrigin: 'top left', transform: 'translate(0, 0) scale(1, 1)' },
      ], { duration: 180, easing: 'cubic-bezier(.2, .8, .2, 1)' })
    }
  })
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

function carriesType(event, type) {
  return event.dataTransfer?.types?.includes(type)
}

function carriesQuickSite(event) {
  return carriesType(event, TAB_DRAG_TYPE) || carriesType(event, FAVORITE_DRAG_TYPE)
}

function candidateForDrag(event) {
  const favoriteId = draggedFavoriteId || event.dataTransfer?.getData(FAVORITE_DRAG_TYPE)
  if (favoriteId) return config.favorites.find((entry) => entry.id === favoriteId) || null
  const tabId = Number(event.dataTransfer?.getData(TAB_DRAG_TYPE))
  const tab = browserState.tabs.find((entry) => entry.id === tabId)
  if (!tab || !/^https?:/i.test(tab.url || '')) return null
  const existing = config.favorites.find((entry) => window.ember.sameFavoriteSite(entry.url, tab.url))
  return existing || {
    id: 'drop-preview', name: tab.title || 'New quick site', url: tab.url, ...(tab.favicon ? { icon: tab.favicon } : {}),
  }
}

function previewAt(event, index) {
  if (index === hoveredIndex && previewFavorites) return
  const candidate = candidateForDrag(event)
  if (!candidate) return
  const result = window.ember.previewFavoritePlacement(
    candidate, config.favorites, config.favoriteGrid, index,
  )
  if (!result?.favorite) return
  hoveredIndex = index
  previewFavorites = result.favorites
  favorites.classList.add('drop-ready')
  render(previewFavorites)
}

function resetPreview() {
  const changed = previewFavorites !== null || hoveredIndex !== null
  previewFavorites = null
  hoveredIndex = null
  favorites.classList.remove('drop-ready')
  if (changed) render(config.favorites)
}

favorites.addEventListener('dragenter', (event) => {
  if (carriesQuickSite(event)) favorites.classList.add('drop-ready')
})
favorites.addEventListener('dragover', (event) => {
  if (!carriesQuickSite(event)) return
  const slot = event.target.closest?.('.favorite-slot')
  if (!slot) return
  event.preventDefault()
  event.dataTransfer.dropEffect = carriesType(event, FAVORITE_DRAG_TYPE) ? 'move' : 'copy'
  previewAt(event, Number(slot.dataset.index))
})
favorites.addEventListener('dragleave', (event) => {
  if (!favorites.contains(event.relatedTarget)) resetPreview()
})
favorites.addEventListener('drop', async (event) => {
  if (!carriesQuickSite(event)) return
  const slot = event.target.closest?.('.favorite-slot')
  if (!slot) return
  event.preventDefault()
  const index = Number(slot.dataset.index)
  dropPending = true
  let result = null
  try {
    const favoriteId = draggedFavoriteId || event.dataTransfer.getData(FAVORITE_DRAG_TYPE)
    if (favoriteId) result = await window.ember.moveFavorite(favoriteId, index)
    else {
      const id = Number(event.dataTransfer.getData(TAB_DRAG_TYPE))
      if (Number.isFinite(id)) result = await window.ember.pinFavoriteFromTab(id, index)
    }
  } finally {
    dropPending = false
    draggedFavoriteId = null
    resetPreview()
  }
  if (result?.id && ['added', 'existing', 'moved', 'replaced'].includes(result.status)) pulseFavorite(result.id)
})

addressInput.addEventListener('focus', () => setAddressEditing(true))
addressInput.addEventListener('input', () => setAddressEditing(true))
addressInput.addEventListener('blur', () => {
  setAddressEditing(false)
  syncAddress()
})
addressInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return
  event.preventDefault()
  setAddressEditing(false)
  addressInput.value = activeUrl()
  addressInput.blur()
})
addressForm.addEventListener('submit', (event) => {
  event.preventDefault()
  setAddressEditing(false)
  window.ember.go(addressInput.value)
})
addressCopy.addEventListener('mousedown', (event) => event.preventDefault())
addressCopy.addEventListener('click', (event) => {
  event.preventDefault()
  event.stopPropagation()
  void window.ember.copyActiveUrl()
})

window.ember.onState((state) => { browserState = state || { tabs: [] }; syncAddress(); render() })
function applyConfig(next) {
  config = { ...config, ...(next || {}) }
  document.body.classList.toggle('sidebar-closed', config.sidebarOpen === false)
  previewFavorites = null
  hoveredIndex = null
  render(config.favorites)
}

window.ember.getChromeConfig().then(applyConfig)
window.ember.onChromeConfig(applyConfig)
window.ember.onWindowState(({ maximized } = {}) => document.body.classList.toggle('maximized', !!maximized))
