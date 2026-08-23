const LINKS = [
  { name: 'YouTube', url: 'https://www.youtube.com', mark: 'Y' },
  { name: 'GitHub', url: 'https://github.com', mark: 'G' },
  { name: 'Reddit', url: 'https://www.reddit.com', mark: 'R' },
  { name: 'Gmail', url: 'https://mail.google.com', mark: 'M' },
  { name: 'Discord', url: 'https://discord.com/app', mark: 'D' },
  { name: 'Twitch', url: 'https://www.twitch.tv', mark: 'T' },
]

window.EmberBrand.mountBrand(document.getElementById('ember-brand'))

// window.ember is injected by the sandboxed page preload for ember:// pages only.
const nav = (url) => {
  if (window.ember?.navigate) window.ember.navigate(url)
  else location.href = url
}

const tiles = document.getElementById('tiles')
tiles.replaceChildren(...LINKS.map(({ name, url, mark }) => {
  const el = document.createElement('button')
  el.className = 'tile'
  el.type = 'button'
  el.title = url
  el.onclick = () => nav(url)

  const badge = document.createElement('span')
  badge.className = 'tile-mark'
  badge.textContent = mark

  const label = document.createElement('span')
  label.textContent = name

  el.append(badge, label)
  return el
}))

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

document.querySelector('[data-store]').onclick = () => {
  if (window.ember?.openStore) window.ember.openStore()
  else nav('https://chromewebstore.google.com/')
}
