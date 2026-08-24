# Favorite Target Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow duplicate Quick Sites and make origin-only and origin/path Quick Sites select and highlight the intended tabs.

**Architecture:** Keep URL normalization and matching in `src/shared/favorites.js`, which already supplies persistence, placement, selection and renderer highlight semantics. A root path is a broad host target (including child subdomains); any other path is page-specific and ignores search/hash. The sidebar always previews a tab drag as a new tile, while existing Favorite drags retain their ID and reorder.

**Tech Stack:** CommonJS, Node URL, `node:test`, Electron.

---

### Task 1: Target semantics

**Files:**

- Modify: `test/favorites.test.js`
- Modify: `src/shared/favorites.js`

- [x] **Step 1: Write the failing tests**

```js
test('Quick Sites retain duplicate and same-origin targets', () => {
  const entries = [
    { id: 'wiki', name: 'Wikipedia', url: 'https://en.wikipedia.org/' },
    { id: 'ember', name: 'Ember', url: 'https://en.wikipedia.org/wiki/Ember' },
    { id: 'ember-copy', name: 'Ember again', url: 'https://en.wikipedia.org/wiki/Ember' },
  ]
  assert.deepEqual(sanitiseFavorites(entries).map((entry) => entry.id), ['wiki', 'ember', 'ember-copy'])
})

test('origin targets are broad and page targets ignore query and fragment only', () => {
  assert.equal(sameFavoriteSite('https://en.wikipedia.org/', 'https://en.wikipedia.org/wiki/Ember'), true)
  assert.equal(sameFavoriteSite('https://en.wikipedia.org/wiki/Ember', 'https://en.wikipedia.org/wiki/Ember?oldformat=true#History'), true)
  assert.equal(sameFavoriteSite('https://en.wikipedia.org/wiki/Ember', 'https://en.wikipedia.org/wiki/JavaScript'), false)
})

test('opening broad targets prefers an open root tab and pages never fall back to root', () => {
  const tabs = [{ id: 1, url: 'https://en.wikipedia.org/wiki/Ember' }, { id: 2, url: 'https://en.wikipedia.org/' }]
  assert.equal(findFavoriteTab(tabs, 'https://en.wikipedia.org/'), 2)
  assert.equal(findFavoriteTab(tabs, 'https://en.wikipedia.org/wiki/Ember'), 1)
  assert.equal(findFavoriteTab([{ id: 2, url: 'https://en.wikipedia.org/' }], 'https://en.wikipedia.org/wiki/Ember'), null)
})
```

- [x] **Step 2: Run the focused test**

Run: `node --test test/favorites.test.js`

Expected: FAIL because same-origin entries are removed and host-only matching chooses the wrong tab.

- [x] **Step 3: Implement the minimal shared matcher**

```js
function favoriteTarget(value) {
  const url = webUrl(value)
  if (!url) return null
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const origin = `${url.protocol}//${host}${url.port ? `:${url.port}` : ''}`
  return { origin, path: url.pathname || '/', broad: (url.pathname || '/') === '/' }
}

function sameFavoriteSite(favoriteUrl, tabUrl) {
  const favorite = favoriteTarget(favoriteUrl)
  const tab = favoriteTarget(tabUrl)
  return !!favorite && !!tab && favorite.origin === tab.origin && (favorite.broad || favorite.path === tab.path)
}
```

Remove origin deduplication from `sanitiseFavorites()`. In `findFavoriteTab()`, filter with `sameFavoriteSite()` and choose a root-path tab first only when the favorite is broad. Remove the existing-target branch in `placeFavorite()` so it always inserts a valid candidate.

- [x] **Step 4: Verify green**

Run: `node --test test/favorites.test.js`

Expected: PASS.

### Task 2: Duplicate creation and caller regressions

**Files:**

- Modify: `test/favorites.test.js`
- Modify: `test/renderer-contracts.test.js`
- Modify: `src/shared/favorites.js`

- [x] **Step 1: Write the failing duplicate-insertion test**

```js
test('dropping a matching page creates another Quick Site with its own id', () => {
  const existing = [{ id: 'ember', name: 'Ember', url: 'https://en.wikipedia.org/wiki/Ember' }]
  const result = favoriteFromTab({ title: 'Ember', url: 'https://en.wikipedia.org/wiki/Ember#History' }, existing)
  assert.equal(result.status, 'added')
  assert.equal(result.favorites.length, 2)
  assert.notEqual(result.favorites[0].id, result.favorites[1].id)
})
```

- [x] **Step 2: Run the focused tests**

Run: `node --test test/favorites.test.js test/renderer-contracts.test.js`

Expected: FAIL because `favoriteFromTab()` currently returns an existing same-origin entry.

- [x] **Step 3: Generate unique duplicate IDs and retain caller contracts**

```js
const candidate = {
  id: `${siteKey(url.href).replace(/[^a-z0-9]+/g, '-') || 'favorite'}-${favorites.length + 1}`,
  name: String(tab?.title || '').trim() || url.hostname.replace(/^www\./, ''),
  url: url.href,
  ...(sanitiseIcon(tab?.favicon) ? { icon: sanitiseIcon(tab.favicon) } : {}),
}
```

Do not change `src/main/index.js`: its existing call to `findFavoriteTab()` receives the new semantics. Change `src/renderer/sidebar.js` so a tab drag always returns the `drop-preview` candidate rather than an existing same-site Favorite. Existing Favorite drags still reorder by the selected tile ID.

- [x] **Step 4: Verify green**

Run: `node --test test/favorites.test.js test/renderer-contracts.test.js`

Expected: PASS.

### Task 3: Full verification and documentation

**Files:**

- Modify: `AGENTS.md`
- Modify: `docs/superpowers/plans/2026-08-24-favorite-target-matching.md`

- [x] **Step 1: Run affected regressions**

Run: `node --test test/favorites.test.js test/settings.test.js test/preload.test.js test/renderer-contracts.test.js`

Expected: PASS.

- [x] **Step 2: Run project gates**

Run: `npm test && npm run smoke`

Expected: both commands exit 0.

- [x] **Step 3: Record the contract and commit**

Add this invariant to `AGENTS.md`: origin-root Favorites highlight/reuse any same-origin tab while preferring a root tab; non-root paths are specific and ignore query/fragment; duplicate Favorites are legal and have distinct IDs. Commit the code, tests, plan and orientation update with `favorites: match shortcuts by target`.
