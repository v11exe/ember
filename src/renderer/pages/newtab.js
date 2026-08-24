window.EmberBrand.mountBrand(document.getElementById('ember-brand'))

// window.ember is injected by the sandboxed page preload for ember:// pages only.
const nav = (url) => {
  if (window.ember?.navigate) window.ember.navigate(url)
  else location.href = url
}

/**
 * Name the quick search a typed keyword resolves to, the way the toolbar
 * omnibox does. This page is sandboxed and cannot load the resolver, so it
 * asks the main process — the same function that does the navigating, so the
 * label can never promise something Enter will not do.
 */
function bindQuickSearchChip(input) {
  const chip = document.getElementById('q-chip')
  if (!chip || !window.ember?.omnibox) return
  let latest = 0

  input.addEventListener('input', async () => {
    const asked = ++latest
    const value = input.value
    if (!value.trim()) { chip.hidden = true; return }
    let resolved = null
    try {
      resolved = await window.ember.omnibox.resolve(value)
    } catch { /* the answer is simply unavailable */ }
    // A slower answer for older text must not overwrite a newer one.
    if (asked !== latest) return
    const bang = resolved?.kind === 'bang' ? resolved : null
    chip.hidden = !bang
    if (bang) {
      chip.textContent = bang.name
      chip.title = bang.term ? `Search ${bang.name} for “${bang.term}”` : `Open ${bang.name}`
    }
  })
}

function bindSearch() {
  const form = document.getElementById('search-form')
  if (!form || form.dataset.bound) return
  form.dataset.bound = 'true'
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const q = document.getElementById('q').value.trim()
    if (q) nav(q) // main resolves URL-vs-search via shared/urls.js
  })
  const input = document.getElementById('q')
  bindQuickSearchChip(input)
  input.focus()
}
document.addEventListener('native-liquid-glass-ready', bindSearch)
bindSearch()


// B18: the page is one search box, so a bare keystroke anywhere on it belongs
// in that box. Modified chords are shortcuts and are left alone, as is
// anything typed while a field already has focus.
document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (event.key.length !== 1) return
  const input = document.getElementById('q')
  if (!input || document.activeElement === input) return
  const active = document.activeElement
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return
  input.focus()
})
