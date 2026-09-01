# Native sidebar visual parity — measured gaps in patches 0007 and 0008

Measured 2026-09-01 against `src/renderer/sidebar.{css,js}` and
`chromium/reference/electron/9ae3217/` (`manifest.json`, `sidebar-address.png`).
Patches 0007 and 0008 are functionally right and visually wrong; the status
ledger calls that "intentionally plain", so this file turns it into numbers.

## The rail's coordinate system

`.sidebar-surface` is `padding: 34px 9px 8px` inside the 168 px rail, so:

- content column: **150 px** wide, starting at **x = 9**
- first row (`.sidebar-address`): **33 px** tall at **y = 34**
- `.sidebar-content` is a grid, `grid-template-rows: 33px auto`, `gap: 10px`
- Favorite grid therefore starts at **y = 77**, is 150 wide and 98 tall

These are confirmed by the reference manifest: `sidebar.address` is
`[9, 34, 159, 67]` and `sidebar.favoritesOrigin` is `[9, 77]`.

Patch 0007 instead lays the rail out with `BoxLayout(kVertical, Insets(8), 8)`,
which puts the address row at x=8 / y=8 and gives it the wrong width. The
container insets must be `TLBR(34, 9, 8, 9)` with a 10 px gap between rows.

## Address row (patch 0007)

| Property | Patch 0007 | Oracle |
| --- | --- | --- |
| Height | 36 | **33** |
| Corner radius | 9 | **7** |
| Fill | `ARGB(0x30, FFFFFF)` ≈ .188 | **`.075` → `ARGB(0x13, FFFFFF)`** |
| Border | none | **1 px `.025` → `ARGB(0x06, FFFFFF)`** |
| Inner padding | `TLBR(0, 10, 0, 4)`, spacing 4 | **`padding-left: 9`, then a fixed 26 px trailing column, no gap** |
| Text colour | `ARGB(0xE6, FFFFFF)` ≈ .902 | **`.82` → `ARGB(0xD1, FFFFFF)`** |
| Font size | inherited | **12 px** |
| Overflow | `ELIDE_MIDDLE` | **clips at the trailing edge** — it is an `<input>`, so there is no ellipsis at all |
| Hover | none | **fill `.13`** |
| Focus | none | **fill `.18`, border `.055`** |
| Transition | none | `background 130ms ease, border-color 130ms ease, transform 130ms ease` |

### URL text

The oracle rule is exactly:

```js
if (!/^https?:\/\//i.test(raw)) return raw
return raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
```

It strips the scheme for **both** http and https, strips a leading `www.`, and
otherwise leaves the URL alone — no trailing-slash trimming, no path elision,
non-http(s) URLs untouched. Patch 0007 uses `url_formatter::FormatUrl()`, whose
defaults omit `http://` but keep `https://` and trim a bare host's trailing
slash. Port the rule, not the convenience function.

Focus behaviour also differs and is unimplemented natively: the oracle restores
the **raw** address and selects it on focus, then returns to the simplified form
on blur. `SetSidebarEditing` suppresses the sync while editing.

## Copy control (patch 0007)

The oracle has no "Copy" text anywhere. `.sidebar-address-copy` is a 26 px wide,
full-height, transparent button with radius 6 holding a **12×7 white link
glyph** (`brightness(0) invert(1)`, `opacity .92`). Hover lightens the button to
`.085` and scales the glyph to 1.13 at full opacity; press scales the button to
.9 and the glyph to .84, both `130ms cubic-bezier(.2,.8,.2,1)`.

Patch 0007 paints a gold `#FFC93C` text button labelled `Copy` on a
`ARGB(0x22, FFC93C)` background. Nothing about that is Ember.

Confirmation is also different: the oracle does not relabel the button. It
raises a separate bounded overlay (`src/main/copy-toast.js` +
`src/renderer/pages/copy-toast.*`) beside the rail, precisely because the
sidebar view clips at 168 px and must not shift the Favorite grid. The native
port has a real Views/widget layer and does not need a second window for this,
but it must not change the rail's layout to show feedback. Patch 0007's
accessible `Copied` announcement and 1.2 s reset are correct and should stay;
only the visible treatment changes.

## Favorite tiles (patch 0008)

Recorded as Task 5 of
`../plans/2026-08-31-native-chromium-favorites.md`. Summary: tiles are 70×43 not
71×43, the grid box is 98 not 96, radius 7 not 9, fill `.075` not `.141`, a 1 px
`.025` border is missing, the open state brightens to white `.18` with a `.055`
border rather than turning orange, and the tile is **icon-only** — a centred
19×19 favicon with no title text.

## Sidebar collapse

Not implemented natively at all. The oracle collapses the rail to 8 px over
210 ms `cubic-bezier(.2,.8,.2,1)`, fading the address row and Favorite grid to
`opacity 0` with `translateX(-12px)`, and interpolates the sidebar, page and
bottom-frame bounds together. Patch 0006 reserves the 168 px statically.
