# Adaptive Favorite Grid Design

## Goal

Make Ember's quick-site rail fully user-owned after first launch. The three current
starter sites remain the initial defaults, while the configured grid dimensions,
site order, and later drag operations persist exactly as the user leaves them.

## Grid configuration

- Add Favorite grid width and height controls to Settings.
- Width is configurable from 1 through 4 columns.
- Height is configurable from 1 through 7 rows.
- The default remains 2 columns by 2 rows.
- Capacity is `columns * rows`.
- The grid fills the existing sidebar content width.
- Its maximum vertical footprint is the current tile geometry at 2 columns by
  4 rows. Rows 1–4 retain the current 43px tile height. Rows 5–7 compress tile
  height and spacing within that footprint.
- The favicon remains 19px at every supported size. Four columns and seven rows
  are the supported maxima because a denser layout would force icon shrinkage.
- Configuration changes animate tile dimensions, spacing, and position.

## Persistent data

- Store `favoriteGrid: { columns, rows }` in Ember settings with a sanitized
  default of `{ columns: 2, rows: 2 }`.
- Continue storing Favorites as an ordered array. Sanitize the list against the
  configured capacity when settings are loaded or the grid is resized.
- Google, YouTube, and Calendar seed a profile only when no Favorites preference
  has ever been stored. An explicitly empty or edited list remains empty or edited.
- When capacity is reduced, preserve the first entries in visual reading order and
  remove overflow entries from the quick-site list only; matching tabs remain open.

## Drag and insertion behavior

- Every configured grid cell is a generous drop target, including empty cells.
- The insertion index is the hovered cell's reading-order index.
- With spare capacity, a dropped new site is inserted at that index and later
  entries shift forward.
- At full capacity, a dropped new site replaces the entry at the hovered index.
- Dragging a site already present reorders that existing entry instead of creating
  a duplicate. It uses insertion behavior and never replaces or removes another
  entry merely because the grid is full.
- Dropping a tab keeps that tab open and stores its exact HTTP(S) URL, title, and
  favicon. Same-site identity continues to prevent duplicate quick sites.
- During dragover, render the proposed order immediately. Use FLIP-style position
  animation plus CSS size transitions so neighboring tiles move smoothly.
- Cancelled drags restore the persisted order without writing settings.
- A successful drop persists the final list once and broadcasts it to every window.

## UI and accessibility

- Keep current sidebar width, shell geometry, default tile dimensions, and 19px
  favicon size.
- Empty cells remain visually quiet until a compatible tab or Favorite is dragged.
- Dragover feedback is restrained and uses the existing neutral Favorite surfaces.
- Settings controls show the resulting capacity and use ordinary numeric/select
  controls consistent with the existing settings page.
- Right-click removal, open-site state, clicking/waking matching tabs, hibernation,
  and sidebar collapse keep their current behavior.

## Architecture

- `src/shared/favorites.js` owns grid sanitization, capacity, insertion, replacement,
  and existing-Favorite reorder as pure functions.
- `src/main/settings.js` persists `favoriteGrid` and sanitizes Favorites against its
  current capacity.
- Named IPC carries the intended insertion index for tab pinning and Favorite
  reordering. Main remains authoritative and never trusts renderer-provided URLs.
- `src/renderer/sidebar.js` computes hovered cells and produces an in-memory preview;
  main commits only on drop.
- `src/renderer/sidebar.css` derives columns, rows, tile width, tile height, and gap
  from CSS variables supplied by the sanitized configuration.

## Error handling

- Invalid dimensions fall back independently to the 2×2 defaults and are clamped
  to 1–4 columns and 1–7 rows.
- Invalid insertion indexes clamp to the configured reading-order range.
- Internal/non-HTTP tabs remain invalid drop sources.
- If persistence fails, retain the previously committed settings and restore the
  renderer from the next authoritative configuration broadcast.

## Verification

- Pure tests cover grid sanitization, capacity reduction, insertion, replacement,
  same-site reorder, and index clamping.
- Settings tests cover first-run defaults, empty-list persistence, dimension
  persistence, and restart behavior.
- Renderer contract tests cover dynamic CSS variables, empty-cell targets, preview
  animation, and indexed drop IPC.
- Live QA covers 1×3, 2×2, 2×4, 4×7, dimension animation, insertion shifting,
  full-grid replacement, cancellation, removal, sidebar collapse, and restart.
- Run focused tests, `npm test`, and `npm run smoke`.
