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
/** The quick search this field has committed to, if any. */
let engaged = null

/**
 * Finishing the keyword with a space commits to the quick search: the engine
 * moves to the chip on the left and the box is emptied for the query, so the
 * keyword is never part of what gets searched for. Backspace on an empty box
 * steps back out again. The toolbar omnibox does exactly this; the difference
 * here is that the page is sandboxed and has to ask main what text means.
 */
function bindQuickSearchChip(input) {
  const chip = document.getElementById('q-chip')
  if (!chip || !window.ember?.omnibox) return
  let latest = 0

  const resolve = async (value) => {
    try {
      return await window.ember.omnibox.resolve(value)
    } catch {
      return null
    }
  }

  function renderEngaged() {
    chip.hidden = false
    chip.textContent = engaged.name
    chip.dataset.engaged = 'true'
    chip.title = `Searching ${engaged.name}. Backspace to leave.`
    input.placeholder = `Search ${engaged.name}`
  }

  function engage(bang) {
    engaged = { alias: bang.alias, name: bang.name }
    input.value = ''
    renderEngaged()
  }

  function disengage({ restoreKeyword = false } = {}) {
    if (!engaged) return false
    const { alias } = engaged
    engaged = null
    delete chip.dataset.engaged
    chip.hidden = true
    input.placeholder = DEFAULT_SEARCH_PLACEHOLDER
    if (restoreKeyword) {
      input.value = `${alias} ${input.value}`.trimEnd()
      try { input.setSelectionRange(input.value.length, input.value.length) } catch { /* unfocused */ }
    }
    return true
  }

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Backspace' && engaged && !input.value) {
      event.preventDefault()
      disengage({ restoreKeyword: true })
      return
    }
    if (event.key === 'Escape' && engaged) {
      event.preventDefault()
      disengage()
    }
  })

  input.addEventListener('input', async () => {
    const asked = ++latest
    const raw = input.value
    if (engaged) return
    const trimmed = raw.trimEnd()
    // The space that ended the keyword is the commit. resolveInput() trims, so
    // the trailing space has to be noticed here rather than asked about.
    if (trimmed && trimmed !== raw) {
      const ready = await resolve(trimmed)
      if (asked !== latest) return
      if (ready?.kind === 'bang' && !ready.term) { engage(ready); return }
    }
    if (!trimmed) { chip.hidden = true; return }
    const resolved = await resolve(raw)
    // A slower answer for older text must not overwrite a newer one.
    if (asked !== latest || engaged) return
    const bang = resolved?.kind === 'bang' ? resolved : null
    chip.hidden = !bang
    if (bang) {
      chip.textContent = bang.name
      chip.title = bang.term ? `Search ${bang.name} for “${bang.term}”` : `Open ${bang.name}`
    }
  })

  return { get engaged() { return engaged }, disengage }
}

let DEFAULT_SEARCH_PLACEHOLDER = 'Search Google or type a URL'

function bindSearch() {
  const form = document.getElementById('search-form')
  if (!form || form.dataset.bound) return
  form.dataset.bound = 'true'
  const input = document.getElementById('q')
  DEFAULT_SEARCH_PLACEHOLDER = input.placeholder || DEFAULT_SEARCH_PLACEHOLDER
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const typed = input.value.trim()
    // Committed to a quick search, the keyword goes back on the front so there
    // is still only one thing that decides what typed text means.
    const q = engaged ? `${engaged.alias} ${typed}`.trim() : typed
    if (q) nav(q) // main resolves URL-vs-search via shared/urls.js
  })
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
