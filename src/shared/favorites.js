const MAX_FAVORITES = 12

const DEFAULT_FAVORITES = Object.freeze([
  Object.freeze({
    id: 'google',
    name: 'Google',
    url: 'https://www.google.com/',
    icon: 'https://www.google.com/favicon.ico',
  }),
  Object.freeze({
    id: 'youtube',
    name: 'YouTube',
    url: 'https://www.youtube.com/',
    icon: 'https://www.youtube.com/favicon.ico',
  }),
  Object.freeze({
    id: 'google-calendar',
    name: 'Google Calendar',
    url: 'https://calendar.google.com/',
    icon: 'https://calendar.google.com/googlecalendar/images/favicons_2020q4/calendar_31.ico',
  }),
])

function webUrl(value) {
  try {
    const url = new URL(String(value || '').trim())
    return /^https?:$/.test(url.protocol) ? url : null
  } catch {
    return null
  }
}

function siteKey(value) {
  const url = webUrl(value)
  if (!url) return ''
  return url.hostname.toLowerCase().replace(/^www\./, '')
}

function safeId(value, url, index) {
  const supplied = String(value || '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (supplied) return supplied.slice(0, 48)
  return `${siteKey(url).replace(/[^a-z0-9]+/g, '-') || 'favorite'}-${index + 1}`.slice(0, 48)
}

function sanitiseIcon(value) {
  const url = webUrl(value)
  return url ? url.href : ''
}

function sanitiseFavorites(value) {
  const source = Array.isArray(value) ? value : DEFAULT_FAVORITES
  const sites = new Set()
  const ids = new Set()
  const result = []
  for (const entry of source) {
    if (!entry || result.length >= MAX_FAVORITES) break
    const url = webUrl(entry.url)
    const key = siteKey(entry.url)
    if (!url || !key || sites.has(key)) continue
    let id = safeId(entry.id, url, result.length)
    if (ids.has(id)) id = `${id}-${result.length + 1}`.slice(0, 48)
    const name = String(entry.name || '').trim().replace(/\s+/g, ' ').slice(0, 80)
      || url.hostname.replace(/^www\./, '')
    const icon = sanitiseIcon(entry.icon)
    result.push({ id, name, url: url.href, ...(icon ? { icon } : {}) })
    sites.add(key)
    ids.add(id)
  }
  return result
}

function sameFavoriteSite(favoriteUrl, tabUrl) {
  const favorite = siteKey(favoriteUrl)
  return !!favorite && favorite === siteKey(tabUrl)
}

function findFavoriteTab(tabs, favoriteUrl) {
  const match = (Array.isArray(tabs) ? tabs : []).find((tab) => sameFavoriteSite(favoriteUrl, tab?.url))
  return match?.id ?? null
}

/**
 * Turn a live tab into a persistent Favorite without trusting renderer data.
 * The exact page is kept for opening; site identity is only for de-duplication.
 */
function favoriteFromTab(tab, current = []) {
  const favorites = sanitiseFavorites(current)
  const url = webUrl(tab?.url)
  if (!url) return { status: 'invalid', favorite: null, favorites }
  const existing = favorites.find((entry) => sameFavoriteSite(entry.url, url.href))
  if (existing) return { status: 'existing', favorite: existing, favorites }
  if (favorites.length >= MAX_FAVORITES) return { status: 'full', favorite: null, favorites }

  const candidate = {
    id: siteKey(url.href).replace(/[^a-z0-9]+/g, '-') || `favorite-${favorites.length + 1}`,
    name: String(tab?.title || '').trim() || url.hostname.replace(/^www\./, ''),
    url: url.href,
    ...(sanitiseIcon(tab?.favicon) ? { icon: sanitiseIcon(tab.favicon) } : {}),
  }
  const next = sanitiseFavorites([...favorites, candidate])
  const favorite = next.find((entry) => sameFavoriteSite(entry.url, url.href)) || null
  if (!favorite || next.length === favorites.length) return { status: 'invalid', favorite: null, favorites }
  return { status: 'added', favorite, favorites: next }
}

module.exports = {
  DEFAULT_FAVORITES,
  MAX_FAVORITES,
  sanitiseFavorites,
  sameFavoriteSite,
  findFavoriteTab,
  favoriteFromTab,
}
