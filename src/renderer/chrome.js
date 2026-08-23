const $ = (id) => document.getElementById(id)

const els = {
  tabs: $('tabs'),
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
let engaged = null // the quick search Tab committed the omnibox to, if any
let bookmarkSnapshot = { version: 1, visible: false, items: [] }
let bookmarkPath = []

window.EmberBrand.mountIcon($('chrome-brand'))

// ---------- render ----------
function renderTabs(tabs) {
  els.tabs.replaceChildren(...tabs.map((tab) => {
    const el = document.createElement('div')
    el.className = 'tab' + (tab.active ? ' active' : '') + (tab.asleep ? ' asleep' : '')
    // A sleeping tab holds no renderer; say so in the tooltip, not with a badge.
    el.title = tab.asleep ? `${tab.title || 'Tab'} — sleeping` : (tab.title || '')
    el.onmousedown = (e) => {
      if (e.button === 1) { e.preventDefault(); window.ember.closeTab(tab.id) }
      else if (e.button === 0) window.ember.selectTab(tab.id)
    }
    el.oncontextmenu = (e) => {
      e.preventDefault()
      window.ember.tabContextMenu(tab.id, e.clientX)
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
  // The archive action only appears for a page that failed or is gone.
  els.archive.hidden = !nav.archiveUrl
  if (!nav.archiveUrl) els.archive.classList.remove('busy')
  if (!omniboxDirty && document.activeElement !== els.omnibox) {
    engaged = null
    els.omnibox.value = nav.url && !nav.url.startsWith('ember://') ? nav.url : ''
    renderBang()
  }
}

window.ember.onState((state) => {
  renderTabs(state.tabs)
  renderNav(state.nav)
})

// ---------- quick searches ----------
// Typing `yt liquid glass` should say YouTube before you commit to it, and
// Tab should let you drop the keyword and keep only the query. Matching is a
// synchronous call into the preload, so it happens on the keystroke.
function bangFor(value) {
  const resolved = window.ember.resolveInput(value)
  return resolved?.kind === 'bang' ? resolved : null
}

/** True when the box holds a keyword and nothing else, so Tab has a job. */
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

/** Drop the keyword out of the box and keep the engine beside it instead. */
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
  // Paint before moving the caret: a selection API that objects must not be
  // able to leave the chip showing an engine the omnibox has already left.
  renderBang()
  if (restoreKeyword) {
    try {
      els.omnibox.setSelectionRange(els.omnibox.value.length, els.omnibox.value.length)
    } catch { /* not focused, or the box will not take a selection */ }
  }
  return true
}

// ---------- input ----------
els.form.addEventListener('submit', (e) => {
  e.preventDefault()
  const typed = els.omnibox.value.trim()
  // While engaged the box holds only the query, so put the keyword back for
  // the resolver — one code path decides what any input means.
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
  // Backspace out of an empty query steps back to the keyword you typed.
  if (e.key === 'Backspace' && engaged && !els.omnibox.value) {
    e.preventDefault()
    disengage({ restoreKeyword: true })
    return
  }
  if (e.key === 'Escape') {
    omniboxDirty = false
    if (disengage()) return // first Escape leaves the engine, second the box
    els.omnibox.blur()
  }
})

window.ember.loadBangs().then(renderBang)
window.ember.onBangsChanged(() => renderBang())

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

$('win-min').onclick = () => window.ember.minimize()
$('win-max').onclick = () => window.ember.maximize()
$('win-close').onclick = () => window.ember.close()

// Shortcuts live in the main process (src/main/shortcuts.js) so they work
// whether the chrome UI or a page has focus.

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
