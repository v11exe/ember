# Native Top-Bar Density Correction Design

## Goal

Match the current live Electron app's compact top-chrome geometry, using the
checked-in oracle as a deterministic cross-check, without starting another port
feature or replacing Chromium's native controls.

## Diagnosis

Both implementations use a 32 px top row. Chromium's 28 px tabs, 30 px toolbar
buttons and 30 px New Tab control are already centered correctly inside that
row. The discrepancy comes from applying `kEmberPageInset` on all four sides of
the native contents after the 168 px sidebar has already been reserved. This
makes the page begin at x=184/y=40 instead of the Electron contract's
x=168/y=32. The exposed 8 px top band reads as a taller toolbar and the exposed
8 px left band shifts the entire control/tab cluster away from the sidebar.

Before implementation, refresh the working comparison by launching the current
Electron app with `npm start`, placing it visibly on PL288H and capturing its
whole-window top bar. Use that live capture for final positions and the immutable
pinned oracle for regression context. If the live material samples still match
at y=30–31, keep the existing gradient; the extra exposed band is the material
discontinuity to remove.

## Design

Add one ordered native patch after patch 0012. In
`BrowserViewTabbedLayoutImpl`, replace the uniform content inset with
`TLBR(0, 0, 8, 8)` for normal Ember windows. Apply the same inset to both the
layout parameters and unclipped content region so hit testing, clipping and
painting continue to share one rectangle.

Keep these existing measurements unchanged:

- top row: 32 px;
- tab surface: 28 px with 6 px radius;
- toolbar and New Tab controls: 30 px;
- tab-to-New-Tab gap: 8 px;
- tab widths: 95–190 px;
- sidebar: 168 px;
- page radius: 12 px;
- right and bottom page frame: 8 px.

Removing the top/left inset moves the navigation controls and tab strip left by
8 px through existing layout flow, moves the rounded page edge up by 8 px,
removes the false separator band, and lets the sidebar and top material meet at
the same boundary. The real Extensions button, hidden tab-search lifecycle host,
native caption controls, tab model and renderer/security paths remain unchanged.

## Verification

Add a focused patch contract before implementation and observe it fail while
patch 0013 is absent. Capture the current Electron app on PL288H and confirm its
actual page/top-bar boundary and control positions. After implementation, verify
the 13-patch sequence twice, compile the touched layout object and relink the
native UI/browser targets. Launch a fresh native profile on PL288H and measure
the window-relative bounds through UI Automation/CDP against that refreshed
reference: page x=168, page y=32, top region height=32, tabs height=32, New Tab
30×30 and Extensions 28×28 unless the live Electron measurement proves a
different value. Capture a bright page to confirm there is no 8 px separator
band, then exercise New Tab and Extensions once. Finish with the focused suite,
full Node suite and smoke gate.

## Scope

This slice changes only the current native top-bar/page junction. Liquid glass,
new roadmap features, lifecycle porting, packaging hardening and unrelated UI
work remain paused.
