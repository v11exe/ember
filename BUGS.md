# BUGS.md — Ember bug and polish tracker

Shared, live defect list for every agent working on Ember. `ROADMAP.md` owns
numbered *features*; this file owns *defects and polish* against what already
ships.

## How to use this file

- Bugs are numbered `B#`. **Never renumber or delete an entry.** Closed bugs stay
  with their status so the history stays readable.
- Status: `🔴 Open` · `🟡 In progress` · `✅ Fixed` · `🚫 Won't fix`.
- Claim a bug by setting `🟡 In progress` and putting your agent name in
  **Owner** *before* you start editing code. Check for an existing owner first.
- When fixing, set `✅ Fixed`, name the branch/commit, and record any durable
  behaviour another agent must honour under **Notes**.
- Add new bugs at the end with the next free number.
- A fix that changes architecture, contracts or gotchas must also update
  `AGENTS.md` §0 and the Work Log, per the repository rules.

## Cross-cutting decisions from this list

- **Material:** the purple/plastic panel material is deprecated. All overlays,
  panels and popups use the same liquid-glass material as the search bar, tuned
  per situation — heavier blur and frost where text must stay readable,
  elasticity and click effects only where the surface is interactive.
- **Icons:** the coloured app icon (`app-icon` artwork) is the canonical mark
  for chrome, internal-page favicons and anywhere the long white-stroke lockup
  currently reads badly.
- **Motion:** chrome interactions animate the same way whether they were
  triggered by mouse or by keyboard shortcut.

---

## Chrome / window shell

### B1 — Ctrl+Tab switcher does not commit on Ctrl release
**Status:** ✅ Fixed · **Owner:** Claude Code · **Area:** `src/main/switcher-panel.js`, `src/main/shortcuts.js`, switcher page

Releasing Ctrl does not switch to the highlighted tab; the overlay stays up
until it is clicked with the mouse. Pressing Tab alone while the overlay is open
causes artifacting and should not be possible at all. After the overlay closes,
Ctrl+Tab does nothing for several seconds.

### B2 — Switcher uses the purple plastic backdrop
**Status:** ✅ Fixed · **Owner:** Claude Code

Replace with the frosted, heavily blurred liquid-glass material (see
cross-cutting decisions).

### B3 — Application crashes on rapid Ctrl+W
**Status:** ✅ Fixed · **Owner:** Claude Code · **Area:** `src/main/tabs.js`

Pressing Ctrl+W several times in quick succession crashes the whole app. Likely
a close/destroy race against a tab record whose renderer is already gone.

### B4 — Windows does not treat Ember as a normal application window
**Status:** 🟡 In progress · **Owner:** Claude Code · **Area:** `src/main/index.js`

Dragging to the top of the screen does not trigger the Snap bar, and
minimise/restore from the taskbar plays no standard Windows animation.

### B5 — Top corner artifacting
**Status:** 🟡 In progress · **Owner:** Claude Code

Black 90° corners subtly stick out behind the rounded top corners, and the
corners sometimes lose their curve entirely — reproducible after maximising and
then restoring to a window.

### B6 — Maximise icon does not change when maximised
**Status:** ✅ Fixed · **Owner:** Claude Code

It stays a single square; when maximised it should become the two overlapping
squares Windows uses for restore.

### B7 — White-stroke logo in the top left looks smushed
**Status:** ✅ Fixed · **Owner:** Claude Code · **Area:** `src/renderer/brand.*`

Replace it outright with the coloured icon, sized so its height matches the
sidebar icon beside it; move the sidebar icon to compensate for the wider mark.

### B8 — New-tab `+` icon is not vertically centred
**Status:** ✅ Fixed · **Owner:** Claude Code

Its hover box is centred but the glyph inside is not.

### B9 — Close-tab `x` icon is not vertically centred
**Status:** ✅ Fixed · **Owner:** Claude Code

### B10 — Overflowed tabs are unreachable
**Status:** ✅ Fixed · **Owner:** Claude Code · **Area:** `src/main/tabs.js`, `src/renderer/chrome.*`

Tabs that overflow slide behind the rest of the tab bar (the untouched empty
space is intentional) but there is no way to get them back. Scrolling the wheel
over the tab bar should move tabs side to side, fading into both edges. New tabs
on a full bar must push the *left* side behind so the new tab is always fully
visible.

### B11 — No open/close tab animation
**Status:** ✅ Fixed · **Owner:** Claude Code

New tabs should pop up from the bottom edge and closed tabs pop down, matching
the speed and easing of neighbour tabs shuffling during reorder — and accounting
for the leftward shift from B10 when space has run out.

### B12 — Back / forward / reload are not animated
**Status:** ✅ Fixed · **Owner:** Claude Code

Animate them, including when triggered by Alt+Left, Alt+Right and Ctrl+R.

---

## Overlays, menus and panels

### B13 — Selection conversion popup uses the purple plastic box
**Status:** ✅ Fixed · **Owner:** Claude Code · **Area:** `src/main/selection-panel.js`

Should be the liquid-glass material, non-elastic, frosted and blurred enough
that its own text stays readable.

### B14 — No animation when the smart selection conversion opens
**Status:** ✅ Fixed · **Owner:** Claude Code

### B15 — File upload menu opens in the centre of the screen
**Status:** ✅ Fixed · **Owner:** Claude Code · **Area:** `src/main/upload-panel.js`, `src/main/popup-positioner.js`

It should anchor a corner to the cursor, picking the corner that keeps the panel
inside the window, preferring top-left (opening down and to the right) when no
edge is near or when overflowing is unavoidable.

### B16 — File upload menu glass is not readable
**Status:** ✅ Fixed · **Owner:** Claude Code

Text underneath shows through. Increase blur/frost substantially or move it to
the search-bar liquid-glass material with tuned values.

### B17 — Hover pill corners break in right-click style menus
**Status:** ✅ Fixed · **Owner:** Claude Code · **Area:** `src/main/context-menu-panel.js`, `src/renderer/pages/liquid-glass-ui.*`

The hover indicator's corners are not cleanly rounded into the pill; randomly
coloured 90° angles protrude from all four corners. Affects every menu using
this material.

---

## Omnibox / new tab

### B18 — Typing any single key on the new tab page should focus the search bar
**Status:** ✅ Fixed · **Owner:** Claude Code · **Area:** `src/renderer/pages/newtab.*`

Any non-combo keypress should start typing into the search field.

### B19 — Bang keyword stays in the query after the space
**Status:** ✅ Fixed · **Owner:** Claude Code · **Area:** `src/shared/urls.js`, `src/renderer/chrome.*`

Typing `gh` shows the GitHub indicator but leaves `gh` in the box. Pressing
space should move the keyword into the left-hand chip and leave the query empty;
backspace on an empty query should remove the bang. *Nice to have:* favicons for
the default bangs in place of the text chip.

### B20 — New tab page carries unwanted copy and shortcut buttons
**Status:** ✅ Fixed · **Owner:** Claude Code

Remove "private by default", the "search runs on Google" text (both the inline
one and the one at the bottom), "get extensions", and the row of buttons below
the search bar linking to arbitrary sites.

### B21 — Search bar icons are not clickable
**Status:** ✅ Fixed · **Owner:** Claude Code

The search button on the right and the search icon on the left should show the
pointer cursor and act as an alternative to pressing Enter.

### B22 — New tab favicon should be the coloured app icon
**Status:** ✅ Fixed · **Owner:** Claude Code

New tab, settings and history should all use the square coloured `app-icon`
artwork used for the Windows app icon, not the longer lockup.

---

## Internal pages

### B23 — Extensions page is completely blank
**Status:** ✅ Fixed · **Owner:** Claude Code · **Area:** `ember://extensions`

Nothing is planned for it yet, so at minimum show a work-in-progress state.

### B24 — Selection indicator artifacting in settings and history
**Status:** ✅ Fixed · **Owner:** Claude Code

The indicator is too bright, drowning parts of the boxes to invisibility —
especially the arrows in the favourite sites section — and its corners do not
align to the full size of the box.

### B25 — Grey text in the settings glass panels is unreadable
**Status:** ✅ Fixed · **Owner:** Claude Code

Any text sharing the colour of the search-shortcut names and links should be
white or carry the same shadow the section descriptions use.

### B26 — No back button on settings, downloads and history
**Status:** ✅ Fixed · **Owner:** Claude Code

Add a top-left back button returning to the new tab page.

### B27 — Recently closed only stores the last closed site
**Status:** ✅ Fixed · **Owner:** Claude Code · **Area:** `src/main/history.js`

It should hold every tab closed in the last 5 minutes, each with a reopen button
on the right.

### B28 — History hover text outruns the hover indicator
**Status:** ✅ Fixed · **Owner:** Claude Code

Moving the cursor quickly across the site-name text turns it white instantly
while the liquid-glass hover indicator lags behind. The text should follow the
cursor at the same speed and in the same way as the indicator.

### B29 — History section jumps land at the wrong scroll position
**Status:** ✅ Fixed · **Owner:** Claude Code

Pressing Older, then Yesterday or Today, does not scroll to the top of those
sections; it lands somewhere arbitrary.

### B30 — No scroll animation for history section navigation
**Status:** ✅ Fixed · **Owner:** Claude Code

The left-hand navigate-to buttons should animate the scroll.

### B31 — Filter by date does not work on the history page
**Status:** ✅ Fixed · **Owner:** Claude Code

### B32 — History search field has stray orange lines and tint
**Status:** ✅ Fixed · **Owner:** Claude Code

Orange lines on either side and an orange tint while typing. The orange lines
must go entirely; either restyle the field to fit or remove it. The search icon
turning orange is fine.

---

## Copy

### B33 — "Add to ember" is not capitalised in the Chrome Web Store
**Status:** ✅ Fixed · **Owner:** Claude Code · **Area:** `src/main/extensions.js`

Should read "Add to Ember".

### B34 — Closing a BaseWindow leaks its child WebContents processes
**Status:** 🟡 In progress · **Owner:** Codex · **Area:** `src/main/index.js`, window-owned view/panel managers

`BaseWindow` does not automatically destroy `WebContentsView.webContents`. Closing
Ember therefore leaves page, shell and lazy overlay renderers alive; the shared
Snap picker can also keep a BrowserWindow alive after the final Ember window.
Teardown must be idempotent, per-window, and occur only after the session-close
decision has been accepted.

---

## Verification notes — B1–B17

Every fix below was confirmed against the running browser on real hardware,
not only by its tests. Where a bug was a *cause* rather than a symptom, the
cause is named so nobody re-derives it.

- **B3 was never a crash.** Electron installs a default application menu whose
  File ▸ Close Window is bound to Ctrl+W. Every Ctrl+W raced a tab close
  against a window close, and the process exited cleanly with code 0 — which
  is why there was no crash dump to find. `Menu.setApplicationMenu(null)`
  removes it; 50 rapid presses now leave the window intact.
- **B4/B5 share a cause: the window was transparent.** A layered window on
  Windows is excluded from Snap, from Snap Layouts and from the minimise and
  restore animations, and it has to draw its own corner — the gap between
  Ember's rounded shell and the square window is where the black 90° corner
  came from. The window is now opaque with `backgroundMaterial: 'acrylic'`
  and `roundedCorners: true`, and `OUTER_RADIUS` is 0 so nothing in Ember
  rounds it a second time.
- **Snap is Ember's own.** `-webkit-app-region: drag` is not supported on a
  `WebContentsView`, so Ember moves its own window and Windows never sees a
  drag to snap. Ember implements the bargain itself in `WIN_DRAG_END`, and
  resolves the zone from `screen.getCursorScreenPoint()` because the renderer
  coalesces moves into an animation frame and discards whichever one is still
  pending when the pointer goes up.
- **B1 was a focus race.** A view that takes focus while a modifier is held is
  never told that modifier came back up. The switcher therefore opens with
  `focus: false`. Page focus no longer hides it either — the load of the tab
  it just switched to was closing the next one the reader opened.
- **B17 is a compositing rule, and it recurs.** A `backdrop-filter` samples an
  element's rectangle, not its rounded box, and a composited child is clipped
  to its ancestor's rectangle. Any new rounded surface carrying a
  backdrop-filter needs `clip-path`, not just `overflow: hidden`.
- **B14 was a no-op.** A finished CSS animation is no longer in
  `getAnimations()`, so rewinding what it returned did nothing after the first
  open. Overlay views are reused; entrances must be a class removed and
  re-added with a reflow between.

### B34 — Recently closed does not repopulate after a restart
**Status:** 🔴 Open · **Owner:** _unclaimed_ · **Area:** `src/main/history.js`, `src/main/index.js`

Found while verifying B27. The renderer now lists every tab closed in the last
five minutes and B27's display fix was confirmed on screen, but in a fresh
session closing a tab and reloading `ember://history` leaves the section
absent: `snapshot.recentlyClosed` comes back empty. `noteClosedTab()` keeps 25
entries and `tabs.onTabClosed` is wired to it, so the break is somewhere
between the tab close and the snapshot — persistence across a restart is the
first thing to check, since `recentlyClosed` is initialised to `[]` in the
constructor and may never be read back from `history.json`.

### B35 — Opening an internal page reuses its tab without refreshing it
**Status:** 🔴 Open · **Owner:** _unclaimed_ · **Area:** `src/main/index.js`

`openInternal()` selects an existing tab for the same page rather than
reloading it, so Ctrl+H on an already-open History tab shows the snapshot from
whenever it was first opened. Visits and closed tabs made since are missing
until the tab is reloaded by hand.

### B36 — Broad Quick Sites miss redirected subdomains and tab drops preview as moves
**Status:** ✅ Fixed · **Owner:** Codex · **Area:** `src/shared/favorites.js`, `src/renderer/sidebar.js`

A root Quick Site such as `www.wikipedia.org` does not recognise an open
`en.wikipedia.org/wiki/...` tab, so opening it creates a redundant home tab.
Dropping a matching tab into the Quick Site rail previews a move of the current
tile instead of insertion, making duplicate Quick Sites appear to be replaced.

Root Quick Sites now match their direct host and child subdomains after `www.`
normalisation, while page targets remain exact-host/path. Tab drags always use a
fresh preview candidate, so their insertion preview matches the persisted result.
---

## Second pass — B1, B2/B13/B15, B5, B10, B17, B19

### B1 — why three attempts failed before this one

Nothing inside Ember hears the modifier come back up dependably. Traced with
per-`webContents` input logging: a long hold with several taps produces
keydowns and **no key-up anywhere**. A `BaseWindow` does not route keys to
whichever `WebContentsView` reports itself focused — `webContents.isFocused()`
returned `true` for the overlay while the next Tab still arrived at the page —
and a sandboxed page view never surfaces a modifier key-up through
`before-input-event` at all.

Five in-page signals (window/document key-up, a key-down without the modifier,
`blur`, `pointermove`) did not close the gap, because in the failing case no
event of any kind is delivered. The keyboard state itself is never ambiguous,
so `key-release.js` asks the OS: a small `GetAsyncKeyState` watcher runs while
the switcher is open and exits the moment Ctrl is up. **Any future feature
driven by a held chord should use it rather than listening for a key-up.**

The dead period after closing was a separate cause: nothing took keyboard
focus after a tab switch, so the next shortcut went nowhere. `tabs.select()`
now focuses the page it selected.

### B2 / B13 / B15 — an opaque fill is not glass

The first fix pushed `--frost-fill` to .78 alpha, which is a painted panel, not
frosted glass — the "black plastic". Readability has to come from the blur:
the capture is taken to 56px and keeps its colour and light, the tint is a
scrim under half alpha, and the surface wears the search pill's own specular
rim. **Do not raise the fill to solve contrast; raise the blur.**

### B5 — does not reproduce (still open)

Tested and ruled out, so nobody repeats them: repeated resizes, three
maximise/restore cycles, a window sized to exactly the work area, and a window
larger than the display. Corners stayed rounded in all four. Note that
`OUTER_RADIUS` is 0, so Ember paints no corner at all — the curve is entirely
DWM's, which rules out any stuck `.maximized` class as the cause. Remaining
suspects: the manual F11 full-screen path, and display/DPI changes.

### B10 — two causes, one of them invisible

The wheel set `scrollLeft` per notch, which is a series of jumps rather than a
movement. The bigger one: `renderTabs()` chased the active tab on *every*
state emit — a title or favicon update was enough — dragging the strip back
from wherever it had just been scrolled, which is why scrolling often seemed
not to work at all. It now travels only for a tab opening or the selection
actually moving. **Not yet confirmed against the running app**: synthetic
input stopped reaching the window part-way through this pass.

### B10 — fixed, and how it was finally seen

Three causes, two of them invisible from the code alone:

1. The wheel set `scrollLeft` per notch — a series of jumps, not a movement.
2. `renderTabs()` chased the active tab on *every* state emit, so a title or
   favicon update dragged the strip back from wherever it had been scrolled.
   This is what made the wheel look like it did not work at all.
3. Opening a tab schedules a metrics pass, and the run of state emits that
   follows (loading, title, favicon) **cancelled that pass along with its
   scroll request** — so a new tab was left off the end of the strip. The
   request is now held by tab id until it is satisfied rather than captured in
   a callback that a later render throws away.

The arithmetic lives in `src/shared/tab-scroll.js` and is unit-tested, so the
stride, the velocity response and the bounce can be checked without a window.

Verified against the running browser through Electron's remote-debugging port
rather than synthetic keyboard and mouse — see the note in `AGENTS.md`. One
notch glides 3 → 85 → 125px and settles; four fast notches travel further than
four slow ones; pushing past an end leans the strip and stretches it
(`matrix(1.0086, 0, 0, 1, -7.76, 0)`) and it springs back to rest; a new tab
pushes the left-hand tabs behind and lands fully visible; the wheel brings them
back.

### B19 — the chip is a commit, not a preview

The space-commit landed in an earlier pass but the chip still appeared while
the keyword was being typed, which is not what was asked for. Nothing shows now
until the keyword is taken:

    y            nothing
    yt           nothing
    yt<space>    chip reads YouTube, the box is empty, placeholder Search YouTube

The Tab hint is the one exception, because without it nothing tells the reader
the shortcut exists. This supersedes the preview behaviour roadmap #2 added,
and the smoke gate asserts the new contract.
