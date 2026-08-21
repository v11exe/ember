const LINKS = [
  { name: 'YouTube', url: 'https://www.youtube.com', mark: 'Y' },
  { name: 'GitHub', url: 'https://github.com', mark: 'G' },
  { name: 'Reddit', url: 'https://www.reddit.com', mark: 'R' },
  { name: 'Gmail', url: 'https://mail.google.com', mark: 'M' },
  { name: 'Discord', url: 'https://discord.com/app', mark: 'D' },
  { name: 'Twitch', url: 'https://www.twitch.tv', mark: 'T' },
]

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

document.getElementById('search-form').addEventListener('submit', (e) => {
  e.preventDefault()
  const q = document.getElementById('q').value.trim()
  if (q) nav(q) // main resolves URL-vs-search via shared/urls.js
})

document.querySelector('[data-store]').onclick = () => {
  if (window.ember?.openStore) window.ember.openStore()
  else nav('https://chromewebstore.google.com/')
}

document.getElementById('q').focus()
