# Native Top-Bar Density Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the erroneous top/left native content inset, separator and one-pixel toolbar overshoot so Chromium matches Ember's measured 32 px Electron top bar.

**Architecture:** Add patch 0013 on top of the existing native Chromium patch stack. Change only `BrowserViewTabbedLayoutImpl` so Ember normal windows retain the 8 px right/bottom frame, suppress the redundant contents separator, cap the toolbar at 32 px and place contents directly against the 168 px sidebar and 32 px top row; preserve all native Chromium controls and lifecycle owners.

**Tech Stack:** CommonJS `node:test`, ordered Chromium patch files, Chromium C++/Views, Ninja, Windows UI Automation/CDP.

---

### Task 1: Lock the corrected geometry contract

**Files:**
- Modify: `test/chromium-port.test.js`

- [ ] **Step 1: Add patch 0013 to the exact ordered-series assertion**

Append `'ember/0013-ember-tighten-top-bar-density.patch'` after patch 0012.

- [ ] **Step 2: Add the focused contract test**

Read patch 0013, assert that its only touched file is
`chrome/browser/ui/views/frame/layout/browser_view_tabbed_layout_impl.cc`, and
assert that it replaces the uniform inset with
`gfx::Insets::TLBR(0, 0, kEmberPageInset, kEmberPageInset)` while continuing to
inset both `params` and `unclipped_contents_region`. Assert that normal Ember
layout suppresses `multi_contents_separator` and caps `toolbar_bounds` at
`kEmberTopChromeHeight`.

- [ ] **Step 3: Verify RED**

Run `node --test test/chromium-port.test.js`. Expected: failure because patch
0013 is absent from the series and filesystem.

### Task 2: Implement the minimal native layout correction

**Files:**
- Create: `chromium/patches/ember/0013-ember-tighten-top-bar-density.patch`
- Modify: `chromium/patches/series`
- Modify externally: `C:/src/ember-chromium/configuration/build/src/chrome/browser/ui/views/frame/layout/browser_view_tabbed_layout_impl.cc`

- [ ] **Step 1: Add patch 0013**

Replace `const gfx::Insets content_insets(kEmberPageInset);` with:

```cpp
const gfx::Insets content_insets =
    gfx::Insets::TLBR(0, 0, kEmberPageInset, kEmberPageInset);
```

Do not modify the two consumers of `content_insets`.

For the normal Ember/sidebar layout, disable the native top separator and cap
`toolbar_bounds` at `kEmberTopChromeHeight`.

- [ ] **Step 2: Append patch 0013 to `chromium/patches/series`**

Keep all prior entries byte-for-byte and add the new patch once at the end.

- [ ] **Step 3: Verify GREEN and deterministic preparation**

Run `npm run chromium:check-patches`, the focused Node suite, and two consecutive
`prepare --work-root C:\src\ember-chromium` passes. Expected: all 13 patches
validate; both prepares report stable managed state.

### Task 3: Compile and visually verify on PL288H

**Files:**
- Modify: `CHROMIUM_PORT_STATUS.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Refresh the live Electron reference**

Run `npm start` with remote debugging, place the restored Electron window at
`-1870,274,1570×796` on PL288H, capture the whole window, and record the live
top/page boundary plus navigation, tab and New Tab bounds. Keep the immutable
oracle files pinned; store this as external working evidence for the correction.

- [ ] **Step 2: Compile the touched native target**

Build the layout object, then resume the necessary native UI/browser link
targets using the pinned VS/depot_tools environment. Expected: Ninja exits 0.

- [ ] **Step 3: Run the fresh-profile interaction check on PL288H**

Launch the built browser with remote debugging, place its normal HWND at
`-1870,274,1570×796`, and verify page x=168/y=32, 32 px top strip, 30×30 New Tab,
28×28 Extensions, tight navigation/tab positioning, no separator band and one
continuous shell material. Invoke New Tab and open Extensions once.

- [ ] **Step 4: Run repository gates**

Run `node --test test/chromium-port.test.js`, `npm test`, `npm run smoke`, and a
bounded `npm start` boot on PL288H. Expected: all pass or only the documented
host no-frame smoke skips occur.

- [ ] **Step 5: Record and synchronize**

Update the native-port ledger and Work Log with exact evidence, fetch/rebase
`origin/chromium-port`, commit with `chromium: tighten native top bar`, push, and
confirm local/remote commit equality. Stop without selecting another slice.
