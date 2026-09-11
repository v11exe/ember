# Native browser-chrome repair — unfinished review checklist

Branch: `chromium-port`  
Patch: `chromium/patches/ember/0022-ember-browser-chrome-repair.patch`

## Implemented in the current patch

- [x] Reduce the close-button visual while retaining its full click target.
- [x] Reserve the close-button lane so hover does not reflow tab contents.
- [x] Center painted favicons in the tab content box.
- [x] Remove the gutter between split-tab partners.
- [x] Add split-tab segment geometry, seam indicators, and direct-pane focus
  painting.
- [x] Make split-tab hover pane-local.
- [x] Neutralize the blue New Tab ink-drop styling.
- [x] Add compact URL formatting for the idle sidebar address field.
- [x] Reset the sidebar address field caret/scroll position on idle refresh.
- [x] Keep full URLs as the source of truth for focus, copy, and navigation.
- [x] Attempt to keep Forward visible in normal mode while preserving Chromium's
  command-enabled state.
- [x] Restore the public Chrome Web Store launch URL constants only; leave the
  ungoogled update/API privacy boundary unchanged.
- [x] Add static contracts and focused native unit-test sources for the above.

## Open bugs confirmed during review

- [ ] Forward is still missing in the current runtime.
- [ ] The address bar still enters the wrong hover state when hovering the text
  itself.
- [ ] The Web Store link on the New Tab page still does not open.
- [ ] Extension installation is still rejected with “Install Chrome”; extensions
  cannot yet be installed into Ember.
- [ ] Native unit-test execution is blocked by unrelated upstream WebUI
  TypeScript failures before the changed test objects run.
- [ ] Full `npm test` and `npm run smoke` are still pending for this review run.

## Additional open parity issues reported after the initial handoff

- [ ] Tab title text is faded while idle; muted text should be hover-only.
- [ ] The tab close `X` lacks a clear hover state.
- [ ] Shortcut-removed toast, microphone permission bubble, tab preview,
  split-view menu, older tab context menus, and extensions popup still lack the
  approved liquid-glass treatment.
- [ ] Liquid-glass submenus need automatic width sizing; labels currently end
  in ellipses too often.
- [ ] Menu icons need to follow text colour changes on hover/selection.
- [ ] Extensions menu text and icons need the same colour-changing states.
- [ ] Dragging a tab over the Favorites rail does not create a Favorite.
- [ ] Native settings do not expose Favorites grid columns/rows, so the grid
  dimensions cannot be changed as in the Electron version.

These reports keep browser-chrome parity, menu glass coverage, Favorites drag
and drop, and Favorites grid settings explicitly incomplete.

## Verification recorded so far

- [x] `node chromium/tools/check-patch-hunks.js` passes all 22 patches.
- [x] Focused `test/chromium-port.test.js` contracts pass.
- [x] Direct native `chrome` build completes `[333/333] LINK chrome.exe`.
- [ ] Final runtime acceptance is not complete; this commit is intentionally an
  unfinished handoff for review and follow-up fixes.
