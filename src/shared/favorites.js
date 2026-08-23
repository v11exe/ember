const FAVORITE_GRID_DEFAULTS = Object.freeze({ columns: 2, rows: 2 })
const FAVORITE_GRID_LIMITS = Object.freeze({ columns: 4, rows: 7 })
const MAX_FAVORITES = FAVORITE_GRID_LIMITS.columns * FAVORITE_GRID_LIMITS.rows

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

function clampInteger(value, fallback, minimum, maximum) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(maximum, Math.max(minimum, Math.round(number)))
}

function sanitiseFavoriteGrid(value) {
  return {
    columns: clampInteger(value?.columns, FAVORITE_GRID_DEFAULTS.columns, 1, FAVORITE_GRID_LIMITS.columns),
    rows: clampInteger(value?.rows, FAVORITE_GRID_DEFAULTS.rows, 1, FAVORITE_GRID_LIMITS.rows),
  }
}

function favoriteCapacity(value) {
  const grid = sanitiseFavoriteGrid(value)
  return grid.columns * grid.rows
}

function sanitiseFavorites(value, limit = MAX_FAVORITES) {
  const source = Array.isArray(value) ? value : DEFAULT_FAVORITES
  const maximum = clampInteger(limit, MAX_FAVORITES, 0, MAX_FAVORITES)
  const sites = new Set()
  const ids = new Set()
  const result = []
  for (const entry of source) {
    if (!entry || result.length >= maximum) break
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

function placementIndex(index, maximum, fallback) {
  if (index === null || index === undefined || !Number.isFinite(Number(index))) return fallback
  return Math.min(maximum, Math.max(0, Math.round(Number(index))))
}

/** Ordered insert/reorder/replace used by both live tab drops and Favorite drags. */
function placeFavorite(candidate, current = [], gridValue, index = null) {
  const capacity = favoriteCapacity(gridValue)
  const favorites = sanitiseFavorites(current, capacity)
  const incoming = sanitiseFavorites([candidate], 1)[0]
  if (!incoming) return { status: 'invalid', favorite: null, favorites }

  const existingIndex = favorites.findIndex((entry) => sameFavoriteSite(entry.url, incoming.url))
  if (existingIndex >= 0) {
    const favorite = favorites[existingIndex]
    if (index === null || index === undefined) return { status: 'existing', favorite, favorites }
    const next = [...favorites]
    next.splice(existingIndex, 1)
    next.splice(placementIndex(index, next.length, next.length), 0, favorite)
    const changed = next.some((entry, entryIndex) => entry.id !== favorites[entryIndex]?.id)
    return { status: changed ? 'moved' : 'existing', favorite, favorites: next }
  }

  if (favorites.length < capacity) {
    const next = [...favorites]
    next.splice(placementIndex(index, next.length, next.length), 0, incoming)
    return { status: 'added', favorite: incoming, favorites: next }
  }
  if (index === null || index === undefined) return { status: 'full', favorite: null, favorites }
  const next = [...favorites]
  next[placementIndex(index, capacity - 1, capacity - 1)] = incoming
  return { status: 'replaced', favorite: incoming, favorites: next }
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
function favoriteFromTab(tab, current = [], gridValue = FAVORITE_GRID_DEFAULTS, index = null) {
  const favorites = sanitiseFavorites(current, favoriteCapacity(gridValue))
  const url = webUrl(tab?.url)
  if (!url) return { status: 'invalid', favorite: null, favorites }

  const candidate = {
    id: siteKey(url.href).replace(/[^a-z0-9]+/g, '-') || `favorite-${favorites.length + 1}`,
    name: String(tab?.title || '').trim() || url.hostname.replace(/^www\./, ''),
    url: url.href,
    ...(sanitiseIcon(tab?.favicon) ? { icon: sanitiseIcon(tab.favicon) } : {}),
  }
  return placeFavorite(candidate, favorites, gridValue, index)
}

module.exports = {
  DEFAULT_FAVORITES,
  FAVORITE_GRID_DEFAULTS,
  FAVORITE_GRID_LIMITS,
  MAX_FAVORITES,
  sanitiseFavoriteGrid,
  favoriteCapacity,
  sanitiseFavorites,
  placeFavorite,
  sameFavoriteSite,
  findFavoriteTab,
  favoriteFromTab,
}
