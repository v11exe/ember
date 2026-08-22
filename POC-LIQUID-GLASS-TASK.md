# Electron Liquid Glass Search PoC — Active Codex Task

Do **not** integrate this into Ember's production new-tab page yet. The target is the standalone Electron proof-of-concept supplied alongside this repository.

## Reference inputs supplied with the task

- `ember-search-liquid-glass-inspect(1).zip` — inspection bundle for the current PoC search implementation (`search-glass.jsx`, `search-glass.css`, `glass-settings.json`, `native-stack.txt`).
- `liquid-glass-search-reference-react-FIXED.zip` — known-good React 19 implementation that renders the desired `liquid-glass-react` material correctly.
- `liquid-glass.maxrovensky.com(3).html` — saved upstream demo page for DOM/computed-style verification.
- Bryce Canyon reference image and screenshots — visual comparison assets.

The inspection bundle explicitly states that the runnable PoC remains outside the small archive. Locate and work in that existing standalone PoC rather than modifying Ember's production renderer.

## Scope

Work only on the standalone Electron PoC. Do not modify production:

- `src/renderer/pages/newtab.html`
- `src/renderer/pages/newtab.js`
- `src/renderer/pages/newtab.css`

Preserve the PoC's existing native Windows/DWM transparency path as a separate layer. The intended stack is:

`BrowserWindow -> native DWM backdrop -> transparent Chromium renderer -> optional Bryce test background -> liquid-glass-react -> sharp search input/content`

Do not replace the native backdrop with CSS blur. Do not stack Ember's older `page-glass.js`, `upload-optics.js`, `[data-glass]`, or another custom SVG/CSS glass implementation on the same search surface.

## Dependency requirement

The npm-published `liquid-glass-react@1.1.1` requires React 19. The standalone PoC must use a compatible dependency set:

```json
"liquid-glass-react": "1.1.1",
"react": "19.1.1",
"react-dom": "19.1.1"
```

`npm install` must succeed normally. Do not use `--force` or `--legacy-peer-deps`. Do not leave React 18 installed in the PoC.

Do not unnecessarily convert the main Ember production package to React 19 just for this experiment.

## Known-good material defaults

The old PoC search defaults in the inspection bundle are:

- displacementScale: 129
- blurAmount: 0
- saturation: 160
- aberrationIntensity: 0
- elasticity: 0.4
- cornerRadius: 61

Those are **not** the defaults for this task.

Use the known-good working reference defaults:

- mode: `standard`
- displacementScale: `100`
- blurAmount: `0.5`
- saturation: `140`
- aberrationIntensity: `2`
- elasticity: `0`
- cornerRadius: `32`
- overLight: `false`

Update the PoC's default state/config so those values appear on launch.

## Keep the full tuning panel

Do not remove or hide the tuning UI. Keep controls for at least:

- Refraction Mode
- Displacement Scale
- Blur Amount
- Saturation
- Chromatic Aberration
- Elasticity
- Corner Radius
- Over Light

Keep the existing slider ranges unless an actual implementation defect requires a correction.

Every control must update the **actual mounted `LiquidGlass` instance** live. Do not create a second mock surface that changes while the real glass remains unchanged.

The component should remain driven by state/props in the same form as:

```jsx
<LiquidGlass
  displacementScale={glass.displacementScale}
  blurAmount={glass.blurAmount}
  saturation={glass.saturation}
  aberrationIntensity={glass.aberrationIntensity}
  elasticity={glass.elasticity}
  cornerRadius={glass.cornerRadius}
  overLight={glass.overLight}
  mode={glass.mode}
  mouseContainer={pageRef}
>
  ...
</LiquidGlass>
```

## Use the actual library

Use:

```jsx
import LiquidGlass from 'liquid-glass-react'
```

Do not manually reproduce the standalone comparison page's SVG filter as the Electron implementation. The hand-authored filter was only a visual diagnostic. The Electron PoC must run the npm package itself.

## Search surface structure

The known-good structure is conceptually:

`LiquidGlass -> transparent search form/content -> search icon + native input (+ existing submit control if present)`

The content **inside** `LiquidGlass` must remain transparent.

Do not add:

- another translucent search capsule
- another `backdrop-filter` on the inner search content
- another grey or tinted search background
- another fake glass gradient
- another search-level border
- another search-level shadow
- another pseudo-element pretending to be the glass
- another clipping layer covering the package output

The inner content layer should use the equivalent of:

```css
background: transparent;
border: 0;
box-shadow: none;
```

The `LiquidGlass` component itself is the visible optical surface.

## Geometry

Start from the geometry proven in `liquid-glass-search-reference-react-FIXED.zip`:

- outer glass: approximately 560 px wide × 68 px high
- corner radius: 32 px
- `LiquidGlass` padding: approximately `20px 24px`
- inner transparent search content: approximately 512 px wide × 28 px high
- responsive at narrow Electron window sizes

Do not create a second inner pill with its own fixed outer geometry.

## Native input behaviour

Keep a real HTML input. It must support:

- typing
- visible caret
- text selection
- Ctrl+A / Ctrl+C / Ctrl+V / Ctrl+X
- normal focus
- pointer interaction
- normal submission
- no accidental Electron window dragging

Preserve whatever URL-vs-search navigation semantics the existing PoC already uses.

The input itself should remain visually sharp rather than being distorted as part of the backdrop optical layer.

## Mouse tracking

Use the larger renderer/page container as `mouseContainer`, matching the upstream library demo and the known-good React reference.

Example:

```jsx
const pageRef = useRef(null)

<main ref={pageRef}>
  <LiquidGlass mouseContainer={pageRef} ...>
```

Do not restrict tracking to the input element itself.

## Required library CSS compatibility

`liquid-glass-react@1.1.1` internally relies on Tailwind-style utility class names including:

- `relative`
- `bg-black`
- `transition-all`
- `duration-150`
- `ease-in-out`
- `pointer-events-none`
- `mix-blend-overlay`
- `opacity-0`
- `opacity-20`
- `opacity-100`
- `cursor-pointer`
- `text-white`

The upstream demo has Tailwind available. A minimal Electron PoC may not.

If the PoC does not already load Tailwind correctly, preserve the small compatibility CSS shims from `liquid-glass-search-reference-react-FIXED.zip`. Do not add the entire Tailwind framework solely for these few internal classes.

This is important because missing utility definitions can break the library's overlay positioning, opacity, pointer-event and blend layers even when React itself mounts successfully.

## Reference background and native backdrop modes

Keep the Bryce Canyon image available as a test background inside the PoC. It is required for direct comparison against the saved upstream demo screenshot.

The Bryce image must be ordinary renderer content **behind** `LiquidGlass`, so the package can refract/blur/saturate that content.

Also preserve the native Windows translucent/DWM test mode. Do not permanently replace the desktop-transparency experiment with the Bryce image.

The PoC should therefore retain both test cases:

- native Windows backdrop mode
- Bryce reference-image mode

## Existing `ReferenceLogOut`

The inspection bundle contains `ReferenceLogOut`. It may remain for A/B testing if useful, but it must not:

- dictate the old incorrect search defaults
- interfere with the main search glass
- add wrappers over the search
- cause a second glass system to be applied to the same surface

The main target is now the working search adaptation.

## Do not modify unrelated Ember features

Do not change production:

- tabs
- address bar
- extensions
- context menus
- upload UI
- logos
- bookmarks
- browser navigation
- production new-tab layout
- production page-glass implementation

This task is intentionally isolated to the standalone Electron liquid-glass search PoC.

## Verification before stopping

Actually run the standalone PoC.

1. Run `npm install` and confirm it succeeds without dependency override flags.
2. Launch the PoC with its real start/dev command.
3. Check DevTools for React errors, CSP errors, missing modules/assets, SVG/filter errors, pointer-event problems and runtime exceptions.
4. Test every slider/control and confirm it changes the same live search bar.
5. Specifically verify mode, displacementScale, blurAmount, saturation, aberrationIntensity, elasticity, cornerRadius and overLight.
6. Test typing, text selection, clipboard shortcuts, focus and submit in the input.
7. Test cursor-driven highlights/refraction using the outer page/container as the mouse tracking target.
8. Test the Bryce reference background.
9. Test the native desktop-transparency/DWM mode.
10. Compare Electron rendering against `liquid-glass-search-reference-react-FIXED.zip` and the saved upstream demo. If there is a mismatch, inspect the DOM/computed styles and Electron Chromium behaviour instead of covering the discrepancy with additional fake CSS glass.

## Success condition

The standalone Electron PoC is running the known-good React 19 + `liquid-glass-react@1.1.1` search implementation with:

- the full tuning panel preserved
- working live sliders/controls
- initial defaults `standard / 100 / 0.5 / 140 / 2 / 0 / 32 / off`
- a fully interactive native search input
- proper cursor-driven library highlights/refraction
- Bryce comparison mode preserved
- native Windows/DWM mode preserved
- no extra fake translucent search capsule
- no old Ember renderer glass system double-applied to the search

Only after this PoC is visually approved should the concept be considered for Ember's production new-tab search.