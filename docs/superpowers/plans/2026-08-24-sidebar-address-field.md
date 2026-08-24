# Sidebar Address Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact, editable active-tab address field with an exact supplied copy-link icon above Ember's unchanged Quick Sites grid.

**Architecture:** The sidebar remains the owner of the field and derives its display URL from the existing `browser:state` payload. It submits through the existing `nav:go` command. A narrow invoked IPC reads and copies the currently active tab URL in main, keeping copy authoritative even while sidebar text is being edited.

**Tech Stack:** Electron 43, CommonJS, DOM/CSS, `node:test`.

---

### Task 1: Extend the bounded bridge

**Files:**
- Modify: `src/shared/ipc.js`
- Modify: `src/main/index.js`
- Modify: `src/renderer/preload.js`
- Test: `test/preload.test.js`

- [x] **Step 1: Write the failing bridge contract test**

```js
assert.equal(typeof exposed.copyActiveUrl, 'function')
assert.deepEqual(await exposed.copyActiveUrl(), { channel: IPC.SIDEBAR_COPY_ACTIVE_URL })
assert.deepEqual(invoked.at(-1), [IPC.SIDEBAR_COPY_ACTIVE_URL, undefined])
```

- [x] **Step 2: Run the focused test to verify it fails**

Run: `node --test test/preload.test.js`

Expected: FAIL because `copyActiveUrl` is not exposed.

- [x] **Step 3: Implement the narrow copy action**

```js
// src/shared/ipc.js
SIDEBAR_COPY_ACTIVE_URL: 'sidebar:copy-active-url',

// src/renderer/preload.js
copyActiveUrl: () => ipcRenderer.invoke(IPC.SIDEBAR_COPY_ACTIVE_URL),

// src/main/index.js
ipcMain.handle(IPC.SIDEBAR_COPY_ACTIVE_URL, (event) => {
  const current = browserFromSender(event.sender) || browser
  const url = current?.tabs.active?.url || ''
  if (url) clipboard.writeText(url)
  return url
})
```

- [x] **Step 4: Run the focused test to verify it passes**

Run: `node --test test/preload.test.js`

Expected: PASS.

### Task 2: Build the sidebar field without changing Favorites

**Files:**
- Modify: `src/renderer/sidebar.html`
- Modify: `src/renderer/sidebar.css`
- Modify: `src/renderer/sidebar.js`
- Create: `src/renderer/assets/copy-link.png`
- Test: `test/renderer-contracts.test.js`

- [x] **Step 1: Write the failing sidebar structure and interaction contract**

```js
assert.match(sidebarHtml, /<form class="sidebar-address" id="sidebar-address">/)
assert.match(sidebarHtml, /<input[^>]+id="sidebar-address-input"/)
assert.match(sidebarHtml, /<img[^>]+src="assets\/copy-link\.png"/)
assert.match(sidebarJs, /window\.ember\.go\(addressInput\.value\)/)
assert.match(sidebarJs, /window\.ember\.copyActiveUrl\(\)/)
assert.match(sidebarCss, /\.sidebar-content[\s\S]+display: grid/)
assert.match(sidebarCss, /\.favorite\s*\{/)
```

- [x] **Step 2: Run the focused test to verify it fails**

Run: `node --test test/renderer-contracts.test.js`

Expected: FAIL because the sidebar form and copy asset are absent.

- [x] **Step 3: Implement the minimal sidebar behavior**

```js
function syncAddress(state) {
  browserState = state || browserState
  const url = browserState.tabs?.find((tab) => tab.active)?.url || ''
  if (document.activeElement !== addressInput && !addressInput.dataset.editing) addressInput.value = url
}

addressForm.addEventListener('submit', (event) => {
  event.preventDefault()
  addressInput.dataset.editing = ''
  window.ember.go(addressInput.value)
})
```

Put the form above the existing `#favorites` grid inside a single content container. Use the existing Favorite material values; let the native input retain default horizontal scrolling and selection. Package the user-supplied icon as `copy-link.png`, cropped to its source glyph without redrawing it.

- [x] **Step 4: Run focused sidebar contracts to verify they pass**

Run: `node --test test/renderer-contracts.test.js`

Expected: PASS.

### Task 3: Verify integration and regressions

**Files:**
- Modify: `test/preload.test.js`
- Modify: `test/renderer-contracts.test.js`

- [x] **Step 1: Add tests for active-tab source-of-truth synchronization and edit protection**

```js
assert.match(sidebarJs, /document\.activeElement !== addressInput/)
assert.match(sidebarJs, /addressInput\.dataset\.editing/)
assert.match(sidebarJs, /addressInput\.addEventListener\('blur'/)
```

- [x] **Step 2: Run focused feature and Favorite regression tests**

Run: `node --test test/preload.test.js test/renderer-contracts.test.js test/favorites.test.js test/context-menu-panel.test.js`

Expected: PASS.

- [x] **Step 3: Run the full validation gates**

Run: `npm test && npm run smoke`

Expected: both commands exit 0.

- [x] **Step 4: Perform visual validation**

Run: `npm start`, then capture the sidebar with `node scripts/capture-ui.js`.

Expected: the address field sits below existing top controls, Favorites are merely displaced, and no clipping or hit-target drift is visible through a sidebar transition.
