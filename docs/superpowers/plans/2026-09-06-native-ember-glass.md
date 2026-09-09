# Native EmberGlass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the approved native Skia EmberGlass PoC into reusable Chromium C++/Views overlay chrome for webpage context menus and the MRU Ctrl+Tab switcher.

**Architecture:** Capture the active renderer surface once when an overlay opens, reproduce the approved CPU/Skia blur-saturation-R/B displacement and RGB recombination into a cached panel bitmap, and paint interaction highlights as independent cheap Views animation layers. Keep Chromium's `ui::MenuModel`, command execution, tab model, native focus system, and normal HWND authoritative; place the overlay inside the existing browser contents container so no popup HWND or webpage UI is introduced.

**Tech Stack:** Chromium 151 C++/Views/Aura, Skia N32 bitmaps, `RenderWidgetHostView::CopyFromSurface`, `ui::MenuModel`, `TabStripModel`, Views animations, ordered Ember patch stack, Node contract tests, Ninja.

---

### Task 1: Lock the maintained-source contract

- [ ] Add failing tests for patches 0014–0016, the exact displacement asset hash, locked material values, panel-level bright adaptation, cached base rendering, context-menu model routing, and release-to-commit Ctrl+Tab behavior.
- [ ] Run `node --test test/chromium-port.test.js` and confirm the new assertions fail because the patches/resource do not exist.

### Task 2: Add the EmberGlass core and owned resource

- [ ] Add the approved Standard displacement JPEG to `chromium/resources/ember-glass/` with its MIT notice and manifest destination.
- [ ] Add patch 0014 with `ember_glass_material.{h,cc}` and `ember_glass_view.{h,cc}` plus GN/GRIT integration.
- [ ] Preserve the PoC equations: 36 px-equivalent blur, 140% saturation, R/B displacement selectors, scales -200/-220/-240, RGB recombination, 0.3-equivalent soften, rounded clip, feathered shadow and two-stage rim.
- [ ] Cache the decoded/scaled displacement and rendered panel base by bounds, parameters, backdrop generation and bright mode.
- [ ] Compile the focused EmberGlass translation units before continuing.

### Task 3: Integrate the native context-menu overlay

- [ ] Add patch 0015 with an in-contents `EmberGlassOverlayController` and menu panel/row Views.
- [ ] Route only normal Ember webpage context menus from `RenderViewContextMenuViews::Show()` into the overlay; retain `ui::MenuModel` as the source for labels, icons, enabled/checked state, submenus, accelerators, extension entries and command activation.
- [ ] Determine preferred size and clamp before showing, close on outside click/Escape, support arrows/Enter/submenus, and expose native accessibility roles/names.
- [ ] Capture/filter once per open or meaningful backdrop/bounds change; animate only the 160 ms EaseOutCubic hover capsule.
- [ ] Compile and run context-menu interaction tests across page/link/image/selection/editable and edge placement cases.

### Task 4: Integrate the native MRU Ctrl+Tab switcher

- [ ] Add patch 0016 with actual tab titles, domains and favicons, MRU ordering, and a centered EmberGlass panel.
- [ ] Intercept Chromium's existing next/previous-tab accelerator before blind activation, register Ctrl release, cycle without changing the active tab, commit on release, and cancel on Escape.
- [ ] Animate only the selection capsule over 200 ms EaseInOutCubic; do not recapture/recompute glass per Tab press.
- [ ] Compile and exercise forward, reverse, repeated, cancel and release-to-commit paths with 2, 4 and many tabs.

### Task 5: Visual, performance and lifecycle verification

- [ ] Compare basic panel, menu/hover and switcher/selection against Mountain, Ocean, Building, Night, bright browser and dark-video PoC scenes.
- [ ] Verify the panel-level 0.80 luminance threshold, 10–16% RGB(72,78,88) wash, one dark palette, no outlines, and stronger bright hover/selection rim.
- [ ] Instrument panel rebuild count/duration and prove pointer/selection animation does not rebuild the base.
- [ ] Verify overlay teardown, timers/animations, tab close while open, clean browser shutdown and no leaked Widget/window.

### Task 6: Reproduce, document and synchronize

- [ ] Mechanically generate ordered patches from exact 0013 postimages and append them to `chromium/patches/series`.
- [ ] Run patch hunk checks, focused tests, two prepares, applied-postimage verification, incremental native build, `npm test`, `npm run smoke`, and an ordinary `npm start` oracle boot.
- [ ] Update `CHROMIUM_PORT_STATUS.md`, `AGENTS.md`, and any completed-feature compatibility notes with exact commands/results and remaining differences.
