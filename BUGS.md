# Ember defects

The active native issues are below. B1–B43 are retained as a compact index to the Electron-era tracker on `main` and Git history; their original statuses are historical, not claims about native runtime verification. Keep IDs stable.

## Native issues awaiting the user's linked build

- **B44 — upload popup:** Patch 0035 contains the recent-tile crash, clipboard, placement, grid and multi-select corrections. Verify reopening after upload, cancellation, split-pane bounds and download tiles.
- **B45 — tab visibility and overflow:** Patch 0040 restores the direct-content scroll layout. Verify tabs remain visible and clickable at narrow widths, wheel easing, end clamping and reduced motion.
- **B46 — New Tab Bang routing:** Patches 0038–0039 prioritize pending aliases. Verify `yt hello`, fast paste, favicon and persistence.
- **B47 — glass dialogs:** Patch 0040 adjusts restore and leave-site dialogs. Verify page-centered bounds, glass capture and focus.
- **B49 — New Tab search optics:** The resource overlay blurs a viewport-aligned copy of the photo inside the search lens and adds a translucent fill for readable text/icons. Verify the linked browser over bright and dark photos, including the suggestion panel.

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
