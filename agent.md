# Ember Agent Notes

## Current Architecture

- Electron 43, CommonJS, frameless `BaseWindow`, no compile/build step.
- Chrome, each tab, the extensions dropdown, and bounded glass overlays are separate
  `WebContentsView` instances; this separation prevents webpage black-out.
- Bookmark state is a versioned JSON document in Electron `userData`.
- Recent upload paths are capped, deduplicated, and atomically persisted in
  Electron `userData`; selected bytes are returned as real page `File` objects.
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
- `src/main/{floating-panel,upload-panel,context-menu-panel}.js`: bounded,
  captured-backdrop overlay infrastructure and real actions.
- `src/renderer/brand.*`: exact supplied icon/full-logo mounts.
- `src/renderer/chrome.*`: toolbar, inline folder navigation, bookmark bar.
- `src/renderer/pages/{newtab,extensions,upload,context-menu}.*`: internal pages.
- `test/fixtures/popup-extension-*`: real popup smoke fixtures.

## Build / Run Commands

- Install: `npm install`
- Run: `npm start`
- Unit/contracts: `npm test`
- Electron integration: `npm run smoke`
- Visual QA: `electron scripts/capture-ui.js <output-directory>`

## Branding

- Supplied images 3 and 4 are the canonical full-logo and icon assets.
- `mountIcon`, `mountBrand`, and the native window use those supplied PNGs.
- The prior generated approximation and personal-use font are removed.

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

- Real file-input clicks open a centered glass picker with matching existing
  recents, a live clipboard image tile, and a native Show all files fallback.
- Selections become genuine renderer `File` objects with source bytes, MIME,
  name, and modification time; directory inputs retain Chromium behavior.
- Repeated requests, Escape, tab changes, page focus, and resize are bounded.

## Context Menu

- Page right-clicks open a clamped captured-backdrop glass menu.
- Link/image/selection/editing/spelling/navigation/save/print/source/inspect
  commands route to real WebContents, clipboard, dialog, and tab operations.
- Disabled states come from Chromium; arrows, Home/End, Enter, and Escape work.

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
- Pending backdrop capture could resurrect a dismissed overlay.
- The first context-menu render used the wrong glass wrapper and overflowed.

## Changes Completed

- Canonical supplied branding assets integrated byte-for-byte.
- Real upload picker and liquid-glass custom context menu implemented.
- Bookmark store, import, compact bar, nested folder navigation, and live layout
  updates implemented.
- Extension launcher/accessibility, panel polish, black-page regression, and
  popup geometry hardened.
- Internal pages now declare restrictive content security policies.

## Tests Performed

- `npm test`: 51 tests pass.
- `npm run smoke`: covers real page file inputs, clipboard/recents/native
  fallback, cancellation, custom right-clicks at four corners, link commands,
  extensions/popups, bookmarks, and four window sizes in isolated userData.
- `node --check`: all project JavaScript files parse.
- Visual captures: new tab/chrome at wide, medium, compact; upload at 650×430
  and 596×312; context menu at 318×430, all without document overflow.

## Remaining Issues

- History and download-manager milestones remain outside this change.
- `npm audit --omit=dev` reports the upstream `adm-zip <0.6.0` advisory through
  `electron-chrome-web-store`; npm reports no available fix.
