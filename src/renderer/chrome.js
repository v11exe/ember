const $ = (id) => document.getElementById(id)

const els = {
  tabs: $('tabs'),
  omnibox: $('omnibox'),
  form: $('omnibox-form'),
  back: $('back'),
  forward: $('forward'),
  reload: $('reload'),
}

let omniboxDirty = false
let bookmarkSnapshot = { version: 1, visible: false, items: [] }
let bookmarkPath = []

window.EmberBrand.mountIcon($('chrome-brand'))

// ---------- render ----------
function renderTabs(tabs) {
  els.tabs.replaceChildren(...tabs.map((tab) => {
    const el = document.createElement('div')
    el.className = 'tab' + (tab.active ? ' active' : '')
    el.title = tab.title || ''
    el.onmousedown = (e) => {
      if (e.button === 1) { e.preventDefault(); window.ember.closeTab(tab.id) }
      else if (e.button === 0) window.ember.selectTab(tab.id)
    }

    if (tab.loading) {
      const s = document.createElement('div')
      s.className = 'spinner'
      el.append(s)
    } else {
      const img = document.createElement('img')
      img.className = 'tab-favicon'
      img.src = tab.favicon || window.EmberBrand.ICON_ASSET
      img.onerror = () => {
        if (tab.favicon && img.src !== window.EmberBrand.ICON_ASSET) img.src = window.EmberBrand.ICON_ASSET
        else img.remove()
      }
      el.append(img)
    }

    const title = document.createElement('span')
    title.className = 'tab-title'
    title.textContent = tab.title || 'New tab'
    el.append(title)

    const close = document.createElement('button')
    close.className = 'tab-close'
    close.textContent = '×'
    close.title = 'Close tab'
    close.onmousedown = (e) => { e.stopPropagation(); e.preventDefault() }
    close.onclick = (e) => { e.stopPropagation(); window.ember.closeTab(tab.id) }
    el.append(close)

    return el
  }))
}

function renderNav(nav) {
  els.back.disabled = !nav.canGoBack
  els.forward.disabled = !nav.canGoForward
  if (!omniboxDirty && document.activeElement !== els.omnibox) {
    els.omnibox.value = nav.url && !nav.url.startsWith('ember://') ? nav.url : ''
  }
}

window.ember.onState((state) => {
  renderTabs(state.tabs)
  renderNav(state.nav)
})

// ---------- input ----------
els.form.addEventListener('submit', (e) => {
  e.preventDefault()
  const value = els.omnibox.value.trim()
  if (!value) return
  omniboxDirty = false
  window.ember.go(value)
  els.omnibox.blur()
})

els.omnibox.addEventListener('input', () => { omniboxDirty = true })
els.omnibox.addEventListener('focus', () => els.omnibox.select())
els.omnibox.addEventListener('blur', () => { omniboxDirty = false })
els.omnibox.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { omniboxDirty = false; els.omnibox.blur() }
})

els.back.onclick = () => window.ember.back()
els.forward.onclick = () => window.ember.forward()
els.reload.onclick = () => window.ember.reload()
$('new-tab').onclick = () => window.ember.newTab()

$('win-min').onclick = () => window.ember.minimize()
$('win-max').onclick = () => window.ember.maximize()
$('win-close').onclick = () => window.ember.close()

// ---------- shortcuts ----------
window.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey
  if (!mod) return
  if (e.key === 't') { e.preventDefault(); window.ember.newTab() }
  else if (e.key === 'l') { e.preventDefault(); els.omnibox.focus() }
  else if (e.key === 'r') { e.preventDefault(); window.ember.reload() }
})

// ---------- extensions ----------
// The panel is a separate view owned by the main process (src/main/panel.js),
// so it covers only its own pixels instead of blacking out the page.
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

function faviconFor(item) {
  if (item.icon) return item.icon
  try { return new URL('/favicon.ico', item.url).href } catch { return '' }
}

function renderBookmarks(snapshot = bookmarkSnapshot) {
  bookmarkSnapshot = snapshot
  const bar = $('bookmarks-bar')
  bar.hidden = !snapshot.visible
  $('bookmarks-toggle').setAttribute('aria-pressed', String(!!snapshot.visible))
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
      const icon = faviconFor(item)
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
$('bookmarks-toggle').onclick = () => window.ember.setBookmarksVisible(!bookmarkSnapshot.visible)
$('import-bookmarks').onclick = async () => {
  $('bookmark-status').textContent = ''
  const result = await window.ember.importBookmarks()
  if (result.ok) { bookmarkPath = []; renderBookmarks(result.snapshot) }
  else if (!result.canceled) $('bookmark-status').textContent = result.error || 'Import failed'
}
window.ember.onBookmarks((snapshot) => renderBookmarks(snapshot))
window.ember.getBookmarks().then((snapshot) => renderBookmarks(snapshot))

window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'b') {
    e.preventDefault()
    window.ember.setBookmarksVisible(!bookmarkSnapshot.visible)
  }
})
