# BaseWindow Resource Teardown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every per-window WebContents and helper resource after a BaseWindow has actually closed, without affecting other Ember windows or an interrupted session-close prompt.

**Architecture:** Introduce a small lifecycle module that owns idempotent `WebContentsView` closure and the browser-instance teardown sequence. `createBrowser()` records every direct child view and per-window listener in `self`, then calls the lifecycle module exclusively from `closed`; resource-owning managers expose `destroy()` and TabManager exposes a non-UX teardown that closes only its live renderers. The app-level Snap picker remains alive while any browser remains, but is destroyed with the last browser.

**Tech Stack:** Electron 43 `BaseWindow`/`WebContentsView`, CommonJS, `node:test`.

---

### Task 1: Test and add the view-closure primitive

**Files:**
- Create: `src/main/browser-lifecycle.js`
- Create: `test/browser-lifecycle.test.js`

- [ ] **Step 1: Write the failing ownership/closure tests**

```js
const { closeOwnedView, destroyBrowser } = require('../src/main/browser-lifecycle')

test('closeOwnedView removes a live child and closes its WebContents exactly once', () => {
  const calls = []
  const view = { webContents: { isDestroyed: () => false, close: () => calls.push('close') } }
  const win = { contentView: { removeChildView: (child) => calls.push(['remove', child]) } }

  assert.equal(closeOwnedView(win, view), true)
  assert.equal(closeOwnedView(win, view), false)
  assert.deepEqual(calls, [['remove', view], 'close'])
})

test('destroyBrowser closes only this browser resources and is idempotent', () => {
  const closed = []
  const self = fixtureBrowser({ closed })

  assert.equal(destroyBrowser(self), true)
  assert.equal(destroyBrowser(self), false)
  assert.deepEqual(closed.sort(), ['chrome', 'corner-1', 'corner-2', 'corner-3', 'corner-4', 'frame-bottom', 'frame-right', 'sidebar'])
  assert.equal(self.hibernation.stopped, 1)
  assert.equal(self.tabs.destroyed, 1)
})
```

- [ ] **Step 2: Run the lifecycle test to verify it fails**

Run: `node --test test/browser-lifecycle.test.js`

Expected: FAIL because `browser-lifecycle.js` does not exist.

- [ ] **Step 3: Implement the minimal lifecycle module**

```js
function closeOwnedView(win, view) {
  const contents = view?.webContents
  if (!contents || contents.isDestroyed?.()) return false
  try { win?.contentView?.removeChildView(view) } catch { /* window already closed */ }
  try { contents.close() } catch { return false }
  return true
}

function destroyBrowser(self) {
  if (!self || self.destroyed) return false
  self.destroyed = true
  self.hibernation?.stop()
  self.tabs?.destroy()
  for (const owner of [self.panel, self.uploadPanel, self.contextMenu, self.selection, self.copyToast, self.switcher, self.sessionPrompt, self.popupPositioner]) owner?.destroy?.()
  for (const view of [self.chrome, self.sidebarView, ...Object.values(self.frameViews || {}), ...(self.pageCornerMasks || []).map(({ view }) => view)]) closeOwnedView(self.win, view)
  self.nativeBackdrop?.destroy()
  self.removeListeners?.()
  return true
}
```

`closeOwnedView()` must invoke `webContents.close()` (Electron's documented BaseWindow contract), tolerate a destroyed/missing view, and mark the supplied view closed in a `WeakSet` so a duplicate owner cannot close it twice.

- [ ] **Step 4: Run the lifecycle test to verify it passes**

Run: `node --test test/browser-lifecycle.test.js`

Expected: PASS.

### Task 2: Give every reusable view manager an idempotent destroy path

**Files:**
- Modify: `src/main/floating-panel.js`
- Modify: `src/main/panel.js`
- Modify: `src/main/upload-panel.js`
- Modify: `src/main/context-menu-panel.js`
- Modify: `src/main/selection-panel.js`
- Modify: `src/main/switcher-panel.js`
- Modify: `src/main/session-prompt.js`
- Modify: `src/main/copy-toast.js`
- Modify: `src/main/popup-positioner.js`
- Test: `test/floating-panel.test.js`
- Test: `test/copy-toast.test.js`
- Test: `test/popup-positioner.test.js`

- [ ] **Step 1: Write failing manager cleanup tests**

```js
test('FloatingPanel destroy cancels pending work and closes its one retained view once', () => {
  const closed = []
  const panel = new FloatingPanel({ contentView: { removeChildView: () => {} } }, { createView: () => viewWithClose(closed) })
  panel.view = viewWithClose(closed)

  panel.destroy()
  panel.destroy()
  assert.deepEqual(closed, ['overlay'])
  assert.equal(panel.view, null)
})

test('CopyToast destroy clears both timers and destroys its overlay', () => {
  const cancelled = []
  const panel = new CopyToast({}, { overlay: { destroy: () => cancelled.push('overlay') }, cancel: (timer) => cancelled.push(timer) })
  panel.timer = 'lifetime'; panel.dismissTimer = 'exit'
  panel.destroy()
  assert.deepEqual(cancelled, ['lifetime', 'exit', 'overlay'])
})
```

- [ ] **Step 2: Run focused manager tests to verify they fail**

Run: `node --test test/floating-panel.test.js test/copy-toast.test.js test/popup-positioner.test.js`

Expected: FAIL because the `destroy()` methods are absent.

- [ ] **Step 3: Implement delegated cleanup only**

```js
// FloatingPanel
destroy() {
  if (this.destroyed) return false
  this.destroyed = true
  this.generation += 1
  this.open = false
  const view = this.view
  this.view = null
  this.loaded = false
  return closeOwnedView(this.win, view)
}

// wrapper panels (UploadPanel, ContextMenuPanel, SelectionPanel, TabSwitcher)
destroy() { this.active = null; this.overlay.destroy?.() }

// SessionPrompt
destroy() { this.cancel(); this.panel.destroy?.() }

// PopupPositioner
destroy() { this.extensions?.off?.('browser-action-popup-created', this.onPopup); this.popup?.destroy?.(); this.popup = null }
```

`CopyToast.destroy()` must clear both timers before it delegates. `ExtensionPanel.destroy()` must close its lazy direct view. `PopupPositioner.attach()` must retain the exact listener function so it can remove it; it should explicitly destroy its current library `PopupView`, whose supported implementation destroys its owned popup BrowserWindow. Do not create a new panel view during destruction.

- [ ] **Step 4: Run focused manager tests to verify they pass**

Run: `node --test test/floating-panel.test.js test/copy-toast.test.js test/popup-positioner.test.js test/context-menu-panel.test.js test/upload-panel.test.js test/selection-panel.test.js test/switcher.test.js`

Expected: PASS.

### Task 3: Add a non-UX TabManager teardown

**Files:**
- Modify: `src/main/tabs.js`
- Modify: `test/tab-layout.test.js`

- [ ] **Step 1: Write the failing tab teardown test**

```js
test('destroy closes every live tab without recording history or creating a replacement tab', () => {
  const { tabs, win } = fixture()
  const closed = []
  tabs.tabs = [liveTab(1, closed), sleepingTab(2), liveTab(3, closed)]
  tabs.activeId = 1
  tabs.onTabClosed = () => assert.fail('application teardown must not run normal tab-close history')

  assert.equal(tabs.destroy(), true)
  assert.deepEqual(closed, [1, 3])
  assert.deepEqual(tabs.tabs, [])
  assert.equal(tabs.activeId, null)
  assert.equal(win.contentView.removed.length, 2)
})
```

- [ ] **Step 2: Run the focused tab test to verify it fails**

Run: `node --test test/tab-layout.test.js`

Expected: FAIL because `TabManager.destroy` is absent.

- [ ] **Step 3: Implement the minimal non-UX teardown**

```js
destroy() {
  if (this.destroyed) return false
  this.destroyed = true
  clearTimeout(this.layoutTimer)
  this.layoutTimer = null
  this.win.off?.('resize', this.onResize)
  for (const tab of this.tabs) {
    const { view, webContents: contents } = tab
    tab.view = null; tab.webContents = null
    if (contents && !contents.isDestroyed()) {
      try { this.win.contentView.removeChildView(view); contents.close() } catch { /* already gone */ }
    }
  }
  this.tabs = []
  this.activeId = null
  this.thumbnails?.clear()
  return true
}
```

Bind the constructor resize callback as `this.onResize`, then unregister that exact function. Do not call `onTabClosed`, `create(NEW_TAB_URL)`, `select()`, or `emit()` from teardown. Sleeping tabs have no view/content and must be skipped safely.

- [ ] **Step 4: Run focused tab and hibernation regression tests**

Run: `node --test test/tab-layout.test.js test/hibernation.test.js test/tab-thumbnails.test.js`

Expected: PASS.

### Task 4: Integrate per-window close ownership and listener disposal

**Files:**
- Modify: `src/main/index.js`
- Modify: `src/main/browser-lifecycle.js`
- Test: `test/browser-lifecycle.test.js`

- [ ] **Step 1: Write failing per-window lifecycle integration tests**

```js
test('one closed browser does not query another browser close state', async () => {
  const first = fixtureBrowser(); const second = fixtureBrowser()
  await invokeClose(first, 'yes')
  assert.equal(first.closing, true)
  assert.equal(second.closing, false)
  assert.equal(second.sessionPrompt.asked, 0)
})

test('removing the final browser destroys the shared SnapPicker but an earlier close does not', () => {
  const picker = { destroyCalls: 0, destroy() { this.destroyCalls += 1 } }
  const browsers = new Set([first, second])
  finishClosed(first, browsers, picker)
  assert.equal(picker.destroyCalls, 0)
  finishClosed(second, browsers, picker)
  assert.equal(picker.destroyCalls, 1)
})
```

- [ ] **Step 2: Run lifecycle integration tests to verify they fail**

Run: `node --test test/browser-lifecycle.test.js`

Expected: FAIL because close code still reads/writes the global `browser` and does not dispose the last picker.

- [ ] **Step 3: Wire the authoritative teardown into `createBrowser()`**

```js
const browserSession = privateMode ? session.fromPartition('persist:ember-private') : session.defaultSession
const onWillDownload = (_event, item, contents) => {
  if (!tabs.tabs.some((tab) => tab.webContents === contents)) return
  downloads.track(item)
  // retain existing downloadingBy accounting
}
browserSession.on('will-download', onWillDownload)
self.removeListeners = () => browserSession.removeListener('will-download', onWillDownload)

win.on('close', (event) => {
  if (self.closing) return
  // preserve the current session decision logic, but use self.sessionPrompt and self.closing
})
win.on('closed', () => {
  const ownedIds = lifecycleDebugIds(self)
  destroyBrowser(self)
  browsers.delete(self)
  if (browser === self) browser = [...browsers].at(-1) || null
  if (browsers.size === 0) snapPicker.destroy()
  reportLifecycleResult(ownedIds, self)
})
```

Use `self` in every window-owned handler (`resize`, `close`, `closed`) rather than the global active-window pointer. Change the `watchMainFrameStatus()` callback to resolve `webContentsId` back to its current browser owner at event time; the once-per-session listener must not capture a closed TabManager. Retain `app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })` unchanged.

- [ ] **Step 4: Add opt-in ownership diagnostics and run tests**

```js
if (process.env.EMBER_DEBUG_LIFECYCLE === '1') {
  console.debug('[ember] closing owned WebContents', [...ownedIds])
  setImmediate(() => console.debug('[ember] surviving owned WebContents', liveOwnedIds(ownedIds)))
}
```

Run: `node --test test/browser-lifecycle.test.js test/tab-layout.test.js test/floating-panel.test.js test/copy-toast.test.js test/popup-positioner.test.js`

Expected: PASS.

### Task 5: Verify close behavior in a real Electron process

**Files:**
- Modify: `scripts/smoke.js`
- Modify: `src/main/index.js`
- Test: `test/browser-lifecycle.test.js`
- Modify: `BUGS.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Add a failing smoke-mode close hook**

```js
// Test-only environment hook after smoke probes open tabs and panels.
browser.win.close()
await waitFor(() => browsers.size === 0, 8_000)
console.log('[ember] smoke close teardown ok')
```

Run: `npm run smoke`

Expected: FAIL or time out on the current implementation because BaseWindow child renderers and the picker survive the final window close.

- [ ] **Step 2: Implement only the test-mode close completion signal**

```js
if (process.env.EMBER_SMOKE_CLOSE) {
  browser.win.close()
  await waitFor(() => browsers.size === 0, 8_000)
  console.log('[ember] smoke close teardown ok')
  app.quit()
}
```

Update `scripts/smoke.js` to set `EMBER_SMOKE_CLOSE=1` and require both the ordinary smoke marker and `[ember] smoke close teardown ok` before it calls the spawned Electron process clean.

- [ ] **Step 3: Run full verification**

Run: `npm test && npm run smoke && npm start`

Expected: all 354+ unit tests pass; smoke performs a real accepted close after opening views; manual `npm start` confirms cancelling and accepting the session prompt preserve their respective behavior.

- [ ] **Step 4: Perform the Windows repeat-cycle check**

Run in PowerShell after closing all Ember instances:

```powershell
1..5 | ForEach-Object {
  npm start
  # Open several tabs and panels, then click the Ember X button.
  Start-Sleep -Seconds 3
  Get-Process electron -ErrorAction SilentlyContinue | Select-Object Id, StartTime, Path
}
```

Expected: after each accepted final close, no process from that Ember launch remains. With two Ember windows, closing one removes only that window's view/process set and leaves the other operational.

- [ ] **Step 5: Record durable behavior**

Set B34 to `✅ Fixed`, record the implementation commit/branch and the requirement that every new per-window view or listener registers a matching destroy path. Update the AGENTS orientation cache and Work Log with the direct-view ownership map and the final-window SnapPicker rule. Do not add packaging infrastructure; retain `name: "ember"` and add `productName: "Ember"` only if the existing package configuration can express it without changing the development executable.
