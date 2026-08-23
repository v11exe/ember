const test = require('node:test')
const assert = require('node:assert/strict')

const {
  DEFAULT_FAVORITES,
  MAX_FAVORITES,
  sanitiseFavorites,
  sameFavoriteSite,
  findFavoriteTab,
  favoriteFromTab,
} = require('../src/shared/favorites')

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
    ...Array.from({ length: 20 }, (_, index) => ({ name: `Site ${index}`, url: `https://site-${index}.test/` })),
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
