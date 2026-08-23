# Adaptive Favorite Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist a configurable 1–4 by 1–7 Favorite grid with animated insertion previews, exact slot placement, and replacement only when a new site is dropped into a full grid.

**Architecture:** Pure helpers in `src/shared/favorites.js` own grid validation and ordered mutations. `SettingsStore` persists dimensions and enforces capacity, main IPC commits renderer-requested indexed drops, and the bounded sidebar view renders CSS-variable-driven cells with FLIP previews. Settings edits dimensions through the existing named preference bridge.

**Tech Stack:** Electron 43, CommonJS JavaScript, context-isolated IPC, CSS Grid/Web Animations API, `node:test`.

---

### Task 1: Pure adaptive-grid contracts

**Files:**
- Modify: `src/shared/favorites.js`
- Test: `test/favorites.test.js`

- [ ] **Step 1: Write failing grid and placement tests**

Add tests for `{ columns: 2, rows: 2 }` defaults, clamping to 1–4/1–7,
capacity truncation, insertion into spare capacity, full replacement, same-site
reorder, and index clamping. Expected examples:

```js
assert.deepEqual(sanitiseFavoriteGrid({ columns: 0, rows: 99 }), { columns: 1, rows: 7 })
assert.deepEqual(placeFavorite(incoming, list, { columns: 2, rows: 2 }, 1).favorites,
  [list[0], incoming, list[1], list[2]])
assert.deepEqual(placeFavorite(incoming, full, { columns: 2, rows: 2 }, 1).favorites,
  [full[0], incoming, full[2], full[3]])
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test test/favorites.test.js`
Expected: FAIL because adaptive-grid exports do not exist.

- [ ] **Step 3: Implement the pure contracts**

Add and export:

```js
const FAVORITE_GRID_DEFAULTS = Object.freeze({ columns: 2, rows: 2 })
const FAVORITE_GRID_LIMITS = Object.freeze({ columns: 4, rows: 7 })
function sanitiseFavoriteGrid(value) { /* independently round and clamp */ }
function favoriteCapacity(grid) { /* sanitized columns * rows */ }
function placeFavorite(candidate, current, grid, index) { /* insert/reorder/replace */ }
```

Refactor `favoriteFromTab(tab, current, grid, index)` to build a trusted candidate
and delegate ordered placement. Same-site candidates move rather than duplicate.

- [ ] **Step 4: Run the focused test and verify pass**

Run: `node --test test/favorites.test.js`
Expected: all Favorite tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared/favorites.js test/favorites.test.js
git commit -m "favorites: add adaptive grid placement contracts"
```

### Task 2: Persist grid dimensions and capacity

**Files:**
- Modify: `src/main/settings.js`
- Modify: `src/main/index.js`
- Test: `test/settings.test.js`

- [ ] **Step 1: Write failing persistence tests**

Cover default 2×2, clamped restart persistence, and Favorites truncation after a
capacity reduction. Verify an explicit empty list remains empty.

```js
assert.deepEqual(settings.get('favoriteGrid'), { columns: 2, rows: 2 })
await settings.set('favoriteGrid', { columns: 1, rows: 3 })
assert.equal(settings.get('favorites').length, 3)
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test test/settings.test.js`
Expected: FAIL because `favoriteGrid` is absent.

- [ ] **Step 3: Implement atomic coupled settings**

Add `favoriteGrid` to defaults/read/snapshot. When dimensions change, sanitize the
grid and truncate Favorites to capacity before the single atomic write. When
Favorites change, sanitize against current capacity. Include `favoriteGrid` in
`chromeConfig()` and broadcast it for both settings keys.

- [ ] **Step 4: Run focused settings tests**

Run: `node --test test/settings.test.js`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/main/settings.js src/main/index.js test/settings.test.js
git commit -m "settings: persist Favorite grid dimensions"
```

### Task 3: Indexed main/preload commands

**Files:**
- Modify: `src/shared/ipc.js`
- Modify: `src/main/index.js`
- Modify: `src/renderer/preload.js`
- Test: `test/preload.test.js`
- Test: `test/favorites.test.js`

- [ ] **Step 1: Write failing bridge assertions**

Assert `pinFavoriteFromTab(id, index)` invokes `{ id, index }` and add a named
`FAVORITE_MOVE` invoke bridge for existing tile reorder.

- [ ] **Step 2: Verify focused failure**

Run: `node --test test/preload.test.js`
Expected: existing scalar payload does not match.

- [ ] **Step 3: Implement trusted indexed commands**

Main resolves the tab and current grid, calls `favoriteFromTab(tab, favorites,
grid, index)`, and persists any added/moved/replaced result. Existing Favorite
movement accepts only an ID and index, resolves the stored Favorite in main, then
uses the same pure placement helper.

- [ ] **Step 4: Run focused bridge tests**

Run: `node --test test/preload.test.js test/favorites.test.js`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared/ipc.js src/main/index.js src/renderer/preload.js test/preload.test.js test/favorites.test.js
git commit -m "favorites: add indexed placement commands"
```

### Task 4: Animated configurable sidebar grid

**Files:**
- Modify: `src/renderer/sidebar.js`
- Modify: `src/renderer/sidebar.css`
- Test: `test/renderer-contracts.test.js`

- [ ] **Step 1: Write failing renderer contract tests**

Require configured `--favorite-columns`, `--favorite-rows`, `--favorite-height`,
and `--favorite-gap`; empty `.favorite-slot` cells; indexed dragover; FLIP animation;
and indexed pin/move calls.

- [ ] **Step 2: Verify focused failure**

Run: `node --test test/renderer-contracts.test.js`
Expected: FAIL on missing adaptive-grid behavior.

- [ ] **Step 3: Render configured cells and animate previews**

Derive the fixed maximum height from four current rows. Use 43px height through
four rows, then compute compressed height/gap for rows 5–7 while never changing
`.favorite img { width: 19px; height: 19px; }`. Render exactly `columns * rows`
cells. During compatible dragover, compute the hovered index from the cell,
preview `placeFavorite` semantics in memory, and FLIP animate every existing tile.
On dragleave/end restore authoritative config; on drop invoke main once.

- [ ] **Step 4: Run renderer tests**

Run: `node --test test/renderer-contracts.test.js`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/sidebar.js src/renderer/sidebar.css test/renderer-contracts.test.js
git commit -m "favorites: animate adaptive grid placement"
```

### Task 5: Settings controls

**Files:**
- Modify: `src/renderer/pages/settings.html`
- Modify: `src/renderer/pages/settings.js`
- Modify: `src/renderer/pages/settings.css`
- Test: `test/renderer-contracts.test.js`

- [ ] **Step 1: Write failing settings UI contracts**

Require column and row controls, 1–4 and 1–7 option generation, capacity-aware
Favorite counts, and `api.set('favoriteGrid', ...)`.

- [ ] **Step 2: Verify focused failure**

Run: `node --test test/renderer-contracts.test.js`
Expected: FAIL on missing settings controls.

- [ ] **Step 3: Implement controls and animated feedback**

Add two compact selects labeled `Across` and `Down`. On change, persist the entire
grid object, update capacity/count immediately from the returned snapshot, and
re-render any truncated Favorite list. Keep the settings card's existing glass
language and transition the capacity text rather than adding a new visual system.

- [ ] **Step 4: Run renderer tests**

Run: `node --test test/renderer-contracts.test.js`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/pages/settings.html src/renderer/pages/settings.js src/renderer/pages/settings.css test/renderer-contracts.test.js
git commit -m "settings: configure Favorite grid size"
```

### Task 6: Documentation and full verification

**Files:**
- Modify: `ROADMAP.md`
- Modify: `README.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update durable contracts**

Document configured capacity, 2×2 default, 4×7 icon-preserving limit, indexed
insert/full replacement behavior, and resize/reorder animation. Mark the Work Log
entry completed after verification.

- [ ] **Step 2: Run all automated gates**

Run: `npm test`
Expected: all tests pass.

Run: `npm run smoke`
Expected: `[ember] smoke ok` and PASS.

- [ ] **Step 3: Perform live visual QA**

Launch Ember with a throwaway profile. Exercise 1×3, 2×2, 2×4, and 4×7; drag into
first/middle/last cells; verify shift and full replacement; resize and collapse the
sidebar; restart and confirm exact dimensions/order. Confirm icons remain 19px.

- [ ] **Step 4: Review and commit**

Run `git diff --check`, inspect `git diff`, then:

```bash
git add ROADMAP.md README.md AGENTS.md
git commit -m "docs: record adaptive Favorite grid contracts"
```
