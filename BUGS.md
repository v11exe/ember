# Ember defects

The active native issues are below. B1–B43 are retained as a compact index to the Electron-era tracker on `main` and Git history; their original statuses are historical, not claims about native runtime verification. Keep IDs stable.

## Native issues awaiting the user's linked build


- **B57 - Accepted glass polish (source fixed in 0060, awaiting linked runtime):** Slightly reduce shell tint; remove doubled top-container/toolbar paint and normal caption-button resting fill; retain shell tint outside the rounded viewport. Sidebar search now paints hover/press/open feedback. Native provider icons fetch uncached configured favicons instead of retaining duplicate magnifiers, and copy/close hover feedback is square. Verify caption transparency over white/colored backgrounds, four viewport corners, all provider icons and pointer feedback after linking.

- **B56 - Opaque shell and tall favicon capsule (0059 transparency runtime approved; remaining polish tracked in B57):** The Windows host's custom-titlebar veto overrode earlier DWM/root changes and restored opaque compositor roots. Normal Ember windows now retain the native transparency policy; the shared shell tint transmits more backdrop variation. LocationIconView's own background override bypassed the base visibility flag, recreating the capsule; it now honors floating suppression through refresh/theme changes. Input height is 40 DIP and the resting surface 52 DIP. Verify desktop variation, frame changes, New Tab/split transparency, favicon refresh, and compact empty/typed/bang states after linking.

- **B55 - Sidebar search crash and chrome correction (source fixed in 0058, awaiting linked runtime):** The 0057 text-colour initialization dereferenced a null ColorProvider while the real suggestion constructor populated its detached ellipsis/separator. A neutral construction fallback preserves the normal attached match-colour path. Shell correction removes opaque titlebar underpaint and opaque palette-ID corner fills, enables sidebar alpha, applies one tint at rounded joins and keeps DWM acrylic dark. Verify sidebar/Ctrl+L first-open, empty/typed suggestions, reopen and all chrome joins after linking.

- **B54 - Run 4 corrections (source fixed in 0057, awaiting linked runtime):** Neutral suggestion/matched roles, bang favicon/separator/query spacing, provider backplate, stable removal space, renderer backdrop refresh and animated registration, chrome joins and duplicate Extensions perimeter. Verify real caret/typing, keyboard deletion/traversal, scroll/content mutation, interrupted menu motion, DPI, split source alignment and bright/dark backgrounds after linking.

- **B50 — approved visual revamp (source fixed, awaiting rebuilt launch):** Neutral shell, floating native search, one-column thin/wide sidebar, split capsule and browser-owned surface family. The first linked launch crashed because the split-backing constructor set opacity on a solid-color layer; patch 0053 now confines that setter to textured layers and covers layer attachment. The second rebuilt launch crashed because backdrop inspection called the creating GetWebContents() accessor on an empty split slot; both backdrop paths now use the read-only web_contents() accessor. Preserve native models and external extension content; focused compilation and linked runtime checks tracked in `CHROMIUM_PORT_STATUS.md`.

- **B44 — upload popup:** Patch 0035 contains the recent-tile crash, clipboard, placement, grid and multi-select corrections. Verify reopening after upload, cancellation, split-pane bounds and download tiles.
- **B45 — tab visibility and overflow:** Patch 0040 restores the direct-content scroll layout. Verify tabs remain visible and clickable at narrow widths, wheel easing, end clamping and reduced motion.
- **B46 — New Tab Bang routing:** Patches 0038–0039 prioritize pending aliases. Verify `yt hello`, fast paste, favicon and persistence.
- **B47 — glass dialogs:** Patch 0040 adjusts restore and leave-site dialogs. Verify page-centered bounds, glass capture and focus.
- **B49 — New Tab search optics (source fixed, awaiting linked runtime):** Retain viewport-aligned photo blur; refine suggestion hierarchy, utility icons and tint. Verify the linked browser over bright and dark photos, including split New Tabs.

- **B51 - Run 2 corrections (source fixed, awaiting linked runtime):** Repair invisible/stuck floating search, sidebar anchoring, split membership/artifact, Extensions framing, shared smoke and evidenced favicon binding. Preserve accepted tab/tile geometry.

## Resolved native issues

- **B48 — Unsplash New Tab image:** Patch 0050 fetches the image in the browser process; the user confirmed the image now displays.

The selection popup, sidebar Extensions placement and corner mark are new final-parity work tracked in [CHROMIUM_PORT_STATUS.md](CHROMIUM_PORT_STATUS.md) until the linked runtime is checked.

## Historical Electron issue index

| ID | Original issue | Original status |
| --- | --- | --- |
| B1 | Ctrl+Tab switcher does not commit on Ctrl release | ✅ Fixed |
| B2 | Switcher uses the purple plastic backdrop | ✅ Fixed |
| B3 | Application crashes on rapid Ctrl+W | ✅ Fixed |
| B4 | Windows does not treat Ember as a normal application window | 🟡 In progress |
| B5 | Top corner artifacting | ✅ Fixed |
| B6 | Maximise icon does not change when maximised | ✅ Fixed |
| B7 | White-stroke logo in the top left looks smushed | ✅ Fixed |
| B8 | New-tab `+` icon is not vertically centred | ✅ Fixed |
| B9 | Close-tab `x` icon is not vertically centred | ✅ Fixed |
| B10 | Overflowed tabs are unreachable | ✅ Fixed |
| B11 | No open/close tab animation | ✅ Fixed |
| B12 | Back / forward / reload are not animated | ✅ Fixed |
| B13 | Selection conversion popup uses the purple plastic box | ✅ Fixed |
| B14 | No animation when the smart selection conversion opens | ✅ Fixed |
| B15 | File upload menu opens in the centre of the screen | ✅ Fixed |
| B16 | File upload menu glass is not readable | ✅ Fixed |
| B17 | Hover pill corners break in right-click style menus | ✅ Fixed |
| B18 | Typing any single key on the new tab page should focus the search bar | ✅ Fixed |
| B19 | Bang keyword stays in the query after the space | ✅ Fixed |
| B20 | New tab page carries unwanted copy and shortcut buttons | ✅ Fixed |
| B21 | Search bar icons are not clickable | ✅ Fixed |
| B22 | New tab favicon should be the coloured app icon | ✅ Fixed |
| B23 | Extensions page is completely blank | ✅ Fixed |
| B24 | Selection indicator artifacting in settings and history | ✅ Fixed |
| B25 | Grey text in the settings glass panels is unreadable | ✅ Fixed |
| B26 | No back button on settings, downloads and history | ✅ Fixed |
| B27 | Recently closed only stores the last closed site | ✅ Fixed |
| B28 | History hover text outruns the hover indicator | ✅ Fixed |
| B29 | History section jumps land at the wrong scroll position | ✅ Fixed |
| B30 | No scroll animation for history section navigation | ✅ Fixed |
| B31 | Filter by date does not work on the history page | ✅ Fixed |
| B32 | History search field has stray orange lines and tint | ✅ Fixed |
| B33 | "Add to ember" is not capitalised in the Chrome Web Store | ✅ Fixed |
| B34 | Closing a BaseWindow leaks its child WebContents processes | 🟡 In progress |
| B35 | Opening an internal page reuses its tab without refreshing it | 🔴 Open |
| B36 | Broad Quick Sites miss redirected subdomains and tab drops preview as moves | ✅ Fixed |
| B37 | Native sleeping tabs do not read as asleep | ✅ User-confirmed fixed |
| B38 | Native background drag ghost misses Favorite and split targets | ✅ User-confirmed fixed |
| B39 | Native Favorite settings do not update the sidebar | ✅ User-confirmed fixed |
| B40 | Native Favorite rail exposes empty cells and snaps on insertion | ✅ User-confirmed fixed |
| B41 | Native New Tab hero sits at the top | ✅ User-confirmed fixed |
| B42 | Direct left/right split-target crossing snaps | ✅ User-confirmed fixed |
| B43 | Cross-window transfer of the final tab crashes | ✅ User-confirmed fixed |

| B52 | Run 3: corner comet occlusion, duplicated native bang label, Tab auxiliary stops, misplaced copy feedback, painted-grey suggestions and hidden split boundary | Source fixed in 0055; awaiting linked runtime QA |

| B53 | Startup access violation in LocationBarView::Layout before BrowserView registration | Fixed in 0056; rebuilt binary started with fresh and existing profiles, exact desktop shortcut opens a responding native Ember window |
