# Native Compact Top-Chrome Implementation Plan

**Goal:** Put Chromium's real horizontal tabs and toolbar controls into one
32 px Ember row, with the measured tab geometry, without replacing browser,
tab, navigation, menu or caption systems.

**Architecture:** Add patch 0009 on top of the built sidebar/Favorites stack.
Use existing layout constants, `BrowserViewTabbedLayoutImpl`, `ToolbarView`,
`HorizontalTabStripRegionView` and `TabStyle`; do not add a parallel chrome UI.

### Task 1: Lock the patch contract

Add a focused native-port test for the new ordered patch, one-row layout,
32/28/30 px geometry, 102/70 px tab-strip reservations, 95–190 px tab sizing,
8 px gaps, 6 px radii, hidden duplicate avatar/tab-search controls and preserved
security/model boundaries. Run it red before implementation.

### Task 2: Build patch 0009 mechanically

Snapshot the exact post-0008 files, make the bounded `.cc` changes in the
prepared checkout, and generate patch 0009 from the before/after images. Keep
the stock location bar alive but visually covered as the flex spacer/omnibox
model used by the sidebar address field.

### Task 3: Compile and run one practical pass

Prepare once, compile the five directly affected objects, resume the preserved
native targets, and launch a fresh 900×556 profile. Confirm the tab strip and
navigation share one 32 px row, tabs/new-tab/menu remain actionable, sidebar
geometry is unchanged, and shutdown is clean.

### Task 4: Record and synchronize

Update the native ledger and Work Log, run patch/focused/full/smoke checks,
reconcile `origin/chromium-port`, commit and push. Defer fine-grained motion and
exhaustive viewport matrices unless the practical pass exposes a real problem.

## Result

Completed on 2026-09-04 as patch 0009. Six focused objects compiled; the final
preserved resume completed 338/338 native actions and both packages. The single
900×556 pass measured the 32/28/30 px row, invoked Reload/New Tab/menu expansion,
caught and removed the duplicate Chromium bookmarks row, retained the sidebar
bounds, captured the final HWND, and ended with no profile processes or locks.
