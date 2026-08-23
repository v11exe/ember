# Ember Unified Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Ember's default two-row browser chrome with the approved unified shell, collapsible Favorite sidebar, lifecycle-aware natural-width tabs, rounded native page viewport, and native Windows caption controls without altering the live backdrop implementation.

**Architecture:** A full-window transparent chrome `WebContentsView` paints only the shell regions beneath an inset active page view. A shared pure geometry module drives both native bounds and renderer calibration; Settings and named IPC persist and broadcast the sidebar/Favorite configuration.

**Tech Stack:** Electron 43 `BaseWindow`/`WebContentsView`/`View.setBorderRadius`, CommonJS JavaScript, vanilla HTML/CSS, `node:test`.

---

### Task 1: Shared shell geometry and Favorite contracts

**Files:**
- Create: `src/shared/chrome-layout.js`
- Create: `src/shared/favorites.js`
- Create: `test/chrome-layout.test.js`
- Create: `test/favorites.test.js`

- [ ] **Step 1: Write failing geometry and Favorite tests.** Assert 1570x796 open/collapsed bounds, dynamic tab caps, three sanitized defaults, invalid-entry rejection, origin matching, and matching sleeping-tab reuse.
- [ ] **Step 2: Run `node --test test/chrome-layout.test.js test/favorites.test.js`; expect missing-module failures.**
- [ ] **Step 3: Implement exported constants, `viewportBounds()`, `dynamicTabMax()`, `DEFAULT_FAVORITES`, `sanitiseFavorites()`, `sameFavoriteSite()`, and `findFavoriteTab()`.**
- [ ] **Step 4: Re-run the focused tests; expect all pass.**

```js
assert.deepEqual(viewportBounds({ width: 1570, height: 796, sidebarOpen: true }),
  { x: 170, y: 52, width: 1392, height: 736, radius: 9 })
assert.equal(findFavoriteTab([{ id: 4, url: 'https://youtube.com/watch?v=x', asleep: true }],
  'https://youtube.com'), 4)
```

### Task 2: Persist and bridge shell configuration

**Files:**
- Modify: `src/main/settings.js`
- Modify: `src/shared/ipc.js`
- Modify: `src/renderer/preload.js`
- Modify: `src/main/index.js`
- Modify: `test/preload.test.js`
- Create: `test/settings.test.js`

- [ ] **Step 1: Add failing tests for default/sanitized Favorites, persisted `sidebarOpen`, and `getChromeConfig`, `openFavorite`, `setSidebarOpen`, `onChromeConfig` preload methods.**
- [ ] **Step 2: Run focused tests; expect missing settings and bridge behavior.**
- [ ] **Step 3: Add `CHROME_CONFIG_GET`, `CHROME_CONFIG_CHANGED`, `SIDEBAR_SET`, and `FAVORITE_OPEN`; persist settings, broadcast changes, and select a matching tab or create one.**
- [ ] **Step 4: Re-run focused tests; expect pass.**

### Task 3: Make native page geometry match the shell

**Files:**
- Modify: `src/main/tabs.js`
- Modify: `src/main/index.js`
- Modify: `src/main/panel.js`
- Create: `test/tab-layout.test.js`

- [ ] **Step 1: Add a failing `TabManager.layout()` contract test with stub chrome/page views.**
- [ ] **Step 2: Verify the old 84 px full-width layout fails.**
- [ ] **Step 3: Make chrome a full-window underlay, stack the active page above it, apply native border radius, animate sidebar bounds, and move extension-panel top to the 52 px contract.**
- [ ] **Step 4: Update smoke layout assertions and re-run focused tests.**

```js
assert.deepEqual(pageBounds, { x: 170, y: 52, width: 1092, height: 680 })
assert.equal(pageRadius, 9)
assert.deepEqual(chromeBounds, { x: 0, y: 0, width: 1270, height: 740 })
```

### Task 4: Replace the renderer with the unified shell

**Files:**
- Modify: `src/renderer/chrome.html`
- Modify: `src/renderer/chrome.css`
- Modify: `src/renderer/chrome.js`
- Modify: `src/renderer/brand.js`
- Modify: `src/renderer/brand.css`
- Modify: `test/brand.test.js`
- Modify: `test/renderer-contracts.test.js`

- [ ] **Step 1: Add failing contracts for one top row, sidebar/Favorite grid, no permanent toolbar, fade masks, hover-only close, sleeping indicator, drag/no-drag regions, and white-stroke branding.**
- [ ] **Step 2: Run renderer/brand tests; expect the old DOM/CSS to fail.**
- [ ] **Step 3: Implement semantic shell/sidebar/top-chrome markup and the target gradient, perimeter accent, compact controls, transient omnibox, natural-width tabs, state hierarchy, and responsive/maximized rules.**
- [ ] **Step 4: Implement configuration/state rendering, Favorite activation, ResizeObserver tab caps/overflow measurement, and synchronized sidebar toggling.**
- [ ] **Step 5: Re-run renderer/brand/preload tests; expect pass.**

### Task 5: Complete Roadmap #7 settings and documentation

**Files:**
- Modify: `src/renderer/pages/settings.html`
- Modify: `src/renderer/pages/settings.js`
- Modify: `src/renderer/pages/settings.css`
- Modify: `ROADMAP.md`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `test/renderer-contracts.test.js`

- [ ] **Step 1: Add a failing contract for ordered Favorite add/edit/remove/reset UI.**
- [ ] **Step 2: Run the renderer contract; expect failure.**
- [ ] **Step 3: Add the Settings editor backed by existing Settings IPC.**
- [ ] **Step 4: Mark Roadmap #7 completed with durable guardrails, move it to README Completed, and update orientation/Work Log.**
- [ ] **Step 5: Re-run focused tests; expect pass.**

### Task 6: Screenshot-driven calibration and final gates

**Files:**
- Modify: `scripts/capture-ui.js`
- Modify: `src/main/index.js` only if a scoped smoke capture/probe is required
- Generate only: `visual-qa/ember-shell-*.png`

- [ ] **Step 1: Pose the target Favorite/tab states at 1570x796 in the capture harness and add measurable geometry assertions.**
- [ ] **Step 2: Run `npm run smoke` and the shell capture; inspect beside Screenshot 2.**
- [ ] **Step 3: Iterate on geometry, then colour/opacity, then 1–3 px alignment, recapturing after each tier.**
- [ ] **Step 4: Launch `npm start`; verify navigation, `Ctrl+L`, Favorite reuse/wake, tabs, hover close, sidebar animation, resize, maximize/restore, extensions, bookmarks shortcut, and page clipping.**
- [ ] **Step 5: Run `npm test`, `npm run smoke`, bounded `npm start`, `git diff --check`, and final diff/status review.**

