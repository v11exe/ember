# Native browser-chrome repair — unfinished review checklist

Branch: `chromium-port`  
Patch: `chromium/patches/ember/0024-ember-browser-chrome-corrective.patch` (on top of 0023)

## Corrective pass applied

- [x] Give split-view glass rows a measured trailing-content budget so labels
  are not physically clipped after elision is disabled.
- [x] Correct the remaining legacy inactive-tab foreground path so idle titles
  retain normal contrast and only hover can apply the muted treatment.
- [x] Track close-button pointer enter/exit/capture-loss explicitly while
  retaining ink-drop behavior, restoring a clear compact X hover state.
- [x] Establish the extensions Manage button's enabled text palette and its
  disabled settings-icon model so icon and label states change together.

## Narrow cleanup pass applied

- [x] Restore normal contrast for idle tab titles; keep the muted treatment
  hover-only.
- [x] Add compact close-button hover/pressed feedback without changing the
  button's full hit target.
- [x] Remove the duplicate textfield-local address hover ink drop.
- [x] Widen shared glass-menu sizing and disable submenu label elision.
- [x] Recolour generic glass-menu vector icons with their text states.
- [x] Recolour extensions-menu text and vector icons for normal, hover,
  pressed, selected and disabled states.

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
- [ ] Full `npm test` and `npm run smoke` remain outside this narrow native
  cleanup verification.

## Additional open parity issues reported after the initial handoff

- [x] Tab title text is no longer faded while idle; muted text remains
  hover-only in both foreground paths.
- [x] The tab close `X` now has an explicit compact hover state.
- [ ] Shortcut-removed toast, microphone permission bubble, tab preview,
  split-view menu, older tab context menus, and extensions popup still lack the
  approved liquid-glass treatment.
- [x] Liquid-glass submenus now reserve measured trailing content width; the
  split-view rows no longer rely on a no-ellipsis setting alone.
- [ ] Menu icons need to follow text colour changes on hover/selection.
- [x] Extensions menu text and settings icon now share enabled/hover/pressed/
  disabled colour states.
- [ ] Dragging a tab over the Favorites rail does not create a Favorite.
- [ ] Native settings do not expose Favorites grid columns/rows, so the grid
  dimensions cannot be changed as in the Electron version.

These reports keep browser-chrome parity, menu glass coverage, Favorites drag
and drop, and Favorites grid settings explicitly incomplete.

## Verification recorded so far

- [x] `node chromium/tools/check-patch-hunks.js` passes all 24 patches.
- [x] Focused `test/chromium-port.test.js` contracts pass.
- [ ] Direct native `chrome.dll` link is blocked by permission denied while a
  running `chrome.exe` holds the output; all nine affected objects compile.
- [x] Clean-profile native launch succeeds and the idle browser shell is
  captured on the secondary display.
- [ ] Native mouse-driven hover/menu screenshots for all six paths remain
  pending because the available UI surface did not expose native Views input;
  the changed states are covered by the focused source contracts and affected
  object compilation. The final DLL link is blocked by the running browser's
  file lock.
