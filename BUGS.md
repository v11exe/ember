- **B70 - Sidebar title/content results absent (source corrected in 0071, linked acceptance pending, Codex):** The real controller retained Chromium's default false unscoped-open-tab option, so ordinary sidebar input never ran OpenTabProvider. Enable the supported option in Ember's real OmniboxController. Title-only and content rows carry exact profile/tab/document/URL acceptance, show Open in Different Tab plus title/passage and use the actual live tab favicon. Native controller/mouse/Tab/Enter and duplicate/bounded-result regressions compile; 113 runnable checks pass. Existing-binary CDP confirms the native isolated-world index can find, scroll and highlight an HTTP passage. New linked result/acceptance QA remains user-run.
- **B69 - Settings headings share one card and toggles duplicate labels (source corrected in 0071, linked acceptance pending, Codex):** User screenshots and existing-binary CDP reproduce headings embedded as rows inside Appearance. Five sibling native settings-section cards now own outside headings and native spacing; four duplicated toggle wrappers become single native label/sub-label controls. Bindings, routes and values remain. Production WebUI and the focused card/pref regression compile; a native-component DOM preview passes. Broader Settings test compilation remains blocked by 21 pre-existing About/SearchEngine fixture errors, retained in the status log.
- **B68 - Run 6 popup referrer compilation (corrected in 0070, user full build passes, Codex):** The user's build exposed a late popup-route edit passing `blink::mojom::ReferrerPtr` to a constructor accepting the pointed-to Referrer. Dereference the Mojo-contract non-null field, retaining URL/policy. The actual focused Ninja browser object compiles; 113 runnable tests, 70 patch checks and prepared postimages/resources pass. The earlier final 0069 compilation claim did not cover this edit. The user's subsequent full browser/package build succeeds; follower interaction acceptance remains separate.
- **B67 - Run 6 linked lifecycle/security acceptance (source implemented in 0069 with build correction 0070, runtime pending, Codex):** Native settings groups, pair follower, in-pane DOM fullscreen/F11 ownership, reload reading toast, bounded content suggestions and sidebar Downloads are implemented. Downloads keeps real warning/block actions and copies the final network file address from row/menu. 113 runnable checks pass; native test executables are absent. User linking must verify the transition/focus/security/resize matrix and retain B66 Media/Snap acceptance. Generic SPA-only routes, popup WindowProxy-dependent scripts and frame/shadow content indexing remain explicit architecture limits in CHROMIUM_PORT_STATUS.md and RUN6_CHECKLIST.md.

# Ember defects
- **B66 - Media controls still inert and Snap requires composer click (source corrected in 0068, runtime acceptance pending, Codex):** User confirms 0067 fixes Media close crash and adds Capture, but input/autofocus remain broken. Live CDB with native Play clicks resolves the popup root target to ScrollView::Viewport; its child content has 0x0 bounds while the viewport is 300x300. Corrected real content bounds in both scrolling modes and actual native client parenting. Native image paste now uses browser-command semantics rather than the renderer clipboard permission/recent-interaction gate requiring a prior webpage click; destination checks, attachment proof, draft retention and no submission remain. 99 runnable tests and three native object compilations pass. Browser regressions compile only; fixed-binary input and one-click Snap/Capture typing focus await user acceptance. Evidence: C:\src\ember-chromium\run5-0068-input-debug.log.

- **B65 - Media native input/close crash and Snap focus/recapture (source corrected in 0067, awaiting linked runtime, Codex):** User-assisted current-binary CDB reproduction catches ui::EventTarget::RemovePreTargetHandler reading address 0x60 on Media dismissal; source has unconditional unregister after native-window teardown. Removed the glass pre-target handler in favor of a Views Escape accelerator; native bubble frame exposes an explicit client input area while preserving glass/motion. Snap initializes native Blink frame focus before exact-composer validation; bottom-right Capture recaptures the current source into the retained chat, freezes destination ownership and preserves drafts/attachments. Three native objects compile, 99 runnable tests pass, and 67-patch/42-resource checks pass. Native browser regressions are compiled only; fixed Media input/close and Snap autofocus/recapture remain user verification.

- **B64 - Media input, Snap upload/retry errors and distorted artwork (source corrections in 0066, awaiting linked runtime, Codex):** User runtime reports show 0065 Media controls still inert and Snap alternately reports dispatch/readiness/site upload failures. Media/Workspaces/tab-volume now use browser-owned native popup Widgets with activatable control/focus roots and preserved Emberglass material/motion, explicit hiding on immediate switches and safe teardown. Artwork shrinks proportionally into its transparent slot. Blink image-byte paste previously generated an unnamed File; 0066 creates image.png with the original PNG MIME/bytes. Snap retains captures on native focus/dispatch unavailability, rechecks existing dispatched attachments without duplication, handles explicit site failures and same-surface editor recreation after capture proof. Four native objects compile, 98 runnable tests pass, all 66 patches and 42 resource postimages verify. Actual Media pointer/slider/selector behavior and ChatGPT server upload acceptance remain unverified; filename is a format defect, not a confirmed exclusive cause of the reported network error.

- **B63 - Media controls do not receive pointer input / responsive Snap composer missing (corrections implemented in 0065, runtime verification pending, Codex):** Utility hit regions and descendant dispatch now share actual content-space conversion; root targeting explicitly descends into Media/volume/Snap content rather than material/shadow wrappers. Native regressions resolve slider/button/Retry targets after layout and dispatch real Views move/press/release for media track actions. Snap normalizes editable form/composer candidates, deduplicates wrapper/selector matches and rejects hidden/screen-reader legacy fields or ambiguous editors. 94 runnable tests pass; two production objects and browser regressions compile. Live inspection was blocked because computer-use review could not identify Ember's current URL; actual runtime correction remains user verification.

- **B62 - Utility click crash, missing media paint, speaker mute and Snap readiness (source fixed in 0064, awaiting linked runtime, Codex):** Isolated current-binary CDB reproduction identifies OnMouseEvent’s Views-target-to-Aura-window cast; root conversion now uses the widget’s known window/root. Native speaker mute no longer depends on Chrome’s experimental feature flag; shared square feedback and pressed-icon correction retain independent gain. Media uses bounded nonopaque control layers, explicit readable text and preferred-size scrolling. Snap waits for the composer and accepts a bounded same-origin session proof when responsive account DOM is absent; Retry provides readiness feedback. Footer glyphs are balanced without changing targets/feedback/favorites. Native regressions compile, 92 runnable tests pass; actual fixed-browser interactions, paint and authenticated upload remain user verification.

- **B61 - Web surface input blocked / Favorites paint strip (source fixed in 0063, awaiting relink/runtime, Codex):** The full-window layered utility owner vetoes native renderer targeting in Widget::ShouldDescendIntoChildForEventHandling before Views hit testing. Patch 0063 keeps the owner layerless and bounds interactive child layers; capture shade uses its own event-transparent layer with cancellation/teardown handling. Favorites ScrollView’s default dialog background is restored on theme/attachment; 0063 clears its configured background, including its viewport, and does the same for Media scrolling. Native event-routing and theme regressions compile; runnable tests pass 89/89. User relinking and pointer/visual checks remain.

- **B60 - Media artwork crashes after page load (source fixed in 0062, awaiting relink, Codex):** The 2026-10-04 WER dump resolves to ImageSkiaRep’s native-color CHECK, reached from Run 5’s asynchronous media-image callback. MediaSession returns RGBA while Windows ImageSkia requires N32/BGRA. Reproduced using the desktop chrome.exe shortcut’s exact executable, arguments and working directory. Patch 0062 converts decoded pixels to N32, preserving color/alpha and retaining empty/failure fallback and generation cancellation. Production and native regression objects compile; 89 runnable tests pass. Full browser relinking remains user-run.
- **B59 - Run 5 build invalidation / concurrent diagnostic race (in progress, Codex):** GN used a different Python launcher, changing generator fingerprints and scheduling 48,440 actions. A concurrent Ninja dry run could remove the active Rust response/dependency files. Recovery restores the cached launcher and verifies unchanged build-flag command fingerprints/content before restoring their prior timestamps; the three failed Rust targets passed (97 dependency actions). A sequential preserved-file dry plan still schedules 43,652 actions; broad incremental invalidation remains unresolved. No full browser build was run by Codex.

- **B58 - Extensions footer hover artifact (source fixed in 0061, awaiting linked runtime, Codex):** Reparenting retained toolbar InkDrop/composited-layer bounds and toolbar child margins. Footer mode destroys that paint owner, removes inherited margins and uses clipped, centred rounded-square paint with reversible hover timing. Native FocusRing stays deliberate. Repeated state/paint and interrupted/reduced-motion browser tests compile; repeated live enter/leave, native menu closure, DPI and short/wide rail QA await linking.

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
