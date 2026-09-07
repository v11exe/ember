# Native EmberGlass Overlay Refinements

## Scope

Refine the existing native Chromium EmberGlass overlays without changing the
accepted capture, blur, displacement, tint, cache, or fallback behavior delivered
by patches 0014–0017.

## Ctrl+Tab

Match the supplied Opera GX recording with a clipped horizontal filmstrip of
equal-size, 16:9 page previews. The selected card remains centered or as close to
center as the ends permit; adjacent cards remain partially visible. Each card has
a compact favicon/title footer. A stable set of card views survives selection
changes, while a cheap transform/offset animation retargets from its current
interpolated position during rapid forward or reverse presses. Opening fades and
eases from a slight scale/vertical offset in 160 ms. Selection movement uses a
190 ms fast ease. Ctrl release commits the selected tab and begins a 145 ms
fade/scale close without changing the existing key-release semantics.

Use Chromium's existing `ThumbnailImage` subscription path, already used by tab
hover cards, so previews are cached and asynchronous. Missing previews retain a
quiet placeholder; they never trigger synchronous page captures or glass
recomputation.

## Context menu

Replace the fixed 296 px menu width and 36 px row rhythm with measured visible
content. Separate leading icon/check space, primary label, accelerator, and
submenu arrow into aligned regions. Use 30 px rows, 7 px outer inset, compact
horizontal padding, subtle separators, and a proportionate 12 px corner radius.
Clamp only to a practical maximum width. Keep keyboard navigation, accessibility
names, enabled state, submenu behavior, and command dispatch unchanged.

## Shared shadow and edge

The current pixelation comes from twelve individually visible opaque rounded
rectangles with stepped geometry and alpha. Replace them with Chromium/Skia's
native blurred draw-looper path using two shadows: a tight contact shadow and a
broad low-opacity ambient shadow. Paint them in device-aware vector space around
the panel, not into or by scaling the cached glass bitmap. Retain a restrained
outer/inset rim, with a lower menu rim intensity. All `EmberGlassView` consumers
inherit the same primitive.

## Follow-on native menu adoption

After the three refinements pass, route eligible browser-owned MenuModel context
menus through the existing controller, starting with the tab context menu and
other ordinary browser content/action menus. Preserve security, permission,
system, native-shell, and platform dialogs on their established paths. Each
adopted route retains its original model, commands, accessibility, and lifecycle.

## Acceptance

Focused tests precede implementation. Build every touched object and `chrome.dll`,
then exercise the actual native HWND on PL288H with 2, 5, and overflowing tab
counts; rapid forward/reverse cycling; repeated open/close; short/long menus; and
light/dark pages. Capture native screenshots and an interaction recording, verify
the maintained patch series against the applied checkout, run the focused port
suite and Electron gates, and update `CHROMIUM_PORT_STATUS.md` and `AGENTS.md` with
only observed results.
