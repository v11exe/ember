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
**Status:** 🟡 In progress · **Owner:** Claude Code · **Area:** `src/main/switcher-panel.js`, `src/main/shortcuts.js`, switcher page

Releasing Ctrl does not switch to the highlighted tab; the overlay stays up
until it is clicked with the mouse. Pressing Tab alone while the overlay is open
causes artifacting and should not be possible at all. After the overlay closes,
Ctrl+Tab does nothing for several seconds.

### B2 — Switcher uses the purple plastic backdrop
**Status:** 🟡 In progress · **Owner:** Claude Code

Replace with the frosted, heavily blurred liquid-glass material (see
cross-cutting decisions).

### B3 — Application crashes on rapid Ctrl+W
**Status:** 🟡 In progress · **Owner:** Claude Code · **Area:** `src/main/tabs.js`

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
**Status:** 🟡 In progress · **Owner:** Claude Code

It stays a single square; when maximised it should become the two overlapping
squares Windows uses for restore.

### B7 — White-stroke logo in the top left looks smushed
**Status:** 🟡 In progress · **Owner:** Claude Code · **Area:** `src/renderer/brand.*`

Replace it outright with the coloured icon, sized so its height matches the
sidebar icon beside it; move the sidebar icon to compensate for the wider mark.

### B8 — New-tab `+` icon is not vertically centred
**Status:** 🟡 In progress · **Owner:** Claude Code

Its hover box is centred but the glyph inside is not.

### B9 — Close-tab `x` icon is not vertically centred
**Status:** 🟡 In progress · **Owner:** Claude Code

### B10 — Overflowed tabs are unreachable
**Status:** 🟡 In progress · **Owner:** Claude Code · **Area:** `src/main/tabs.js`, `src/renderer/chrome.*`

Tabs that overflow slide behind the rest of the tab bar (the untouched empty
space is intentional) but there is no way to get them back. Scrolling the wheel
over the tab bar should move tabs side to side, fading into both edges. New tabs
on a full bar must push the *left* side behind so the new tab is always fully
visible.

### B11 — No open/close tab animation
**Status:** 🟡 In progress · **Owner:** Claude Code

New tabs should pop up from the bottom edge and closed tabs pop down, matching
the speed and easing of neighbour tabs shuffling during reorder — and accounting
for the leftward shift from B10 when space has run out.

### B12 — Back / forward / reload are not animated
**Status:** 🟡 In progress · **Owner:** Claude Code

Animate them, including when triggered by Alt+Left, Alt+Right and Ctrl+R.

---

## Overlays, menus and panels

### B13 — Selection conversion popup uses the purple plastic box
**Status:** 🟡 In progress · **Owner:** Claude Code · **Area:** `src/main/selection-panel.js`

Should be the liquid-glass material, non-elastic, frosted and blurred enough
that its own text stays readable.

### B14 — No animation when the smart selection conversion opens
**Status:** 🟡 In progress · **Owner:** Claude Code

### B15 — File upload menu opens in the centre of the screen
**Status:** 🟡 In progress · **Owner:** Claude Code · **Area:** `src/main/upload-panel.js`, `src/main/popup-positioner.js`

It should anchor a corner to the cursor, picking the corner that keeps the panel
inside the window, preferring top-left (opening down and to the right) when no
edge is near or when overflowing is unavoidable.

### B16 — File upload menu glass is not readable
**Status:** 🟡 In progress · **Owner:** Claude Code

Text underneath shows through. Increase blur/frost substantially or move it to
the search-bar liquid-glass material with tuned values.

### B17 — Hover pill corners break in right-click style menus
**Status:** 🟡 In progress · **Owner:** Claude Code · **Area:** `src/main/context-menu-panel.js`, `src/renderer/pages/liquid-glass-ui.*`

The hover indicator's corners are not cleanly rounded into the pill; randomly
coloured 90° angles protrude from all four corners. Affects every menu using
this material.

---

## Omnibox / new tab

### B18 — Typing any single key on the new tab page should focus the search bar
**Status:** 🔴 Open · **Owner:** _unclaimed_ · **Area:** `src/renderer/pages/newtab.*`

Any non-combo keypress should start typing into the search field.

### B19 — Bang keyword stays in the query after the space
**Status:** 🔴 Open · **Owner:** _unclaimed_ · **Area:** `src/shared/urls.js`, `src/renderer/chrome.*`

Typing `gh` shows the GitHub indicator but leaves `gh` in the box. Pressing
space should move the keyword into the left-hand chip and leave the query empty;
backspace on an empty query should remove the bang. *Nice to have:* favicons for
the default bangs in place of the text chip.

### B20 — New tab page carries unwanted copy and shortcut buttons
**Status:** 🔴 Open · **Owner:** _unclaimed_

Remove "private by default", the "search runs on Google" text (both the inline
one and the one at the bottom), "get extensions", and the row of buttons below
the search bar linking to arbitrary sites.

### B21 — Search bar icons are not clickable
**Status:** 🔴 Open · **Owner:** _unclaimed_

The search button on the right and the search icon on the left should show the
pointer cursor and act as an alternative to pressing Enter.

### B22 — New tab favicon should be the coloured app icon
**Status:** 🔴 Open · **Owner:** _unclaimed_

New tab, settings and history should all use the square coloured `app-icon`
artwork used for the Windows app icon, not the longer lockup.

---

## Internal pages

### B23 — Extensions page is completely blank
**Status:** 🔴 Open · **Owner:** _unclaimed_ · **Area:** `ember://extensions`

Nothing is planned for it yet, so at minimum show a work-in-progress state.

### B24 — Selection indicator artifacting in settings and history
**Status:** 🔴 Open · **Owner:** _unclaimed_

The indicator is too bright, drowning parts of the boxes to invisibility —
especially the arrows in the favourite sites section — and its corners do not
align to the full size of the box.

### B25 — Grey text in the settings glass panels is unreadable
**Status:** 🔴 Open · **Owner:** _unclaimed_

Any text sharing the colour of the search-shortcut names and links should be
white or carry the same shadow the section descriptions use.

### B26 — No back button on settings, downloads and history
**Status:** 🔴 Open · **Owner:** _unclaimed_

Add a top-left back button returning to the new tab page.

### B27 — Recently closed only stores the last closed site
**Status:** 🔴 Open · **Owner:** _unclaimed_ · **Area:** `src/main/history.js`

It should hold every tab closed in the last 5 minutes, each with a reopen button
on the right.

### B28 — History hover text outruns the hover indicator
**Status:** 🔴 Open · **Owner:** _unclaimed_

Moving the cursor quickly across the site-name text turns it white instantly
while the liquid-glass hover indicator lags behind. The text should follow the
cursor at the same speed and in the same way as the indicator.

### B29 — History section jumps land at the wrong scroll position
**Status:** 🔴 Open · **Owner:** _unclaimed_

Pressing Older, then Yesterday or Today, does not scroll to the top of those
sections; it lands somewhere arbitrary.

### B30 — No scroll animation for history section navigation
**Status:** 🔴 Open · **Owner:** _unclaimed_

The left-hand navigate-to buttons should animate the scroll.

### B31 — Filter by date does not work on the history page
**Status:** 🔴 Open · **Owner:** _unclaimed_

### B32 — History search field has stray orange lines and tint
**Status:** 🔴 Open · **Owner:** _unclaimed_

Orange lines on either side and an orange tint while typing. The orange lines
must go entirely; either restyle the field to fit or remove it. The search icon
turning orange is fine.

---

## Copy

### B33 — "Add to ember" is not capitalised in the Chrome Web Store
**Status:** 🔴 Open · **Owner:** _unclaimed_ · **Area:** `src/main/extensions.js`

Should read "Add to Ember".
