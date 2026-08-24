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
const TAB_DRAG_TYPE = 'application/x-ember-tab'
let draggedTabId = null
let dragPreview = null

window.EmberBrand.mountChromeIcon($('chrome-brand'))

const NON_DRAG_SELECTOR = 'button, input, .tab, .omnibox, .bookmark-item'
let dragPointer = null
let dragArmed = false
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
  dragArmed = false
  event.preventDefault()
  // Capture is taken only once main has answered. Windows refuses to change a
  // window's show state while that window's thread holds the mouse, so taking
  // it first is what stopped a maximised window from ever coming loose.
  window.ember.beginWindowDrag(event.screenX, event.screenY).then(() => {
    if (dragPointer !== event.pointerId) return
    dragArmed = true
    try { els.topChrome.setPointerCapture(event.pointerId) } catch { /* already up */ }
    if (pendingDragPoint && !dragFrame) dragFrame = requestAnimationFrame(flushWindowDrag)
  }, () => { dragPointer = null })
})
els.topChrome.addEventListener('pointermove', (event) => {
  if (event.pointerId !== dragPointer) return
  pendingDragPoint = { x: event.screenX, y: event.screenY }
  if (dragArmed && !dragFrame) dragFrame = requestAnimationFrame(flushWindowDrag)
})
function finishWindowDrag(event) {
  if (event.pointerId !== dragPointer) return
  if (dragFrame) cancelAnimationFrame(dragFrame)
  dragFrame = 0
  pendingDragPoint = null
  dragPointer = null
  dragArmed = false
  window.ember.endWindowDrag()
}
els.topChrome.addEventListener('pointerup', finishWindowDrag)
els.topChrome.addEventListener('pointercancel', finishWindowDrag)
// Double-clicking the caption toggles maximised, the way every other window
// does. The empty stretches of the bar are the caption here.
els.topChrome.addEventListener('dblclick', (event) => {
  if (event.button !== 0 || event.target.closest(NON_DRAG_SELECTOR)) return
  window.ember.maximize()
})

function isNewTab(tab) {
  return String(tab?.url || '').startsWith('ember://newtab')
}

/**
 * A stroked path in a 16-unit box. Text glyphs sit on a baseline and never
 * land in the optical centre of a square button; a path does.
 */
function strokeGlyph(d) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('aria-hidden', 'true')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', d)
  svg.append(path)
  return svg
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

/**
 * `settled` runs once the widths this sets have actually been laid out.
 * Anything that measures the strip has to wait for that or it reads the
 * geometry from before the new tab widths applied.
 */
function updateTabMetrics(settled = null) {
  cancelAnimationFrame(metricFrame)
  metricFrame = requestAnimationFrame(() => {
    const fixed = els.sidebarHeader.offsetWidth + els.navigation.offsetWidth
      + els.actions.offsetWidth + els.caption.offsetWidth + 40
    const availableWidth = Math.max(0, innerWidth - fixed)
    const maximum = window.ember.tabMaximum({ availableWidth, count: browserState.tabs.length })
    els.tabs.style.setProperty('--tab-max-width', `${maximum}px`)
    els.tabstrip.style.setProperty('--tabstrip-max', `${Math.max(95, availableWidth - 96)}px`)
    requestAnimationFrame(() => {
      updateOverflow()
      // Also wired straight to resize and ResizeObserver, which hand it an
      // event rather than a callback.
      if (typeof settled === 'function') settled()
    })
  })
}

function tabNode(tab) {
  const displayTitle = isNewTab(tab) ? 'New Tab' : (tab.title || 'New Tab')
  const el = document.createElement('div')
  el.className = 'tab' + (tab.active ? ' active' : '') + (tab.asleep ? ' asleep' : '')
  el.dataset.tabId = String(tab.id)
  el.draggable = true
  el.title = tab.asleep ? `${displayTitle} — sleeping` : displayTitle
  el.onmousedown = (event) => {
    if (event.button === 1) { event.preventDefault(); window.ember.closeTab(tab.id) }
  }
  el.onclick = () => window.ember.selectTab(tab.id)
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
    // A favicon slot is square. The long meteor letterboxes down to a sliver
    // in one, so both the New Tab mark and the stand-in for a site whose own
    // icon did not load use the square crop.
    const fallback = window.EmberBrand.APP_ICON_ASSET
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
  close.draggable = false
  close.append(strokeGlyph('M5 5l6 6M11 5l-6 6'))
  close.title = 'Close tab'
  close.setAttribute('aria-label', `Close ${displayTitle}`)
  close.onmousedown = (event) => { event.stopPropagation(); event.preventDefault() }
  close.onclick = (event) => { event.stopPropagation(); window.ember.closeTab(tab.id) }
  el.append(close)

  el.addEventListener('pointerenter', () => requestAnimationFrame(updateOverflow))
  el.addEventListener('pointerleave', () => requestAnimationFrame(updateOverflow))
  el.addEventListener('dragstart', (event) => {
    if (event.target.closest?.('.tab-close')) { event.preventDefault(); return }
    draggedTabId = tab.id
    el.classList.add('dragging')
    event.dataTransfer.effectAllowed = 'copyMove'
    event.dataTransfer.setData(TAB_DRAG_TYPE, String(tab.id))
    dragPreview = el.cloneNode(true)
    dragPreview.classList.add('tab-drag-preview')
    dragPreview.classList.remove('dragging')
    document.body.append(dragPreview)
    event.dataTransfer.setDragImage(dragPreview, Math.min(event.offsetX, el.offsetWidth - 1), event.offsetY)
  })
  el.addEventListener('dragend', () => {
    draggedTabId = null
    dragPreview?.remove()
    dragPreview = null
    el.classList.remove('dragging')
    setTimeout(() => renderTabs(browserState.tabs), 0)
  })
  return el
}

// One duration and one curve for every movement in the strip: reordering,
// opening, closing and the shuffle each of those causes in its neighbours.
const TAB_MOTION_MS = 150
const TAB_MOTION_EASING = 'cubic-bezier(.2, .8, .2, 1)'
const TAB_FADE_WIDTH = 22
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
/** Movement is the point of these; with motion turned down they just end. */
const motionMs = () => (reducedMotion.matches ? 1 : TAB_MOTION_MS)

/** How far a tab travels through the bottom edge of the strip. */
function tabLift() {
  const height = parseFloat(getComputedStyle(els.shell).getPropertyValue('--tab-height'))
  return Number.isFinite(height) ? height : 28
}

function tabGap() {
  const gap = parseFloat(getComputedStyle(els.shell).getPropertyValue('--tab-gap'))
  return Number.isFinite(gap) ? gap : 8
}

function openTabNode(node) {
  node.animate([
    { transform: `translateY(${tabLift()}px)`, opacity: 0 },
    { transform: 'translateY(0)', opacity: 1 },
  ], { duration: motionMs(), easing: TAB_MOTION_EASING })
}

/**
 * Play a closed tab out of the strip. Collapsing its width rather than pulling
 * it straight from the DOM is what makes the tabs beside it slide at the same
 * speed they do when one is dragged past another.
 */
function closeTabNode(node) {
  node.classList.add('tab-closing')
  const width = node.getBoundingClientRect().width
  node.style.minWidth = '0px'
  const animation = node.animate([
    { maxWidth: `${width}px`, marginRight: '0px', opacity: 1, transform: 'translateY(0)' },
    { maxWidth: '0px', marginRight: `${-tabGap()}px`, opacity: 0, transform: `translateY(${tabLift()}px)` },
  ], { duration: motionMs(), easing: TAB_MOTION_EASING, fill: 'forwards' })
  const drop = () => node.remove()
  animation.finished.then(drop, drop)
}

/** Fade an edge only while there is something past it to scroll to. */
function updateTabScrollFades() {
  const strip = els.tabs
  const overflow = strip.scrollWidth - strip.clientWidth
  const left = overflow > 1 ? Math.min(TAB_FADE_WIDTH, strip.scrollLeft) : 0
  const right = overflow > 1 ? Math.min(TAB_FADE_WIDTH, overflow - strip.scrollLeft) : 0
  strip.style.setProperty('--tabs-fade-left', `${Math.max(0, left)}px`)
  strip.style.setProperty('--tabs-fade-right', `${Math.max(0, right)}px`)
}

/**
 * Bring a tab fully into the strip, clearing the edge fade so it is never half
 * dissolved. A new tab on a full bar pushes the left-hand ones behind rather
 * than opening out of sight.
 */
function keepTabVisible(node, { smooth = true } = {}) {
  if (!node) return
  const strip = els.tabs
  const overflow = strip.scrollWidth - strip.clientWidth
  if (overflow <= 1) return
  const left = node.offsetLeft
  const right = left + node.offsetWidth
  const viewLeft = strip.scrollLeft
  const viewRight = viewLeft + strip.clientWidth
  let target = null
  if (right + TAB_FADE_WIDTH > viewRight) target = right + TAB_FADE_WIDTH - strip.clientWidth
  else if (left - TAB_FADE_WIDTH < viewLeft) target = left - TAB_FADE_WIDTH
  if (target === null) return
  strip.scrollTo({
    left: Math.max(0, Math.min(overflow, target)),
    behavior: smooth ? 'smooth' : 'auto',
  })
}

function renderTabs(tabs) {
  const strip = els.tabs
  const settled = [...strip.children].filter((node) => !node.classList.contains('tab-closing'))
  const firstPaint = settled.length === 0
  const previousLeft = new Map(settled.map((node) => [node.dataset.tabId, node.getBoundingClientRect().left]))
  const wanted = new Set(tabs.map((tab) => String(tab.id)))
  const departing = settled.filter((node) => !wanted.has(node.dataset.tabId))

  const nodes = tabs.map(tabNode)
  const order = nodes.slice()
  // Put each closing tab back where it was so the collapse happens in place.
  for (const node of departing) {
    const index = Math.min(settled.indexOf(node), order.length)
    order.splice(index, 0, node)
  }
  strip.replaceChildren(...order)

  for (const node of departing) closeTabNode(node)
  for (const node of nodes) {
    const id = node.dataset.tabId
    if (!previousLeft.has(id)) {
      // A session being restored is not a sequence of tabs being opened.
      if (!firstPaint) openTabNode(node)
      continue
    }
    const delta = previousLeft.get(id) - node.getBoundingClientRect().left
    if (!delta) continue
    node.animate([
      { transform: `translateX(${delta}px)` },
      { transform: 'translateX(0)' },
    ], { duration: motionMs(), easing: TAB_MOTION_EASING })
  }

  const opened = nodes.find((node) => !previousLeft.has(node.dataset.tabId))
  const focus = opened || nodes.find((node) => node.classList.contains('active'))
  updateTabMetrics(() => {
    updateTabScrollFades()
    keepTabVisible(focus, { smooth: !firstPaint })
  })
}

// The wheel is the only way back to a tab that has scrolled behind the strip,
// so a vertical wheel over the bar moves it sideways.
els.tabstrip.addEventListener('wheel', (event) => {
  const strip = els.tabs
  if (strip.scrollWidth - strip.clientWidth <= 1) return
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
  if (!delta) return
  event.preventDefault()
  strip.scrollLeft += delta
  updateTabScrollFades()
}, { passive: false })
els.tabs.addEventListener('scroll', () => requestAnimationFrame(updateTabScrollFades))
window.addEventListener('resize', () => requestAnimationFrame(updateTabScrollFades))

function moveTabPreview(dragged, before) {
  if (before === dragged || dragged.nextElementSibling === before) return
  if (!before && dragged === els.tabs.lastElementChild) return
  const nodes = [...els.tabs.children]
  const oldLeft = new Map(nodes.map((node) => [node, node.getBoundingClientRect().left]))
  els.tabs.insertBefore(dragged, before)
  for (const node of nodes) {
    const delta = oldLeft.get(node) - node.getBoundingClientRect().left
    if (!delta) continue
    node.animate([
      { transform: `translateX(${delta}px)` },
      { transform: 'translateX(0)' },
    ], { duration: 150, easing: 'cubic-bezier(.2, .8, .2, 1)' })
  }
}

els.tabs.addEventListener('dragover', (event) => {
  if (draggedTabId === null || !event.dataTransfer.types.includes(TAB_DRAG_TYPE)) return
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  const dragged = els.tabs.querySelector(`.tab[data-tab-id="${draggedTabId}"]`)
  if (!dragged) return
  const before = [...els.tabs.querySelectorAll('.tab:not(.dragging)')].find((node) => {
    const rect = node.getBoundingClientRect()
    return event.clientX < rect.left + rect.width / 2
  }) || null
  moveTabPreview(dragged, before)
})

els.tabs.addEventListener('drop', (event) => {
  const id = Number(event.dataTransfer.getData(TAB_DRAG_TYPE))
  if (!Number.isFinite(id)) return
  event.preventDefault()
  const dragged = els.tabs.querySelector(`.tab[data-tab-id="${id}"]`)
  const beforeId = Number(dragged?.nextElementSibling?.dataset.tabId)
  window.ember.reorderTab(id, Number.isFinite(beforeId) ? beforeId : null)
})

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
window.ember.onWindowState(({ maximized } = {}) => {
  els.shell.classList.toggle('maximized', !!maximized)
  // The glyph changes to Windows' restore pair, so the label has to follow it.
  const button = $('win-max')
  const label = maximized ? 'Restore' : 'Maximize'
  button.title = label
  button.setAttribute('aria-label', label)
})

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
  // Space is the natural end of a keyword — you type `gh` and keep going — so
  // it commits to the quick search the same way Tab does, leaving the engine
  // named on the left and the query empty. Without it the keyword sat in the
  // box and became part of what you searched for.
  if ((e.key === 'Tab' || e.key === ' ') && !e.shiftKey && !engaged) {
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

// Main tells us which navigation command ran, so Alt+Left, Alt+Right and
// Ctrl+R animate the same button a click would have.
const NAV_BUTTONS = { back: els.back, forward: els.forward, reload: els.reload }
window.ember.onNavPulse((command) => {
  const button = NAV_BUTTONS[command]
  if (!button) return
  // Restarting mid-flight matters: holding Ctrl+R should keep spinning rather
  // than stall on the first animation's leftovers.
  button.classList.remove('pulsing')
  void button.offsetWidth
  button.classList.add('pulsing')
})
for (const button of Object.values(NAV_BUTTONS)) {
  button.addEventListener('animationend', () => button.classList.remove('pulsing'))
}
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
