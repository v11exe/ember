# Native Sidebar Address and Copy Parity Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task by task.

**Goal:** Correct native patch 0007 so the sidebar address and Copy interaction match the measured Electron oracle without regressing the built Favorites slice.

**Architecture:** Keep the work inside Chromium's real `BrowserView`, active `WebContents`, omnibox model, clipboard, Views focus system and native widget hierarchy. Patch 0007 owns rail/address/Copy behavior; patch 0008 remains an incremental Favorites-only layer and is regenerated from exact pre/postimages after 0007 changes.

**Tech Stack:** Chromium C++/Views, `TabStripModel`, `OmniboxEditModel`, `ui::Clipboard`, Node `node:test`, Quilt patch stack, GN/Ninja, CDP and Windows UI Automation.

---

### Task 1: Lock the measured contract in tests

**Files:**
- Modify: `test/chromium-port.test.js`

1. Expand the patch 0007 contract to require measured rail/address dimensions, literal URL simplification, focus/edit guards, icon-only Copy rendering, independent toast state, and existing clipboard/navigation safety.
2. Explicitly reject `url_formatter::FormatUrl(url)` and visible `Copy`/`Copied` button labels.
3. Run the focused test and confirm it fails against the old patch for the intended missing contract.

### Task 2: Regenerate patches 0007 and 0008 from exact images

**Files:**
- Modify: `chromium/patches/ember/0007-ember-sidebar-address-copy-link.patch`
- Modify: `chromium/patches/ember/0008-ember-sidebar-favorites.patch`
- Reference: `C:/src/ember-chromium/configuration/build/src/chrome/browser/ui/views/frame/browser_view.{cc,h}`

1. Reconstruct patch-0006, old patch-0007 and old patch-0008 source images in a bounded scratch directory.
2. Implement the address surface, real omnibox-backed editing, measured Copy icon interaction and non-layout-shifting confirmation toast in the desired patch-0007 image.
3. Apply the same base changes to the desired post-0008 image, preserving all Favorites code and behavior.
4. Mechanically regenerate both patches; never repair hunk counts by hand.
5. Run the patch-hunk checker and focused contracts until green.

### Task 3: Prepare and compile the preserved native checkout

**Files:**
- Verify: `C:/src/ember-chromium/configuration/build/src`
- Update if evidence changes: `CHROMIUM_PORT_STATUS.md`

1. Run deterministic preparation twice and verify all managed postimages/resources.
2. Compile the focused `browser_view` object, then resume the existing incremental Chrome/package graph only if the focused compile succeeds.
3. Stop on real compile errors and correct the owning patch; do not clean, reacquire, or delete `out/Default` or `.ninja_log`.

### Task 4: Run a proportionate native interaction pass

**Files:**
- Compare: `chromium/reference/electron/9ae3217/sidebar-address.png`
- Compare: `chromium/reference/electron/9ae3217/sidebar-copy-hover.png`
- Compare: `chromium/reference/electron/9ae3217/sidebar-copy-feedback.png`

1. Launch the built native binary with a fresh temporary profile and remote debugging.
2. Verify the visible address/Copy geometry, one edit/navigation path, exact clipboard contents, the independent confirmation toast and one Favorite regression path.
3. Capture one useful runtime frame and confirm a clean sandboxed launch/shutdown. Defer exhaustive state, multi-window and artifact-forensics matrices unless this practical pass exposes a real problem; this friends-only port prioritizes feature replication and forward progress.

### Task 5: Record, synchronize and push the verified slice

**Files:**
- Modify: `AGENTS.md`
- Modify: `CHROMIUM_PORT_STATUS.md`
- Modify if conclusions change: `chromium/README.md`
- Modify if architecture evidence changes: `chromium/research/UPSTREAM_NOTES.md`

1. Record exact commands, results, artifact hashes, parity state and next executable task.
2. Run patch checks, focused native contracts, the Electron regression suite and smoke gate where applicable.
3. Fetch and inspect incoming `origin/chromium-port`, reconcile compatible changes, commit, rebase and push without force.
