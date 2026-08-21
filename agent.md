# Ember Agent Notes

## Current Architecture

- Electron 43, CommonJS, frameless `BaseWindow`, no compile/build step.
- Chrome, each tab, and the extensions dropdown are separate
  `WebContentsView` instances; this separation prevents webpage black-out.
- Bookmark state is a versioned JSON document in Electron `userData`.
- Extension popups remain real child windows and are bounded by Ember after the
  extension package computes their preferred size.

## Current UI State

- The established 38 px tab strip, 46 px toolbar, dark theme, orange accents,
  centered new-tab composition, and top-right extension panel are preserved.
- The bookmarks bar adds 30 px only while visible; page bounds and panel origin
  update immediately when it is toggled.

## Important Files

- `src/main/bookmarks.js`: parser, merge policy, persistence.
- `src/main/popup-positioner.js`: real popup event integration.
- `src/shared/popup-geometry.js`: pure viewport collision calculation.
- `src/renderer/brand.*`: reusable icon/wordmark implementation.
- `src/renderer/chrome.*`: toolbar, inline folder navigation, bookmark bar.
- `src/renderer/pages/{newtab,extensions}.*`: internal page renderers.
- `test/fixtures/popup-extension-*`: real popup smoke fixtures.

## Build / Run Commands

- Install: `npm install`
- Run: `npm start`
- Unit/contracts: `npm test`
- Electron integration: `npm run smoke`
- Visual QA: `electron scripts/capture-ui.js <output-directory>`

## Branding

- Supplied image 3 is the canonical visual reference.
- `mountIcon`, `mountWordmark`, and `mountBrand` are independently reusable.
- The supplied Necosmic OTF renders the canonical EMBER glyphs and replaces the
  generic system-font heading on the new-tab page.
- Confirm redistribution rights for the personal-use font before a public or
  commercial binary release.

## New Tab Page

- Preserves icon → wordmark → search → six shortcuts → footer.
- Wide, medium, and 620×336 short-window captures fit without document overflow.
- Upper-right ambient glow and black background remain restrained.

## Toolbar / Tabs

- Baseline chrome remains 84 px; visible bookmarks make it 114 px.
- Tab page bounds use the live chrome height, so toggling bookmarks leaves no
  stale inset.

## Dropdowns

- Extensions panel uses rounded, warm translucent surfaces and compact rows.
- The panel top follows the live chrome height and remains inside all tested
  window sizes.

## Clipboard / File UI

- This repository has no Ember-owned clipboard/file panel to restyle.
- Bookmark import deliberately uses Electron's native file dialog.

## Bookmarks

- Chromium/Netscape bookmark HTML import preserves nested folders, titles,
  decoded exact URLs, and optional exported icons.
- Imports append to the single existing tree; malformed or failed writes leave
  both disk and in-memory state unchanged.
- Folder navigation stays inside the compact bar; horizontal overflow scrolls.
- `Ctrl+Shift+B` and the toolbar bookmark button toggle visibility.

## Extensions

- Root black-page cause: expanding the chrome view painted over page pixels;
  the dedicated panel view retains normal webpage rendering.
- Reproduced contract bug: `chrome.js` called an unexposed `togglePanel` bridge.
- Duplicate icon strip remains removed; icon/name metadata is one accessible
  launcher and Remove remains independent.
- Main broadcasts panel visibility, so the toolbar button's expanded state
  stays correct after toggles, Escape, and page-focus dismissal.
- Popup position prefers left/inward, clamps on creation and resize, and
  constrains oversized popups without CSS scaling.

## Bugs Reproduced

- Missing preload `togglePanel` method.
- Undefined, unused `IPC.CHROME_OVERLAY` bridge.
- Third-party popup placement lacked parent-window collision handling.
- Short 620×336 new-tab view overflowed before the responsive pass.
- Panel origin did not account for a visible bookmarks bar.

## Changes Completed

- Branding components and supplied font integrated.
- Bookmark store, import, compact bar, nested folder navigation, and live layout
  updates implemented.
- Extension launcher/accessibility, panel polish, black-page regression, and
  popup geometry hardened.
- Internal pages now declare restrictive content security policies.

## Tests Performed

- `npm test`: 18 tests pass.
- `npm run smoke`: boots Electron, keeps a rendered page visible under the
  panel, targets two real fixtures by extension ID, interacts with one popup,
  switches to an oversized popup, verifies scrolling, and checks 4 window sizes.
- `node --check`: all project JavaScript files parse.
- Visual captures: 1280×736, 900×556, and 620×336 new tab; chrome at 1280,
  900, and 620 px widths.

## Remaining Issues

- No Ember-owned clipboard/file panel exists in this milestone.
- History and download-manager milestones remain outside this change.
- `npm audit --omit=dev` reports the upstream `adm-zip <0.6.0` advisory through
  `electron-chrome-web-store`; npm reports no available fix.
