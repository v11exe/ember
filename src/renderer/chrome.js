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
    } else if (tab.favicon) {
      const img = document.createElement('img')
      img.className = 'tab-favicon'
      img.src = tab.favicon
      img.onerror = () => img.remove()
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

// ---------- extensions panel ----------
const extBtn = $('ext-btn')
const panel = $('ext-panel')
const backdrop = $('backdrop')
const extList = $('ext-list')
const panelActions = $('panel-actions')

let panelOpen = false

function renderExtensions(list) {
  // <browser-action-list> only has something to show once an extension is installed
  panelActions.classList.toggle('hidden', list.length === 0)

  if (!list.length) {
    const empty = document.createElement('div')
    empty.className = 'ext-empty'
    const title = document.createElement('strong')
    title.textContent = 'No extensions yet'
    empty.append(title, document.createTextNode(
      'Open the Chrome Web Store and pick one — the install button reads “Add to Ember”.'
    ))
    extList.replaceChildren(empty)
    return
  }

  extList.replaceChildren(...list.map((ext) => {
    const row = document.createElement('div')
    row.className = 'ext-row'
    row.title = ext.description || ext.name

    if (ext.icon) {
      const img = document.createElement('img')
      img.className = 'ext-icon'
      img.src = ext.icon
      row.append(img)
    } else {
      const fallback = document.createElement('div')
      fallback.className = 'ext-icon ext-icon-fallback'
      fallback.textContent = (ext.name || '?').charAt(0).toUpperCase()
      row.append(fallback)
    }

    const meta = document.createElement('div')
    meta.className = 'ext-meta'
    const name = document.createElement('div')
    name.className = 'ext-name'
    name.textContent = ext.name
    const version = document.createElement('div')
    version.className = 'ext-version'
    version.textContent = 'v' + ext.version
    meta.append(name, version)

    const remove = document.createElement('button')
    remove.className = 'ext-remove'
    remove.textContent = 'Remove'
    remove.onclick = async () => {
      remove.disabled = true
      remove.textContent = '…'
      const { extensions } = await window.ember.removeExtension(ext.id)
      renderExtensions(extensions)
    }

    row.append(meta, remove)
    return row
  }))
}

async function setPanel(open) {
  panelOpen = open
  panel.hidden = !open
  backdrop.hidden = !open
  extBtn.classList.toggle('open', open)
  extBtn.setAttribute('aria-expanded', String(open))
  panelWidth = window.innerWidth
  window.ember.setOverlay(open) // grow/shrink the chrome view so the panel isn't clipped
  if (open) renderExtensions(await window.ember.listExtensions())
}

extBtn.onclick = () => setPanel(!panelOpen)
backdrop.onclick = () => setPanel(false)
$('panel-store').onclick = () => { setPanel(false); window.ember.openStore() }

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && panelOpen) setPanel(false)
})
// Opening the panel grows this view, which fires resize too — only close on a
// real window resize, detected by the width changing.
let panelWidth = 0
window.addEventListener('resize', () => {
  if (panelOpen && window.innerWidth !== panelWidth) setPanel(false)
})
