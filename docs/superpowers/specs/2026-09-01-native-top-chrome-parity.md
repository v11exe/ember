# Native top-chrome parity contract (extracted from the Electron oracle)

Source of every number below: Ember `main` at `9ae3217`, files
`src/shared/chrome-layout.js`, `src/shared/tab-scroll.js`,
`src/renderer/chrome.html`, `src/renderer/chrome.css`,
`src/renderer/chrome.js`, `src/renderer/shell-material.css`, and the promoted
captures in `chromium/reference/electron/9ae3217/` (`chrome-wide.png`,
`chrome-medium.png`, `chrome-compact.png`).

This is a measurement record, not a design. Nothing here was invented; if a
value disagrees with the oracle, the oracle wins and this file is stale.

## 1. Strip anatomy, left to right

The whole bar is one 32 px flex row, `align-items: center`, `gap: 5px`,
`padding: 0`, `overflow: hidden`.

| Region | Width | Notes |
| --- | --- | --- |
| `.sidebar-header` | 168 px (140 px when the sidebar is collapsed) | Holds the brand mark and the sidebar toggle. `padding: 0 14px`, inner `gap: 2px`, `transition: width 210ms cubic-bezier(.2,.8,.2,1)`. |
| `.top-navigation` | content | Back / forward / reload, inner `gap: 1px`. |
| `.tabstrip` | `flex: 0 1 auto`, `max-width: var(--tabstrip-max)` | Contains `.tabs` then the new-tab button, `gap: 8px`. |
| `.drag-fill` | `flex: 1 1 auto`, `min-width: 96px` | The blank caption-drag target. This is the 96 px `DRAG_RESERVE`. |
| `.top-actions` | content | Archive (hidden by default) and extensions, `gap: 2px`. |
| `.window-controls` | 138 px (`--caption-width`) | `visibility: hidden` on Windows — it only reserves the system caption width. Three 46×32 buttons. |
| `.omnibox` | overlay | Transient, not part of the flex run. |

## 2. Tabs

- Height 28 px, radius 6 px, gap 8 px, `padding: 0 9px`, inner `gap: 7px`.
- Width is `max-content` clamped to `min-width: 95px` / `max-width:
  var(--tab-max-width)`; the max is recomputed, not fixed at 190.
- Border `1px solid rgba(255,255,255,.035)`; background
  `rgba(255,255,255,.075)`; text `rgba(255,255,255,.70)` at `12.5px/400`.
- Hover: background `rgba(255,255,255,.10)`, text `rgba(255,255,255,.86)`.
- Active: background `rgba(24,20,19,.82)`, border `rgba(255,91,0,.80)`, text
  `rgba(255,255,255,.94)`, shadow `0 0 8px rgba(255,86,0,.25)` plus
  `inset 0 0 8px rgba(255,88,0,.07)`.
- Asleep: background `rgba(255,255,255,.025)`, border
  `rgba(255,255,255,.025)`, text `rgba(255,255,255,.43)`, favicon
  `grayscale(1)` at `opacity .5`, and a `zZ` glyph pair in a 16×18 slot
  (`z` 10px at left 1 / bottom 2, `Z` 12px at right 0 / top 1, colour
  `rgba(255,255,255,.38)`).
- Favicon 16×16, radius 4 (0 for the new-tab glyph), `object-fit: contain`.
- Title never ellipsises: it *fades*. `.tab-title.overflowing` wears a mask
  `linear-gradient(to right, #000 0, #000 calc(100% - 22px), transparent)`;
  on hover the fade widens to 24 px and the title takes `padding-right: 20px`
  to clear the close button.
- Close button: absolutely positioned, 28×28, `right: 5px`, vertically
  centred, radius 6, background `rgba(35,29,27,.96)`, icon 12×12 stroke 1.5,
  `opacity: 0` and `pointer-events: none` until the tab is hovered.
- Loading spinner: 15×15, `1.5px` ring `rgba(255,255,255,.18)` with top colour
  `rgba(255,112,24,.92)`, `0.7s` linear rotation.
- Transition: `background 120ms, border-color 120ms, color 120ms, box-shadow
  160ms, transform 150ms cubic-bezier(.2,.8,.2,1), opacity 120ms`.
- Drag: source tab drops to `opacity .34` with no shadow; the drag preview is
  a fixed clone at `opacity .96` with
  `0 10px 24px rgba(0,0,0,.42), 0 0 10px rgba(255,88,0,.12)`.
- New-tab button: 30×30, radius 6, glyph 17×17 stroke 1.45, hover background
  `rgba(255,255,255,.07)`, `:active { transform: scale(.92) }`. The 34 px
  `NEW_TAB_WIDTH` in the layout contract is the button plus its gap
  allowance, not its painted box.

## 3. Dynamic tab width (`dynamicTabMax`)

```
fixed          = sidebarHeader + navigation + actions + caption + 40
availableWidth = max(0, windowWidth - fixed)
share          = floor((availableWidth - 34 - 96 - 8*(count-1)) / count)
--tab-max-width = clamp(share, 95, 190)
--tabstrip-max  = max(95, availableWidth - 96)
```

`count == 0` yields the 190 maximum. The 40 px addend is a literal in
`updateTabMetrics()`; it is not derived from any token.

## 4. Wheel physics (`src/shared/tab-scroll.js`)

- One notch = 132 px base stride.
- Notches under 230 ms apart multiply the stride by
  `min(2.8, 1 + (230 - gap) / 150)`, capped at 430 px per notch.
- Overscroll lean is capped at 44 px and grows 17 px per dead-end notch, in
  the direction opposite the push.
- The glide covers a per-millisecond fraction: `1 - (1 - perFrame)^(ms/16.667)`
  with `ms` clamped to 64, so a dropped frame lengthens the step.
- Lean relaxes as `overscroll * spring^(ms/16.667)`, snapping to 0 below 0.4 px.
- A lean of *n* px stretches the strip by `1 + min(0.06, n/900)`, with
  `transform-origin` left when leaning positive and right when negative.
- Edge fades are 22 px wide and appear only while there is content past that
  edge; they are rewritten only when the whole-pixel value changes.
- The strip must **not** chase the active tab on every state emit — that was
  B10, and the fix is recorded in `AGENTS.md`.

## 5. Material

The bar samples the same window-wide material as every other shell surface
(`.shell-material`), positioned by window-relative metrics so it cannot seam
against the sidebar:

```
radial-gradient(ellipse 34% 62% at 2.5% 2%,
  rgba(255,90,0,.31) 0%, rgba(165,58,5,.19) 21%,
  rgba(84,32,6,.075) 45%, transparent 69%),
radial-gradient(ellipse 48% 30% at 15% 0%,
  rgba(116,45,14,.10) 0%, transparent 64%),
linear-gradient(110deg, #1a100a 0%, #12100f 29%, #0e0e0e 60%, #0b0b0c 100%)
```

Its top edge (`.shell-edge-top`) is two 1 px bands: a black
`rgba(0,0,0,.84)` hairline at y=0, and above the content an orange
`linear-gradient(90deg, rgba(255,82,0,.25), rgba(255,82,0,.11) 24%,
rgba(255,82,0,.035) 58%, transparent 88%)` at y=1.

## 6. Icon buttons

`.icon` is 30×30, radius 6, colour `rgba(255,255,255,.82)`, glyph 17×17 with
`stroke-width: 1.45`, `stroke-linecap/linejoin: round`. Hover background
`rgba(255,255,255,.07)` at full white; `:active { transform: scale(.93) }`;
disabled `opacity .34` with hover suppressed. The sidebar toggle glyph is the
exception at 18×18 / stroke 1.35.

Navigation feedback is scripted from main so keyboard and mouse animate
identically: back/forward throw the glyph 7 px and swap sides at 38–39 % over
340 ms; reload spins once over 520 ms.

## 7. What this means for the native port

- Chromium's `TabStripModel`, `Tab`, `TabStrip` and `BrowserView` layout stay
  authoritative. The target is a restyled and re-measured real tab strip, not
  a second tab system painted over it.
- The 32 px bar has to hold the tab strip *and* the navigation buttons *and*
  the actions — Chromium's separate `TabStrip` + `ToolbarView` rows must
  collapse into one row, or the window grows a second bar. Patch 0006 already
  owns `BrowserViewLayout`; that is the seam.
- `.window-controls` reserving 138 px is an Electron workaround for a
  `WebContentsView` that cannot answer `WM_NCHITTEST`. Native Chromium already
  owns its non-client area, so the native port must use the real frame's
  caption reservation instead of porting the hidden-button trick.
- `.drag-fill` is likewise a substitute for a native caption drag region.
  Native Chromium gets that from the frame; only the 96 px reserve in
  `dynamicTabMax` is a real layout contract worth keeping.
- Title fading, the `zZ` sleeping glyph, the orange active border and the
  dynamic width clamp have no Chromium equivalent and are genuine Ember work.

---

## 8. Runtime-verified measurements (2026-09-02)

Everything above section 7 was read out of the source. This section was
**measured from the running Electron oracle** through `--remote-debugging-port`,
driving `Runtime.evaluate` and `CSS.forcePseudoState` against the `chrome.html`
target — no synthetic pointer input, and the window parked on the secondary
display. Where the two disagree, this section wins.

Two things the source reading got wrong and this pass caught:

- Reading `getComputedStyle` immediately after a class change returns the
  **outgoing** value, because `.tab` transitions background, border and colour
  over 120 ms. Every state below was sampled 320 ms after the change.
- `.tab-favicon` is 16×16 with radius 4, but the new-tab favicon variant is
  radius **0** (`.tab-favicon.newtab-favicon`).

### The shell document is 32 px tall

The chrome view reported `innerHeight: 32`. The tab strip is laid out inside a
document exactly as tall as the bar — the native port's equivalent container
must be given the same height, not a full-window canvas it draws 32 px into.

### Region geometry, measured at `innerWidth: 972`

| Region | x | width | y | height |
| --- | --- | --- | --- | --- |
| `.sidebar-header` | 0 | 168 | 0 | 32 |
| `.top-navigation` | 173 | 92 | 0 | 32 |
| `.tabstrip` | 270 | 133 | 0 | 32 |
| `.tabs` | 270 | — | **2** | **28** |
| `.tab-new` | 373 | 30 | 1 | 30 |
| `.drag-fill` | 408 | 386 | 0 | 32 |
| `.top-actions` | 799 | 30 | 1 | 30 |
| `.window-controls` | 834 | 138 | 0 | 32 |

The 5 px gaps between regions are visible in the offsets (168 → 173, 265 → 270,
403 → 408, 794 → 799, 829 → 834). `.top-navigation` is 92 = three 30 px buttons
with two 1 px gaps. The tab row sits at y=2 with height 28, i.e. the 28 px tab
is centred in the 32 px bar with 2 px above and below. `.window-controls`
reported `visibility: hidden` while still occupying its 138 px.

### Tab states, settled

| State | Background | Border | Text | Extra |
| --- | --- | --- | --- | --- |
| Background | `rgba(255,255,255,.075)` | `rgba(255,255,255,.035)` | `rgba(255,255,255,.70)` | no shadow |
| Hover | `rgba(255,255,255,.10)` | `rgba(255,255,255,.035)` | `rgba(255,255,255,.86)` | border does not change |
| Active | `rgba(24,20,19,.82)` | `rgba(255,91,0,.80)` | `rgba(255,255,255,.94)` | `0 0 8px rgba(255,86,0,.25)`, `inset 0 0 8px rgba(255,88,0,.07)` |
| Active + hover | unchanged from active | unchanged | unchanged | the active rule wins; hovering the current tab changes nothing |
| Asleep | `rgba(255,255,255,.024)` | `rgba(255,255,255,.024)` | `rgba(255,255,255,.43)` | favicon `grayscale(1)` at `opacity .5` |
| Dragging | unchanged | unchanged | unchanged | `opacity: .34`, no shadow |

Geometry common to every state: height 28, radius 6, padding 9 left and right,
column gap 7, font 12.5 px weight 400 in `Segoe UI Variable Text`.

### Close button and title, measured while hovered

- Close button 28×28, radius 6, background `rgba(35,29,27,.96)`, icon colour
  `rgba(255,255,255,.76)`, `opacity` 1 and `pointer-events: auto` only while
  hovered. Its right edge sits **6 px** inside the tab's right edge (`right: 5`
  plus the tab's 1 px border).
- The title takes `padding-right: 20px` on hover and its mask becomes
  `linear-gradient(to right, #000 0%, #000 calc(100% - 24px), transparent 100%)`.
  At rest the fade is 22 px and only applied when the title actually overflows.

### Sleeping glyph

A 16×18 box, colour `rgba(255,255,255,.38)`, font weight 500. `z` is 10 px at
`left: 1px; bottom: 2px`; `Z` is 12 px at `right: 0; top: 1px`.

### Icon controls

Back/forward/reload and the new-tab button are all 30×30 with radius 6 and a
transparent background. Their glyphs are 17×17 with `stroke-width: 1.45px` and
no fill. Navigation glyphs are `rgba(255,255,255,.82)`; the new-tab glyph is
`rgba(255,255,255,.84)`.

### Dynamic width, verified against the formula

At `innerWidth: 1024` with 4 tabs the strip reported `--tab-max-width: 100px`
and `--tabstrip-max: 460px`. The formula predicts exactly that:

```
fixed     = 168 + 92 + 30 + 138 + 40 = 468
available = 1024 - 468                = 556
share     = floor((556 - 34 - 96 - 8*3) / 4) = floor(402 / 4) = 100
stripMax  = max(95, 556 - 96)                                 = 460
```

At 8 and 14 tabs the share falls below the floor and `--tab-max-width` clamps to
95. Tabs still render 95 px wide because short titles hit `min-width` first —
the maximum only bites on long titles.

### Scroll and fades

With 14 tabs: `scrollWidth` 1434 against `clientWidth` 422. The left fade is the
full 22 px once scrolled, and the right fade is `min(22, overflow - scrollLeft)`
— measured at 3 px with `scrollLeft: 1009` and an overflow of 1012. One
dispatched wheel notch advanced `scrollLeft` by roughly one stride, and the
strip auto-scrolled to reveal each newly opened tab.

---

## 9. The Chromium seams, read at the pinned commit

Read directly from `chromium/src` at `a96602f3` (the pinned baseline), so the
next patch can be written against the real upstream rather than guessed at.

### `TabStyle` owns tab geometry

`chrome/browser/ui/tabs/tab_style.{h,cc}` is the single source of every tab
dimension Chromium paints. At the pinned revision:

| Accessor | Upstream value | Ember target |
| --- | --- | --- |
| `GetStandardHeight()` | `GetLayoutConstant(kTabStripHeight)` | **28** |
| `GetStandardWidth(false)` | `kTabWidth (232) + 2 * bottom radius (12)` = 256 | dynamic, clamped 95…190 |
| `GetTopCornerRadius()` | 10 | **6** |
| `GetBottomCornerRadius()` | 12 | **6** |
| `GetTabOverlap()` | `2 * 12 - (margins 4 + separator 2)` = 18 | **-8** — Ember *separates* tabs by 8 where Chromium overlaps them by 18 |
| `GetContentsInsets()` | vertical `6 + kTabStripPadding`, horizontal `12 + 8` = 20 | 9 left and right |
| `GetSeparatorSize()` | 2 × 16 | none — Ember draws a border per tab, not separators between them |
| `GetMinimumActiveWidth()` / `GetMinimumInactiveWidth()` | derived from the insets | 95 for both |

The overlap sign is the interesting one. Chromium's strip assumes tabs overlap
so their curved shoulders interlock and a 2 px separator is drawn in the seam.
Ember's tabs are discrete rounded rectangles with an 8 px gap and their own
border. Making `GetTabOverlap()` negative is the smallest change that turns
Chromium's layout arithmetic into Ember's, but every caller that assumes an
overlap is positive has to be checked before relying on it.

`kTabStripHeight` and `kTabStripPadding` come from
`chrome/browser/ui/layout_constants.cc`, which is where the 28 px height and
the vertical centring in the 32 px bar have to originate.

### The single-row problem

`chrome/browser/ui/views/frame/layout/browser_view_tabbed_layout_impl.cc`
(1,696 lines at this revision) lays out `horizontal_tab_strip_region_view`,
`toolbar` and `top_container` as separate stacked rows. Ember's bar is one
32 px row holding navigation buttons, the strip and the actions together, so
this file — the same one patch 0006 already threads its rail through — is the
seam where the two rows have to become one. Its relevant members are
`views().horizontal_tab_strip_region_view`, `views().toolbar` and
`views().top_container`.

None of this has been compiled. It is source reading against the pinned
revision, recorded so the implementation does not start by rediscovering it.

### The layout constants behind the height

Read from `chrome/browser/ui/layout_constants.cc` in the prepared tree:

```
kTabstripToolbarOverlap = 1
kTabHeight              = 34 + kTabstripToolbarOverlap        = 35
kTabStripPadding        = 6
kTabStripHeight         = kTabHeight + kTabStripPadding       = 41
kToolbarButtonHeight    = 34
kTabCloseButtonSize     = 14 (rounded icons) or 16
kTabPreTitlePadding     = 8
```

Ember needs a 32 px bar with a 28 px tab centred in it — measured at y=2, h=28.
Note the asymmetry to be careful of: `kTabStripHeight` adds `kTabStripPadding`
**once**, not once per edge, and `kTabHeight` already folds in the toolbar
overlap. `TabStyle::GetStandardHeight()` returns `kTabStripHeight`, so the
painted tab and the strip that holds it are not independent knobs. Getting to
32/28 is a matter of choosing the three constants together and then measuring
the result against the oracle, not of setting a single height.

`kToolbarButtonHeight` at 34 also exceeds the whole Ember bar, so the toolbar
buttons have to come down to the oracle's 30×30 icon control in the same slice
or the row cannot close to 32.
