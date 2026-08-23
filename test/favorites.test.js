const test = require('node:test')
const assert = require('node:assert/strict')

const {
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
} = require('../src/shared/favorites')

test('Favorite grid defaults and clamps without ever exceeding icon-safe density', () => {
  assert.deepEqual(FAVORITE_GRID_DEFAULTS, { columns: 2, rows: 2 })
  assert.deepEqual(FAVORITE_GRID_LIMITS, { columns: 4, rows: 7 })
  assert.deepEqual(sanitiseFavoriteGrid(), { columns: 2, rows: 2 })
  assert.deepEqual(sanitiseFavoriteGrid({ columns: 0, rows: 99 }), { columns: 1, rows: 7 })
  assert.deepEqual(sanitiseFavoriteGrid({ columns: 3.7, rows: 5.2 }), { columns: 4, rows: 5 })
  assert.equal(favoriteCapacity({ columns: 4, rows: 7 }), 28)
})

test('the target three Favorite sites are the persisted defaults', () => {
  assert.deepEqual(DEFAULT_FAVORITES.map(({ name, url }) => ({ name, url })), [
    { name: 'Google', url: 'https://www.google.com/' },
    { name: 'YouTube', url: 'https://www.youtube.com/' },
    { name: 'Google Calendar', url: 'https://calendar.google.com/' },
  ])
  assert.deepEqual(sanitiseFavorites(undefined), DEFAULT_FAVORITES)
  assert.notEqual(sanitiseFavorites(undefined), DEFAULT_FAVORITES, 'callers receive a mutable copy')
  assert.match(DEFAULT_FAVORITES[2].icon, /googlecalendar\/images\/favicons/)
})

test('stored Favorites are validated, de-duplicated by site, and capped', () => {
  const entries = [
    { id: ' One ', name: '  Example  ', url: 'https://www.example.com/path', icon: 'https://cdn.example/icon.png' },
    { id: 'duplicate', name: 'Duplicate', url: 'http://example.com/elsewhere' },
    { id: 'bad', name: 'Bad', url: 'javascript:alert(1)' },
    ...Array.from({ length: 40 }, (_, index) => ({ name: `Site ${index}`, url: `https://site-${index}.test/` })),
  ]
  const result = sanitiseFavorites(entries)
  assert.equal(result.length, MAX_FAVORITES)
  assert.deepEqual(result[0], {
    id: 'one', name: 'Example', url: 'https://www.example.com/path', icon: 'https://cdn.example/icon.png',
  })
  assert.equal(result.filter((entry) => entry.url.includes('example.com')).length, 1)
  assert.equal(result.some((entry) => entry.url.startsWith('javascript:')), false)
})

test('an empty list intentionally leaves the Favorite rail empty', () => {
  assert.deepEqual(sanitiseFavorites([]), [])
})

test('Favorite activity follows the selected site rather than an exact page', () => {
  assert.equal(sameFavoriteSite('https://www.youtube.com/', 'https://youtube.com/watch?v=abc'), true)
  assert.equal(sameFavoriteSite('http://youtube.com/', 'https://www.youtube.com/shorts/abc'), true)
  assert.equal(sameFavoriteSite('https://calendar.google.com/', 'https://www.google.com/search?q=calendar'), false)
  assert.equal(sameFavoriteSite('nonsense', 'https://example.com/'), false)
})

test('opening a Favorite reuses even a sleeping matching tab', () => {
  const tabs = [
    { id: 2, url: 'https://github.com/openai', asleep: false },
    { id: 4, url: 'https://youtube.com/watch?v=x', asleep: true },
  ]
  assert.equal(findFavoriteTab(tabs, 'https://www.youtube.com/'), 4)
  assert.equal(findFavoriteTab(tabs, 'https://calendar.google.com/'), null)
})

test('a dropped tab keeps its exact URL, title, and favicon', () => {
  const tab = {
    id: 8,
    title: 'Codex issue',
    url: 'https://github.com/openai/codex/issues/1',
    favicon: 'https://github.com/favicon.ico',
  }

  assert.deepEqual(favoriteFromTab(tab, []), {
    status: 'added',
    favorite: {
      id: 'github-com',
      name: 'Codex issue',
      url: tab.url,
      icon: tab.favicon,
    },
    favorites: [{
      id: 'github-com',
      name: 'Codex issue',
      url: tab.url,
      icon: tab.favicon,
    }],
  })
})

test('a dropped tab deduplicates by site and rejects invalid or full lists', () => {
  const tab = { title: 'Watch', url: 'https://www.youtube.com/watch?v=abc' }
  const existing = [{ id: 'youtube', name: 'YouTube', url: 'https://youtube.com/' }]
  assert.deepEqual(favoriteFromTab(tab, existing), {
    status: 'existing', favorite: existing[0], favorites: existing,
  })

  assert.equal(favoriteFromTab({ url: 'ember://settings' }, []).status, 'invalid')
  const full = Array.from({ length: MAX_FAVORITES }, (_, index) => ({
    id: `site-${index}`, name: `Site ${index}`, url: `https://site-${index}.test/`,
  }))
  assert.equal(favoriteFromTab({ url: 'https://another.test/' }, full).status, 'full')
})

test('placement inserts at a configured cell and clamps empty cells to the list end', () => {
  const current = [
    { id: 'a', name: 'A', url: 'https://a.test/' },
    { id: 'b', name: 'B', url: 'https://b.test/' },
    { id: 'c', name: 'C', url: 'https://c.test/' },
  ]
  const incoming = { id: 'x', name: 'X', url: 'https://x.test/path' }
  assert.deepEqual(placeFavorite(incoming, current, { columns: 2, rows: 2 }, 1), {
    status: 'added', favorite: incoming, favorites: [current[0], incoming, current[1], current[2]],
  })
  assert.deepEqual(
    placeFavorite(incoming, current.slice(0, 2), { columns: 2, rows: 2 }, 3).favorites,
    [current[0], current[1], incoming],
  )
})

test('placement replaces the hovered cell only when a new site fills the grid', () => {
  const full = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id.toUpperCase(), url: `https://${id}.test/` }))
  const incoming = { id: 'x', name: 'X', url: 'https://x.test/' }
  assert.deepEqual(placeFavorite(incoming, full, { columns: 2, rows: 2 }, 1), {
    status: 'replaced', favorite: incoming, favorites: [full[0], incoming, full[2], full[3]],
  })
  assert.equal(placeFavorite(incoming, full, { columns: 2, rows: 2 }).status, 'full')
})

test('placing an existing site reorders it without replacing another Favorite', () => {
  const current = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id.toUpperCase(), url: `https://${id}.test/` }))
  assert.deepEqual(placeFavorite(current[0], current, { columns: 2, rows: 2 }, 2), {
    status: 'moved', favorite: current[0], favorites: [current[1], current[2], current[0], current[3]],
  })
  assert.equal(placeFavorite(current[1], current, { columns: 2, rows: 2 }, -20).favorites[0].id, 'b')
})

test('a dropped matching tab moves its existing quick site to the requested cell', () => {
  const current = [
    { id: 'youtube', name: 'YouTube', url: 'https://youtube.com/' },
    { id: 'a', name: 'A', url: 'https://a.test/' },
    { id: 'b', name: 'B', url: 'https://b.test/' },
  ]
  const result = favoriteFromTab(
    { title: 'Watch', url: 'https://www.youtube.com/watch?v=abc' },
    current,
    { columns: 2, rows: 2 },
    2,
  )
  assert.equal(result.status, 'moved')
  assert.deepEqual(result.favorites.map(({ id }) => id), ['a', 'b', 'youtube'])
})
