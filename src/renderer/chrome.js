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

// ---------- extensions ----------
// The panel is a separate view owned by the main process (src/main/panel.js),
// so it covers only its own pixels instead of blacking out the page.
$('ext-btn').onclick = () => window.ember.togglePanel()
