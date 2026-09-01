# Native Chromium Favorites Implementation Plan

> **For agentic workers:** Execute this plan inline on `chromium-port`; the external Chromium checkout is generated state and the ordered patch is the source of truth.

**Goal:** Add the first useful native Favorite grid to Ember's Chromium rail with real profile persistence, favicon loading, and correct live/discarded-tab reuse.

**Architecture:** Normal Chromium `BrowserView` windows observe the profile's existing `BookmarkModel`. A metadata-marked `Ember Favorites` folder under Other Bookmarks owns the ordered shortcuts and receives the three Electron-oracle defaults only when first created. Native Views buttons render its first four URL children in a 2x2 grid; activation searches the existing `TabStripModel` with Ember's broad-root/exact-path rules before opening a new tab.

**Tech Stack:** Chromium C++/Views, `BookmarkModel`, `BaseBookmarkModelObserver`, `TabStripModel`, Node `node:test` patch-contract tests, external official Windows Chromium build.

---

### Task 1: Patch contract

**Files:**
- Modify: `test/chromium-port.test.js`
- Modify: `chromium/patches/series`
- Create: `chromium/patches/ember/0008-ember-sidebar-favorites.patch`

- [x] Add patch 0008 to the exact ordered-series assertion.
- [x] Add a contract test which requires `BookmarkModelFactory`, a metadata-marked `Ember Favorites` folder, Google/YouTube/Google Calendar defaults, `BaseBookmarkModelObserver`, `GetFavicon`, `ActivateTabAt`, `AddTabAt`, and the broad-root/exact-path matching helpers.
- [x] Require the patch to touch only `browser_view.cc` and `browser_view.h` and reject `--no-sandbox` or security-process changes.
- [x] Run `node --test test/chromium-port.test.js`; expect failure because patch 0008 does not exist yet.

### Task 2: Bookmark-backed native Favorites

**Files:**
- Modify externally: `chrome/browser/ui/views/frame/browser_view.{h,cc}`
- Create from the external diff: `chromium/patches/ember/0008-ember-sidebar-favorites.patch`

- [x] Make `BrowserView` inherit `bookmarks::BaseBookmarkModelObserver`, observe `BookmarkModelFactory::GetForBrowserContext(browser_->profile())`, and reset the observation during teardown.
- [x] On model load, find the folder by persisted metadata; only if absent create it and add:

```cpp
{u"Google", GURL("https://www.google.com/")}
{u"YouTube", GURL("https://www.youtube.com/")}
{u"Google Calendar", GURL("https://calendar.google.com/")}
```

- [x] Rebuild a 2x2, 43px-high Views grid from the first four URL children. Each focusable button carries its full accessible name/tooltip and uses `BookmarkModel::GetFavicon()` when available.
- [x] Match root shortcuts across their normalized host and child subdomains, preferring an already-open direct-host root; match non-root shortcuts only by normalized host plus path, ignoring query and fragment.
- [x] Activate the matching tab through `TabStripModel::ActivateTabAt`; otherwise use `chrome::AddTabAt`. Refresh open-state styling on bookmark, favicon, navigation, insert, close, and selection changes.
- [x] Compile `obj/chrome/browser/ui/views/frame/browser_view.obj`, then run the focused Node test until it passes.

### Task 3: Deterministic patch and build proof

**Files:**
- Modify: `chromium/patches/ember/0008-ember-sidebar-favorites.patch`
- Modify: `chromium/patches/series`

- [x] Generate patch 0008 strictly as the incremental diff from the seven-patch postimage.
- [x] Run patch reverse verification and two consecutive `npm run chromium:prepare` passes.
- [x] Run the official build wrapper, resume only if needed, and regenerate installer/portable packages.
- [x] Record exact `chrome.exe`, `chrome.dll`, installer, and portable ZIP sizes/hashes.

### Task 4: Runtime and regression proof

**Files:**
- Modify: `CHROMIUM_PORT_STATUS.md`
- Modify: `chromium/README.md`
- Modify: `chromium/research/UPSTREAM_NOTES.md`
- Modify: `AGENTS.md`

- [ ] Launch with a fresh isolated profile and use Windows UI Automation to prove the three focusable Favorite controls appear.
- [ ] Invoke Google twice and prove the second invocation activates the existing matching target without increasing the page-target count.
- [ ] Close and relaunch the same profile; prove the stored folder/defaults remain exactly once.
- [ ] Capture the native HWND, inspect the 2x2 rail geometry, verify the normal sandboxed process tree, and prove clean shutdown removes singleton locks.
- [ ] Run `npm test`, `npm run smoke`, `npm start`, and `git diff --check`.
- [ ] Update the mutable parity ledger without claiming drag/drop, grid settings, removal, or full visual parity.
- [ ] Fetch, rebase on `origin/main`, rerun the live oracle gate, commit, and push `chromium-port`.
