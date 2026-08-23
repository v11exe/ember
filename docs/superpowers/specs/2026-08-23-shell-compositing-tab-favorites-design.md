# Shell compositing, tab drag, and Favorite interactions

## Scope

This is a correction pass over Ember's existing unified shell. It preserves the
32px top bar, 168px sidebar, 12px accepted radii, navigation and chrome icon
sizes, 69×43px Favorite tiles, tab height and width rules, sidebar capacity, and
window proportions. It does not change the translucent new-tab material.

The pass fixes the native-view corner artifacts, replaces the broad muddy shell
colour with localized upper-left Ember illumination, removes competing orange
frame treatments, restores legible white-stroke Ember icons, and adds tab
reordering plus Favorite pin/open/remove behavior.

## Current architecture and root causes

Ember uses a transparent frameless `BaseWindow` composed from bounded
`WebContentsView`s: top chrome, sidebar, active page, right and bottom frame,
and four page-corner masks. The page cannot be reliably clipped by CSS because
it is a native child surface. Electron's native `View.setBorderRadius()` also
leaves cutout pixels participating in hit testing, so Ember's four mask views
remain necessary for both appearance and forwarded page input.

The visible artifacts have three concrete sources:

1. Top chrome, sidebar, frame views, and corner masks paint independent colour
   fields. Their gradients and solid mask colours do not represent one shared
   window-coordinate material.
2. The bottom and right frame gradients both intensify toward the bottom-right,
   creating the doubled orange rectangular protrusion.
3. The provided white-stroke icon has a 2175×723 canvas and transparent vertical
   padding. Scaling that entire canvas into a tiny fixed slot reduces the mark
   to a damaged streak.

## Considered approaches

### A. Full-window shell WebContentsView behind the page

One renderer could own the gradient and outline. This is the simplest visual
model, but Ember previously found that a WebContentsView beneath the transparent
new-tab page composites black on Windows. It also expands a bounded chrome view
under page content, violating an established compositor guardrail. Rejected.

### B. CSS-only border radii around a page wrapper

This would be small, but cannot clip a sibling native WebContentsView. It would
leave the actual Windows page pixels square. Rejected.

### C. Synchronized bounded surfaces (selected)

Keep the native view layout, but render one shared shell material in absolute
window coordinates across every exposed surface. Main sends each surface its
window size and view origin whenever layout changes. A shared stylesheet uses
the same background image, full-window background size, and negative view-origin
offset. Corner masks reveal that exact material outside the page radius. Frame
segments use one controlled edge treatment and a single bottom-right owner, so
no two orange treatments overlap.

This retains the known-good transparency path while making the separate native
surfaces visually behave as one shell.

## Shell material and radii

`src/shared/chrome-layout.js` remains the authoritative geometry source.
Renderer CSS mirrors those values only through named custom properties. All
outer surfaces use `OUTER_RADIUS`; active page views and mask cutouts use
`VIEWPORT_RADIUS`; frames use `SHELL_INSET`.

A shared shell-material stylesheet defines layered radial illumination over a
warm near-black base. The hottest source stays near the upper-left, falls off
quickly down the sidebar and across the first tabs, and leaves the right and
bottom near neutral black. Chrome, sidebar, frames, and masks do not define
independent large gradients.

The transparent BaseWindow implementation remains unchanged. Roots in every
shell renderer stay transparent. The BaseWindow content view keeps the native
outer radius. Decorative surfaces clip to their own relevant radius and never
use negative insets.

The outside edge is a dark one-pixel silhouette with a restrained internal
orange reflection. Edge segments share one style source; the bottom segment
owns the bottom-right turn while the right segment stops before the bottom
frame, preventing a doubled corner. The page itself receives only a subtle
neutral separator. The page-corner masks paint synchronized shell material
outside their radial cutout and remain transparent over the actual page.

## Ember icon rendering

Create a tightly cropped derivative of `assets/icon-white-stroke.png` from its
alpha bounds without stretching or changing visible artwork. Both the upper-left
brand control and new-tab favicon use the derivative with `object-fit: contain`
and intrinsic aspect ratio. Their accepted containing boxes stay unchanged.

## Tab drag and reorder

Tabs use Chromium HTML drag-and-drop because the source tab strip and Favorite
drop target live in separate native WebContentsViews. The browser supplies the
movement threshold, so an ordinary click still selects. Drag start writes only
an Ember-specific tab id to `DataTransfer`, installs a custom Ember tab drag
image, and suppresses the browser's generic page thumbnail. Tabs and controls
remain `-webkit-app-region: no-drag`.

Within the strip, dragover computes insertion from tab midpoints. The renderer
previews order with FLIP-style 120–180ms transforms; main owns the committed
array order through a new `TabManager.move()` contract. Reordering never
touches a tab's view, renderer, active id, sleep state, history, or thumbnail.
Close buttons do not initiate drags. Session serialization already preserves
array order, so restored sessions retain the committed order.

## Tab-to-Favorite pinning

The complete Favorite grid is a drop target. Main validates the dropped tab id
and accepts only ordinary HTTP(S) pages. A new Favorite stores the exact current
page URL, title, and favicon. Origin/site identity is used only for duplicate
detection, open-state matching, and tab reuse. Pinning never closes, moves, or
wakes the source tab.

If the same site already exists, the list remains unchanged and the existing
tile receives a short satisfied-state pulse. If capacity is full or the page is
not pinnable, the drop is rejected without changing persistence. Successful
changes go through `SettingsStore`, synchronize across open Ember windows, and
broadcast the existing chrome configuration update.

## Favorite state, opening, and removal

A Favorite is marked `is-open` when any current tab, including a sleeping or
background tab, matches its normalized site identity. Because both chrome and
sidebar already receive every emitted browser state, navigation, open, close,
restore, sleep, and selection changes update the state immediately. The lighter
surface is neutral, not orange.

Clicking continues to select the first matching tab, waking it through ordinary
`tabs.select()` behavior, or creates a tab at the stored exact URL.

Right-click opens Ember's existing styled floating context-menu surface with a
single “Remove quick site” action anchored to the sidebar tile. Removing a
Favorite updates settings and reflows the grid but does not close matching tabs.

## Error handling and safety

- Renderer drag payloads contain only a tab id; main re-reads live tab data.
- Non-HTTP(S), destroyed, or missing tabs are rejected for pinning.
- Favorite sanitization remains the final validation and deduplication layer.
- A full Favorite list returns an explicit non-mutating result.
- A drag canceled outside valid targets restores the renderer order from main.
- Context-menu actions verify the menu sender and the live Favorite id.

## Verification

Automated coverage will prove tab-model movement preserves identity and sleep
state; Favorite exact-URL creation, site deduplication, capacity, open matching,
and removal; IPC/preload exposure; shared shell metrics; context-menu behavior;
and renderer contracts for custom drag feedback and transparent roots.

Visual validation will run Ember and capture the real composed window at normal
and resized dimensions. It will inspect all four outer and page corners at high
zoom, the bottom-right frame ownership, gradient continuity, edge intensity,
both white-stroke icons, open Favorite state, reorder feedback, sidebar drop
feedback, and the one-action removal menu. Sidebar collapse/expand will be
exercised while watching masks and frame segments track every intermediate
layout frame.

## Roadmap compatibility

This refines completed roadmap feature #7. Its guardrail changes from “selected
Favorite follows only the active tab” to “open Favorite follows any matching
tab,” as explicitly required by this pass. Favorites remain shortcuts rather
than a second tab strip. Hibernated tabs are reusable but Favorites never keep a
renderer alive. Future workspace/profile scoping must apply site matching within
the correct browsing context. Horizontal tab order remains the physical strip
order used by indexed shortcuts and session restore; the MRU Ctrl+Tab switcher
remains independent.
