const $ = (id) => document.getElementById(id)

const els = {
  shell: $('chrome-shell'),
  topChrome: $('top-chrome'),
  sidebarToggle: $('sidebar-toggle'),
  tabs: $('tabs'),
  tabstrip: $('tabstrip'),
  sidebarHeader: $('sidebar-header'),
  navigation: $('top-navigation'),
  actions: document.querySelector('.top-actions'),
  caption: document.querySelector('.window-controls'),
  omnibox: $('omnibox'),
  form: $('omnibox-form'),
  back: $('back'),
  forward: $('forward'),
  reload: $('reload'),
  archive: $('archive-btn'),
  chip: $('bang-chip'),
  tip: $('bang-tip'),
}

const DEFAULT_PLACEHOLDER = els.omnibox.placeholder
let omniboxDirty = false
let engaged = null
let browserState = { tabs: [], nav: {} }
let chromeConfig = { sidebarOpen: true, favorites: [] }
let bookmarkSnapshot = { version: 1, visible: false, items: [] }
let bookmarkPath = []
let metricFrame = 0

window.EmberBrand.mountChromeIcon($('chrome-brand'))

const NON_DRAG_SELECTOR = 'button, input, .tab, .top-navigation, .tabstrip, .top-actions, .window-controls, .omnibox, .bookmarks-bar'
let dragPointer = null
let pendingDragPoint = null
let dragFrame = 0

function flushWindowDrag() {
  dragFrame = 0
  if (!pendingDragPoint) return
  window.ember.updateWindowDrag(pendingDragPoint.x, pendingDragPoint.y)
  pendingDragPoint = null
}

els.topChrome.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || event.target.closest(NON_DRAG_SELECTOR)) return
  dragPointer = event.pointerId
  els.topChrome.setPointerCapture(event.pointerId)
  window.ember.beginWindowDrag(event.screenX, event.screenY)
  event.preventDefault()
})
els.topChrome.addEventListener('pointermove', (event) => {
  if (event.pointerId !== dragPointer) return
  pendingDragPoint = { x: event.screenX, y: event.screenY }
  if (!dragFrame) dragFrame = requestAnimationFrame(flushWindowDrag)
})
function finishWindowDrag(event) {
  if (event.pointerId !== dragPointer) return
  if (dragFrame) cancelAnimationFrame(dragFrame)
  dragFrame = 0
  pendingDragPoint = null
  dragPointer = null
  window.ember.endWindowDrag()
}
els.topChrome.addEventListener('pointerup', finishWindowDrag)
els.topChrome.addEventListener('pointercancel', finishWindowDrag)

function isNewTab(tab) {
  return String(tab?.url || '').startsWith('ember://newtab')
}

function assetUrl(asset) {
  const relative = String(asset || '').replace(/^\//, '')
  return new URL(relative, document.baseURI).href
}

function updateOverflow() {
  for (const title of els.tabs.querySelectorAll('.tab-title')) {
    title.classList.toggle('overflowing', title.scrollWidth > title.clientWidth + 1)
  }
}

function updateTabMetrics() {
  cancelAnimationFrame(metricFrame)
  metricFrame = requestAnimationFrame(() => {
    const fixed = els.sidebarHeader.offsetWidth + els.navigation.offsetWidth
      + els.actions.offsetWidth + els.caption.offsetWidth + 40
    const availableWidth = Math.max(0, innerWidth - fixed)
    const maximum = window.ember.tabMaximum({ availableWidth, count: browserState.tabs.length })
    els.tabs.style.setProperty('--tab-max-width', `${maximum}px`)
    els.tabstrip.style.setProperty('--tabstrip-max', `${Math.max(95, availableWidth - 96)}px`)
    requestAnimationFrame(updateOverflow)
  })
}

function tabNode(tab) {
  const displayTitle = isNewTab(tab) ? 'New Tab' : (tab.title || 'New Tab')
  const el = document.createElement('div')
  el.className = 'tab' + (tab.active ? ' active' : '') + (tab.asleep ? ' asleep' : '')
  el.title = tab.asleep ? `${displayTitle} — sleeping` : displayTitle
  el.onmousedown = (event) => {
    if (event.button === 1) { event.preventDefault(); window.ember.closeTab(tab.id) }
    else if (event.button === 0) window.ember.selectTab(tab.id)
  }
  el.oncontextmenu = (event) => {
    event.preventDefault()
    window.ember.tabContextMenu(tab.id, event.clientX)
  }

  if (tab.loading) {
    const spinner = document.createElement('div')
    spinner.className = 'spinner'
    el.append(spinner)
  } else {
    const img = document.createElement('img')
    const fallback = isNewTab(tab)
      ? window.EmberBrand.CHROME_ICON_ASSET
      : window.EmberBrand.ICON_ASSET
    img.className = 'tab-favicon' + (isNewTab(tab) ? ' newtab-favicon' : '')
    const fallbackUrl = assetUrl(fallback)
    img.src = tab.favicon || assetUrl(fallback)
    img.alt = ''
    img.onerror = () => {
      if (img.src !== fallbackUrl) img.src = fallbackUrl
      else img.remove()
    }
    el.append(img)
  }

  const title = document.createElement('span')
  title.className = 'tab-title'
  title.textContent = displayTitle
  el.append(title)

  if (tab.asleep) {
    const sleep = document.createElement('span')
    sleep.className = 'tab-sleep'
    sleep.title = 'Sleeping'
    sleep.setAttribute('aria-hidden', 'true')
    el.append(sleep)
  }

  const close = document.createElement('button')
  close.className = 'tab-close'
  close.textContent = '×'
  close.title = 'Close tab'
  close.setAttribute('aria-label', `Close ${displayTitle}`)
  close.onmousedown = (event) => { event.stopPropagation(); event.preventDefault() }
  close.onclick = (event) => { event.stopPropagation(); window.ember.closeTab(tab.id) }
  el.append(close)

  el.addEventListener('pointerenter', () => requestAnimationFrame(updateOverflow))
  el.addEventListener('pointerleave', () => requestAnimationFrame(updateOverflow))
  return el
}

function renderTabs(tabs) {
  els.tabs.replaceChildren(...tabs.map(tabNode))
  updateTabMetrics()
}

function setSidebarOpen(open, { persist = false } = {}) {
  chromeConfig.sidebarOpen = !!open
  els.shell.classList.toggle('sidebar-closed', !chromeConfig.sidebarOpen)
  els.sidebarToggle.setAttribute('aria-expanded', String(chromeConfig.sidebarOpen))
  els.sidebarToggle.title = chromeConfig.sidebarOpen ? 'Close sidebar' : 'Open sidebar'
  els.sidebarToggle.setAttribute('aria-label', els.sidebarToggle.title)
  if (persist) window.ember.setSidebarOpen(chromeConfig.sidebarOpen)
  updateTabMetrics()
}

function applyChromeConfig(config) {
  chromeConfig = {
    sidebarOpen: config?.sidebarOpen !== false,
    favorites: Array.isArray(config?.favorites) ? config.favorites : [],
  }
  setSidebarOpen(chromeConfig.sidebarOpen)
}

function renderNav(nav) {
  els.back.disabled = !nav.canGoBack
  els.forward.disabled = !nav.canGoForward
  els.archive.hidden = !nav.archiveUrl
  if (!nav.archiveUrl) els.archive.classList.remove('busy')
  if (!omniboxDirty && document.activeElement !== els.omnibox) {
    engaged = null
    els.omnibox.value = nav.url && !nav.url.startsWith('ember://') ? nav.url : ''
    renderBang()
  }
}

window.ember.onState((state) => {
  browserState = state
  renderTabs(state.tabs)
  renderNav(state.nav)
})

window.ember.getChromeConfig().then(applyChromeConfig)
window.ember.onChromeConfig(applyChromeConfig)
window.ember.onWindowState(({ maximized } = {}) => els.shell.classList.toggle('maximized', !!maximized))

// ---------- quick searches ----------
function bangFor(value) {
  const resolved = window.ember.resolveInput(value)
  return resolved?.kind === 'bang' ? resolved : null
}

function readyToEngage(value) {
  const bang = bangFor(value)
  return bang && !bang.term ? bang : null
}

function renderBang() {
  const value = els.omnibox.value
  if (engaged) {
    els.chip.hidden = false
    els.chip.textContent = engaged.name
    els.chip.classList.add('engaged')
    els.chip.title = `Searching ${engaged.name}. Backspace to leave.`
    els.tip.hidden = true
    els.omnibox.placeholder = `Search ${engaged.name}`
    return
  }
  els.chip.classList.remove('engaged')
  els.omnibox.placeholder = DEFAULT_PLACEHOLDER
  const bang = bangFor(value)
  els.chip.hidden = !bang
  els.tip.hidden = !readyToEngage(value)
  if (bang) {
    els.chip.textContent = bang.name
    els.chip.title = bang.term ? `Search ${bang.name} for “${bang.term}”` : `Open ${bang.name}`
  }
}

function engage(bang) {
  engaged = { alias: bang.alias, name: bang.name }
  els.omnibox.value = ''
  renderBang()
}

function disengage({ restoreKeyword = false } = {}) {
  if (!engaged) return false
  const { alias } = engaged
  engaged = null
  if (restoreKeyword) els.omnibox.value = `${alias} ${els.omnibox.value}`.trimEnd()
  renderBang()
  if (restoreKeyword) {
    try { els.omnibox.setSelectionRange(els.omnibox.value.length, els.omnibox.value.length) } catch { /* unfocused */ }
  }
  return true
}

els.form.addEventListener('submit', (event) => {
  event.preventDefault()
  const typed = els.omnibox.value.trim()
  const value = engaged ? `${engaged.alias} ${typed}`.trim() : typed
  if (!value) return
  omniboxDirty = false
  disengage()
  window.ember.go(value)
  els.omnibox.blur()
})

els.omnibox.addEventListener('input', () => { omniboxDirty = true; renderBang() })
els.omnibox.addEventListener('focus', () => els.omnibox.select())
els.omnibox.addEventListener('blur', () => { omniboxDirty = false })
els.omnibox.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' && !e.shiftKey && !engaged) {
    const ready = readyToEngage(els.omnibox.value)
    if (ready) { e.preventDefault(); engage(ready) }
    return
  }
  if (e.key === 'Backspace' && engaged && !els.omnibox.value) {
    e.preventDefault()
    disengage({ restoreKeyword: true })
    return
  }
  if (e.key === 'Escape') {
    omniboxDirty = false
    if (disengage()) return
    els.omnibox.blur()
  }
})

window.ember.loadBangs().then(renderBang)
window.ember.onBangsChanged(renderBang)

els.back.onclick = () => window.ember.back()
els.forward.onclick = () => window.ember.forward()
els.reload.onclick = () => window.ember.reload()
els.archive.onclick = async () => {
  els.archive.classList.add('busy')
  const result = await window.ember.openArchived()
  els.archive.classList.remove('busy')
  els.archive.title = result?.ok ? 'View archived version' : 'The Internet Archive has no copy of this page'
}
$('new-tab').onclick = () => window.ember.newTab()
$('chrome-brand').onclick = () => window.ember.newTab()
els.sidebarToggle.onclick = () => setSidebarOpen(!chromeConfig.sidebarOpen, { persist: true })
$('win-min').onclick = () => window.ember.minimize()
$('win-max').onclick = () => window.ember.maximize()
$('win-close').onclick = () => window.ember.close()

// ---------- extensions ----------
const extensionButton = $('ext-btn')
extensionButton.onclick = () => window.ember.togglePanel()
window.ember.onPanelChanged((open) => {
  extensionButton.setAttribute('aria-expanded', String(open))
  extensionButton.classList.toggle('open', open)
})

// ---------- bookmarks ----------
function bookmarkLocation() {
  let items = bookmarkSnapshot.items || []
  const titles = []
  for (const index of bookmarkPath) {
    const folder = items[index]
    if (!folder || folder.type !== 'folder') {
      bookmarkPath = []
      return { items: bookmarkSnapshot.items || [], titles: [] }
    }
    titles.push(folder.title)
    items = folder.children || []
  }
  return { items, titles }
}

function bookmarkFavicon(item) {
  if (item.icon) return item.icon
  try { return new URL('/favicon.ico', item.url).href } catch { return '' }
}

function renderBookmarks(snapshot = bookmarkSnapshot) {
  bookmarkSnapshot = snapshot
  const bar = $('bookmarks-bar')
  bar.hidden = !snapshot.visible
  if (!snapshot.visible) return

  const { items, titles } = bookmarkLocation()
  $('bookmark-back').hidden = bookmarkPath.length === 0
  $('bookmark-path').hidden = bookmarkPath.length === 0
  $('bookmark-path').textContent = titles.join(' / ')
  $('bookmarks-items').replaceChildren(...items.map((item, index) => {
    const button = document.createElement('button')
    button.className = 'bookmark-item ' + (item.type === 'folder' ? 'bookmark-folder' : 'bookmark-link')
    button.title = item.type === 'folder' ? `Open ${item.title}` : item.url
    const label = document.createElement('span')
    label.textContent = item.title
    if (item.type === 'folder') {
      button.onclick = () => { bookmarkPath.push(index); renderBookmarks() }
    } else {
      const icon = bookmarkFavicon(item)
      if (icon) {
        const img = document.createElement('img')
        img.src = icon
        img.alt = ''
        img.onerror = () => img.remove()
        button.append(img)
      }
      button.onclick = () => window.ember.go(item.url)
    }
    button.append(label)
    return button
  }))
}

$('bookmark-back').onclick = () => { bookmarkPath.pop(); renderBookmarks() }
$('import-bookmarks').onclick = async () => {
  $('bookmark-status').textContent = ''
  const result = await window.ember.importBookmarks()
  if (result.ok) { bookmarkPath = []; renderBookmarks(result.snapshot) }
  else if (!result.canceled) $('bookmark-status').textContent = result.error || 'Import failed'
}
window.ember.onBookmarks(renderBookmarks)
window.ember.getBookmarks().then(renderBookmarks)

window.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'b') {
    event.preventDefault()
    window.ember.setBookmarksVisible(!bookmarkSnapshot.visible)
  }
})

const metricsObserver = new ResizeObserver(updateTabMetrics)
for (const target of [document.body, els.sidebarHeader, els.navigation, els.actions]) metricsObserver.observe(target)
window.addEventListener('resize', updateTabMetrics)
updateTabMetrics()
