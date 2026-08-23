# Ember unified shell design

## Status and source of truth

This design implements the user-approved target in `image-2.png` and the complete
51-section pasted brief supplied on 2026-08-23. The current screenshot is only a
before-state. The Arc screenshot may inform the weight of small glyphs, but none
of its layout, labels, folders, tabs, colours, or branding may enter Ember.

The change also completes Roadmap #7, Instant / Favorite sidebar buttons. The
sidebar remains a feature rail rather than a vertical tab list. It starts with
Google, YouTube, and Calendar, can be edited in Settings, reuses a matching open
tab, wakes a matching sleeping tab through normal selection, and leaves space
for later sidebar utilities.

## Chosen architecture

The existing chrome `WebContentsView` becomes a full-window transparent
underlay. It paints four connected shell regions—top chrome, sidebar/left rail,
right rail, and bottom rail—against one viewport-aligned smouldering gradient.
The centre remains transparent so internal glass pages continue to reveal the
existing native backdrop without a new tint, blur, capture, or compositing path.

The active page `WebContentsView` is stacked above that underlay and inset by a
single shared geometry contract. Electron's native `View.setBorderRadius()`
clips the real page surface. This is preferable to CSS corner masks because it
clips Chromium pixels directly, and preferable to putting a full-window chrome
view above the page because that would intercept page input. Dropdown and
floating views keep their existing explicit topmost lifecycle.

Alternative approaches considered and rejected:

- Separate top and sidebar renderers avoid a rectangular overlay, but duplicate
  state, gradient alignment, focus, animation, and visual-QA plumbing.
- A full-window chrome renderer above the page can draw everything in one DOM,
  but repeats the prior black-overlay/pointer-interception failure mode.
- CSS-only page masks cannot clip a native `WebContentsView`; Electron 43's
  native border-radius API is the direct, supported solution.

## Geometry and motion

A pure shared geometry module owns the 52 px top chrome, 170 px open sidebar,
8 px collapsed/outer rail, 8 px right and bottom inset, 9 px page radius, and
210 ms sidebar transition. `TabManager.layout()` consumes it for every resize,
tab wake/select, bookmark visibility change, sidebar toggle, and maximize/
restore event. The chrome CSS consumes matching custom properties.

The sidebar renderer animates its rail width and content opacity. The main
process animates the active native view's bounds over the same duration and
easing. Ordinary window resize remains immediate. The sidebar toggle lives in
the top chrome rather than inside the collapsing body, so it is always reachable.

Windows uses Electron's native Window Controls Overlay at 52 px. The chrome
reserves the reported/native caption area and keeps only the extensions/app
action immediately before it. Restored windows use native rounded corners and
shadow; maximized windows remove CSS shell rounding while keeping the inset page
geometry coherent.

## Chrome components and behavior

The single top row contains, in order: Ember white-stroke mark and sidebar
toggle; Back, Forward, Reload; natural-width tabs; New Tab; a flexible drag
spacer; conditional archive action; extensions/app action; native caption
controls. All controls opt out of the draggable region.

The old permanent toolbar, bookmark button, extensions puzzle button, and
always-visible omnibox disappear. `Ctrl+L` still focuses the existing omnibox
logic, now presented as a compact transient command surface over the top row.
Quick-search chips and Tab-to-search therefore remain intact. The bookmarks bar
continues to exist only when explicitly toggled by its shortcut; it is not part
of the default two-row layout.

Tabs use content width capped by a dynamic maximum computed from available
strip width, count, gaps, the plus button, and a protected drag reserve. Long
titles use a mask fade only when measured as overflowing. The close button is
an opacity-only overlay on hover, never a permanent width reservation. Sleeping
tabs receive their own low-contrast surface, grayscale favicon, and compact Z
indicator. Selected tabs use a restrained dark fill with orange border/glow.
The New Tab fallback uses `assets/icon-white-stroke.png`; other tabs retain real
favicons.

## Favorites and persistence

`src/shared/favorites.js` defines three defaults and sanitizes user entries.
Settings persists the ordered list and sidebar-open state atomically. Chrome
receives live configuration through named IPC channels. Clicking a Favorite asks
main to find a tab with the same normalized origin; if found it selects it (and
normal hibernation logic wakes it), otherwise it creates a tab. The active tile
is derived from the selected tab URL. A small Settings editor supports add,
edit, remove, reset, and ordered persistence without changing the target
sidebar's label-free appearance.

## Error handling and compatibility

Malformed Favorite URLs are discarded by shared sanitization. Failed favicon
loads fall back to the site's `/favicon.ico` and then the Ember white-stroke
mark without blocking navigation. Favorite activation uses normal `TabManager`
selection/creation, so history, session restore, extensions, thumbnails,
hibernation, and recently-closed behavior stay on their established paths.

Future Split View, Follower, and floating-page features must request page bounds
from the shared geometry contract and keep every visible page non-discardable.
Future adaptive/page-tinted chrome may modify the shell material, but must not
turn the sidebar into tab storage or paint beneath native-glass content.

## Verification

Tests cover geometry at open/collapsed/maximized sizes, dynamic tab caps,
Favorite sanitization/matching/reuse, preload IPC, and DOM/CSS contracts. Runtime
validation captures the posed 1570x796 chrome, then launches Ember and compares
the actual window against the target at wide and resized dimensions. The final
gates are focused tests, `npm test`, `npm run smoke`, and an interactive
`npm start` launch with sidebar, hover, resize, maximize/restore, navigation,
tab lifecycle, and native page-corner checks.

