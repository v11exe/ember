# Native EmberGlass Overlay Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Match the supplied Opera GX Ctrl+Tab motion and proportions, compact native EmberGlass menus, replace stepped shadows, then adopt the shared glass path for remaining eligible native browser menus.

**Architecture:** Keep the existing `EmberGlassMaterial` capture and cache unchanged. Extend the existing overlay controller with stable thumbnail-backed switcher cards, measured menu rows, compositor-cheap motion state, and a shared device-aware two-layer shadow in `EmberGlassView`; add menu routes incrementally without replacing their `ui::MenuModel` command owners.

**Tech Stack:** Chromium C++/Views, Skia/cc paint, Chromium `ThumbnailImage`, `gfx::LinearAnimation`, Node `node:test`, Ninja, CDP plus native HWND capture.

---

### Task 1: Seal the corrective runtime slice

**Files:**
- Modify: `CHROMIUM_PORT_STATUS.md`
- Modify: `AGENTS.md`
- Verify: `chromium/patches/ember/0017-ember-glass-runtime-corrections.patch`

- [ ] Verify patch 0017 postimages against the applied external checkout.
- [ ] Record the successful diagnostic-free object/DLL rebuild and actual HWND glass captures.
- [ ] Preserve the factual result that the reported Ctrl-release crash was not reproduced under repeated debugger stress.

### Task 2: Add failing structural contracts

**Files:**
- Modify: `test/chromium-port.test.js`
- Create: `chromium/patches/ember/0018-ember-glass-overlay-refinements.patch`
- Modify: `chromium/patches/series`

- [ ] Add contracts requiring stable thumbnail observers/cards, 160/190/145 ms motion, clipped filmstrip overflow, measured menu columns, 30 px rows, and a two-value native shadow looper.
- [ ] Run the focused test and confirm it fails because patch 0018 is absent.

### Task 3: Implement the shared smooth shadow

**Files:**
- Modify in external checkout: `chrome/browser/ui/views/ember/ember_glass_view.cc`
- Modify in external checkout: `chrome/browser/ui/views/ember/ember_glass_view.h`

- [ ] Replace the twelve solid shadow rectangles with two `gfx::ShadowValue` entries rendered through `gfx::CreateShadowDrawLooper`.
- [ ] Keep shadow painting outside the cached material bitmap and preserve current panel pixels.
- [ ] Reduce only the menu preset's outer rim strength while retaining light/dark separation.
- [ ] Build `ember_glass_view.obj` and run the focused contract.

### Task 4: Compact and measure webpage menus

**Files:**
- Modify in external checkout: `chrome/browser/ui/views/ember/ember_glass_overlay_controller.cc`
- Modify in external checkout: `chrome/browser/ui/views/ember/ember_glass_overlay_controller.h`

- [ ] Split row label, accelerator, and submenu indicator into aligned child views while preserving the original accessible name and activation callback.
- [ ] Measure all visible rows before layout, including optional icon/check and accelerator columns, with a bounded maximum rather than a fixed wide panel.
- [ ] Apply 30 px rows, 7 px inset, compact padding, separators, radius, disabled colors, and the existing subtle hover fill.
- [ ] Build the overlay controller object and run the focused contract.

### Task 5: Build the Opera-style thumbnail filmstrip

**Files:**
- Create in external checkout: `chrome/browser/ui/views/ember/ember_glass_switcher_card.cc`
- Create in external checkout: `chrome/browser/ui/views/ember/ember_glass_switcher_card.h`
- Modify in external checkout: `chrome/browser/ui/views/ember/ember_glass_overlay_controller.cc`
- Modify in external checkout: `chrome/browser/ui/views/ember/ember_glass_overlay_controller.h`
- Modify in external checkout: `chrome/browser/ui/BUILD.gn`

- [ ] Implement a focusable accessible card that subscribes to the tab's existing `ThumbnailImage`, crops the preview to 16:9, and paints a compact favicon/title footer.
- [ ] Create stable cards once per switcher opening and clip their horizontal strip to the panel viewport.
- [ ] Compute the selected-centered target offset with end clamping and partial neighboring cards.
- [ ] Retarget a 190 ms eased translation from the current visual offset on rapid forward/reverse input without rebuilding the cards.
- [ ] Add 160 ms open and 145 ms close opacity/scale/vertical animations; defer commit cleanup safely until closing completes.
- [ ] Build the new card and controller objects, then link `chrome.dll`.

### Task 6: Seal patch 0018 and verify native behavior

**Files:**
- Modify: `chromium/patches/ember/0018-ember-glass-overlay-refinements.patch`
- Modify: `test/chromium-port.test.js`

- [ ] Export the exact external-checkout diff as patch 0018 and validate hunk counts.
- [ ] Verify all applied patch postimages in the pinned external checkout.
- [ ] Run focused tests and `git diff --check`.
- [ ] Launch an isolated native profile on PL288H and test 2, 5, and overflowing tab counts, rapid forward/reverse input, repeated open/close, short/long context menus, and light/dark pages.
- [ ] Capture full-HWND before/after screenshots and an interaction recording; inspect them against the supplied Opera frames.

### Task 7: Adopt EmberGlass for eligible native menus

**Files:**
- Modify: `chromium/patches/ember/0019-ember-glass-menu-adoption.patch`
- Modify: `chromium/patches/series`
- Modify: `test/chromium-port.test.js`
- Modify in external checkout: only audited browser-owned menu entry points that expose a stable `ui::MenuModel`

- [ ] Inventory all eligible native browser context/action menus and explicitly exclude security, permission, system, and platform dialogs.
- [ ] Add failing routing contracts for the audited eligible entry points.
- [ ] Route each eligible model through `EmberGlassOverlayController::ShowMenu` without changing model ownership or commands.
- [ ] Build every touched object and `chrome.dll`, then exercise each adopted route in the native browser.
- [ ] Export and postimage-verify patch 0019.

### Task 8: Final acceptance and status

**Files:**
- Modify: `CHROMIUM_PORT_STATUS.md`
- Modify: `AGENTS.md`

- [ ] Run the complete Chromium patch test, full repository tests, Electron smoke gate, and the bounded native `chrome` target.
- [ ] Record exact build/test counts, runtime cases, artifact paths, observed performance, and any remaining Opera GX visual difference.
- [ ] Re-read the status documents and inspect the final diff before reporting completion.
