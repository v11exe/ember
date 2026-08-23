# Shell Compositing, Tab Drag, and Favorites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Ember's shell/corner artifacts while preserving accepted geometry, and add native-feeling tab reorder plus tab-to-Favorite pin/open/remove interactions.

**Architecture:** Keep Ember's bounded `WebContentsView` layout and synchronize one CSS shell material across views with main-process window-coordinate metrics. Commit all tab and Favorite mutations in main; render cross-view drag feedback with HTML drag-and-drop and reuse the existing floating context-menu surface for removal.

**Tech Stack:** Electron 43 `BaseWindow`/`WebContentsView`, CommonJS JavaScript, vanilla HTML/CSS, `node:test`.

---

### Task 1: Shared tab and Favorite model contracts

**Files:**
- Modify: `src/shared/favorites.js`
- Modify: `src/main/tabs.js`
- Test: `test/favorites.test.js`
- Test: `test/tab-layout.test.js`

- [ ] **Step 1: Write failing model tests**

Add tests that require a `favoriteFromTab(tab, current)` helper to store the exact HTTP(S) URL, title, and favicon while deduplicating by site and respecting `MAX_FAVORITES`; add a `TabManager.move(id, beforeId)` test that verifies array order changes while object identity, `activeId`, `asleep`, and view references do not.

```js
test('a dropped tab keeps its exact URL and deduplicates by site', () => {
  const tab = { id: 8, title: 'Issue', url: 'https://github.com/openai/codex/issues/1', favicon: 'https://github.com/favicon.ico' }
  assert.deepEqual(favoriteFromTab(tab, []), {
    status: 'added',
    favorites: [{ id: 'github-com', name: 'Issue', url: tab.url, icon: tab.favicon }],
  })
  assert.equal(favoriteFromTab(tab, [{ id: 'github', name: 'GitHub', url: 'https://github.com/' }]).status, 'existing')
})

test('moving a tab changes only physical order', () => {
  const { tabs } = fixture()
  const first = tabs.tabs[0]
  const sleeping = { id: 2, asleep: true, view: null, webContents: null, url: 'https://sleep.test/' }
  tabs.tabs.push(sleeping)
  assert.equal(tabs.move(2, 1), true)
  assert.deepEqual(tabs.tabs.map((tab) => tab.id), [2, 1])
  assert.equal(tabs.tabs[0], sleeping)
  assert.equal(tabs.tabs[1], first)
})
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test test/favorites.test.js test/tab-layout.test.js`

Expected: failures report that `favoriteFromTab` and `TabManager.move` do not exist.

- [ ] **Step 3: Implement minimal model contracts**

Implement `favoriteFromTab` as a pure helper returning `added`, `existing`, `full`, or `invalid`; feed successful output through `sanitiseFavorites`. Implement `TabManager.move` by splicing the existing tab object before the requested live id (or at the end for `null`) and calling `emit()` only when order changes.

```js
move(id, beforeId = null) {
  const from = this.tabs.findIndex((tab) => tab.id === id)
  if (from < 0 || beforeId === id) return false
  const [tab] = this.tabs.splice(from, 1)
  const before = beforeId == null ? this.tabs.length : this.tabs.findIndex((candidate) => candidate.id === beforeId)
  this.tabs.splice(before < 0 ? this.tabs.length : before, 0, tab)
  this.emit()
  return true
}
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test test/favorites.test.js test/tab-layout.test.js`

Expected: all focused tests pass with zero failures.

### Task 2: IPC, persistence, and Favorite removal menu

**Files:**
- Modify: `src/shared/ipc.js`
- Modify: `src/main/index.js`
- Modify: `src/main/context-menu-model.js`
- Modify: `src/main/context-menu-panel.js`
- Modify: `src/renderer/preload.js`
- Test: `test/context-menu-model.test.js`
- Test: `test/context-menu-panel.test.js`
- Test: `test/preload.test.js`

- [ ] **Step 1: Write failing IPC and menu tests**

Require named channels `TAB_REORDER`, `FAVORITE_PIN_TAB`, `FAVORITE_CONTEXT_MENU`, and `FAVORITE_REMOVE`; require preload methods `reorderTab`, `pinFavoriteFromTab`, and `favoriteContextMenu`; require a one-item Favorite context menu.

```js
test('Favorite context menu is intentionally minimal', () => {
  assert.deepEqual(buildFavoriteContextMenu(), [
    { id: 'favorite-remove', label: 'Remove quick site', enabled: true },
  ])
})
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test test/context-menu-model.test.js test/context-menu-panel.test.js test/preload.test.js`

Expected: missing exports/channels/methods fail.

- [ ] **Step 3: Implement main-owned mutations and reuse the floating menu**

Add a single `persistFavorites(source, favorites)` helper that writes the source settings store, syncs other windows, and broadcasts chrome config. `FAVORITE_PIN_TAB` validates the sender window and live tab, calls `favoriteFromTab`, persists only `added`, and returns the status/id. `FAVORITE_REMOVE` removes only the shortcut. Extend `ContextMenuPanel` with `openFavoriteMenu({ favorite, targetView, point })`, a `favorite` active kind, and `onFavoriteCommand` routing.

```js
ipcMain.handle(IPC.FAVORITE_PIN_TAB, async (event, id) => {
  const source = browserFromSender(event.sender) || browser
  const tab = source?.tabs.tabs.find((candidate) => candidate.id === Number(id))
  if (!source || !tab) return { status: 'invalid' }
  const result = favoriteFromTab(tab, source.settings.get('favorites'))
  if (result.status === 'added') await persistFavorites(source, result.favorites)
  return { status: result.status, id: result.favorite?.id || null }
})
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test test/context-menu-model.test.js test/context-menu-panel.test.js test/preload.test.js test/favorites.test.js`

Expected: all focused tests pass.

### Task 3: Cross-view tab drag and Favorite states

**Files:**
- Modify: `src/renderer/chrome.js`
- Modify: `src/renderer/chrome.css`
- Modify: `src/renderer/sidebar.js`
- Modify: `src/renderer/sidebar.css`
- Test: `test/renderer-contracts.test.js`

- [ ] **Step 1: Write failing renderer contract tests**

Require tabs to be draggable, use an Ember-only data type and custom drag image, preview insertion without changing baseline dimensions, invoke main reorder on drop, expose the whole Favorite grid as a drop target, mark any matching open tab with `is-open`, and open a Favorite removal menu on `contextmenu`.

```js
assert.match(chromeJs, /dataTransfer\.setData\(['"]application\/x-ember-tab['"]/)
assert.match(chromeJs, /setDragImage/)
assert.match(sidebarJs, /browserState\.tabs\.some/)
assert.match(sidebarJs, /pinFavoriteFromTab/)
assert.match(sidebarJs, /favoriteContextMenu/)
```

- [ ] **Step 2: Run renderer tests and verify RED**

Run: `node --test test/renderer-contracts.test.js`

Expected: missing drag/drop/open-state contracts fail.

- [ ] **Step 3: Implement drag and Favorite renderer behavior**

Set each tab `draggable = true`; on drag start, set the tab-id payload and a styled cloned tab as the drag image. On dragover, compute `beforeId` from live tab midpoints and reorder DOM with FLIP transforms. On drop, call `reorderTab`; on cancel/end, restore DOM from `browserState`. Keep close controls non-draggable.

In the sidebar, accept dragenter/dragover/drop across `.favorites`, call `pinFavoriteFromTab`, apply a restrained `drop-ready` surface, and pulse an existing/added tile. Render `is-open` when `browserState.tabs.some(tab => sameFavoriteSite(...))`. Right-click calls the Favorite context menu bridge and does not invoke the button click.

- [ ] **Step 4: Run renderer and model tests and verify GREEN**

Run: `node --test test/renderer-contracts.test.js test/favorites.test.js test/tab-layout.test.js`

Expected: all tests pass.

### Task 4: Synchronized shell material and native masks

**Files:**
- Create: `src/renderer/shell-material.css`
- Create: `src/renderer/shell-metrics.js`
- Create: `src/renderer/shell-metrics-preload.js`
- Modify: `src/shared/ipc.js`
- Modify: `src/main/index.js`
- Modify: `src/main/tabs.js`
- Modify: `src/renderer/{chrome,sidebar,frame,corner-mask}.html`
- Modify: `src/renderer/{chrome,sidebar,frame,corner-mask}.css`
- Modify: `src/renderer/preload.js`
- Modify: `src/renderer/corner-mask-preload.js`
- Test: `test/tab-layout.test.js`
- Test: `test/preload.test.js`
- Test: `test/renderer-contracts.test.js`

- [ ] **Step 1: Write failing synchronization tests**

Extend the layout fixture with frame and mask views that record `IPC.SHELL_METRICS`; require every surface to receive `{ width, height, x, y }` matching its absolute bounds during initial layout and sidebar animation. Require all shell HTML files to load `shell-material.css` and `shell-metrics.js`, and require transparent renderer roots.

- [ ] **Step 2: Run synchronization tests and verify RED**

Run: `node --test test/tab-layout.test.js test/preload.test.js test/renderer-contracts.test.js`

Expected: shell metrics and shared stylesheet expectations fail.

- [ ] **Step 3: Implement one window-coordinate material**

Add `IPC.SHELL_METRICS`. Main sends metrics after each view bound update. Renderer bridges subscribe, and `shell-metrics.js` applies `--shell-width`, `--shell-height`, `--shell-x`, and `--shell-y`.

```js
function applyShellMetrics({ width, height, x, y } = {}) {
  const root = document.documentElement.style
  root.setProperty('--shell-width', `${Math.max(1, width)}px`)
  root.setProperty('--shell-height', `${Math.max(1, height)}px`)
  root.setProperty('--shell-x', `${x || 0}px`)
  root.setProperty('--shell-y', `${y || 0}px`)
}
```

Define one layered background in `shell-material.css` with a fast upper-left orange falloff and near-black right/bottom. Apply it at full-window size with negative view-origin position. Replace independent sidebar/top/frame gradients. Make corner masks paint this material only outside the 12px page cutout. Shorten the right frame to end at the bottom frame and let the bottom surface own the bottom-right curve. Keep one shared edge-accent treatment with a black outside pixel and low-opacity internal orange reflection.

- [ ] **Step 4: Run synchronization tests and verify GREEN**

Run: `node --test test/tab-layout.test.js test/preload.test.js test/renderer-contracts.test.js`

Expected: all focused tests pass.

### Task 5: Crop the Ember mark and update visual fixtures

**Files:**
- Create: `src/renderer/assets/icon-white-stroke-tight.png`
- Modify: `src/renderer/brand.js`
- Modify: `src/renderer/brand.css`
- Modify: `src/renderer/chrome.css`
- Modify: `scripts/capture-ui.js`
- Test: `test/brand.test.js`
- Test: `test/renderer-contracts.test.js`

- [ ] **Step 1: Write failing asset tests**

Require `CHROME_ICON_ASSET` to point at the cropped derivative and verify its image dimensions contain no excessive transparent padding while preserving the source alpha aspect ratio. Require both brand and new-tab favicon to use `object-fit: contain` without fixed unequal width/height distortion.

- [ ] **Step 2: Run asset tests and verify RED**

Run: `node --test test/brand.test.js test/renderer-contracts.test.js`

Expected: the derivative is missing and the asset constant still points to the padded source.

- [ ] **Step 3: Generate the lossless crop and update references**

Use the source alpha bounds `(27, 37, 2175, 581)` to crop without resampling. Keep the existing 34×28 brand button and tab dimensions; size the image by one constrained axis with intrinsic aspect ratio and `object-fit: contain`. Update capture fixtures to use shared shell CSS instead of re-creating stale inline gradients.

- [ ] **Step 4: Run asset tests and verify GREEN**

Run: `node --test test/brand.test.js test/renderer-contracts.test.js`

Expected: all tests pass.

### Task 6: Roadmap, full verification, and visual QA

**Files:**
- Modify: `ROADMAP.md`
- Modify: `AGENTS.md`
- Modify: `src/main/index.js`
- Test: `test/*.test.js`

- [ ] **Step 1: Add interaction smoke coverage**

Exercise `TabManager.move`, pin a live exact URL into Favorites, verify duplicate drop does not add, verify any open background/sleeping match yields open state, invoke removal without closing the tab, resize through the existing four dimensions, and collapse/expand the sidebar while checking all mask/frame bounds.

- [ ] **Step 2: Update durable documentation**

Update roadmap #7 guardrails for exact-URL pinning, any-open-tab Favorite state, drag pinning/removal, and horizontal strip reorder compatibility. Update the AGENTS orientation/work log with the shared shell-material/metrics contract and mark the work entry complete.

- [ ] **Step 3: Run the full automated gates**

Run: `npm test`

Expected: zero failed tests.

Run: `npm run smoke`

Expected: `[ember] smoke ok` and exit code 0.

- [ ] **Step 4: Run and visually inspect Ember**

Run Ember and capture the real BaseWindow at the target size plus multiple resized states. Inspect all outer and content corners at 200–400%, the bottom-right segment, gradient seams, outer edge strength, brand/new-tab marks, open Favorite state, drag reorder, sidebar drop target, duplicate drop, removal menu, and sidebar animation. Repeat until no square native pixels, doubled orange segments, or detached masks remain.

- [ ] **Step 5: Final diff and review**

Run: `git diff --check`, `git status --short`, and inspect `git diff HEAD~1`. Request a focused code review of the final diff, address all critical/important findings, then rerun `npm test` and `npm run smoke` fresh before claiming completion.
