# AGENTS.md â€” Ember native browser

Repository: `v11exe/ember`, branch `chromium-port`. Windows x64, native Chromium C++/Views and WebUI. Read this before changing code. Electron remains on `main` as the fixed parity oracle; it is no longer built from this branch.

`/graphify`: use the graphify skill when explicitly requested.

## Where things live

- `README.md`: product and everyday commands.
- `ROADMAP.md`: authoritative numbered feature requirements and compatibility guardrails.
- `CHROMIUM_PORT_STATUS.md`: current build evidence, open runtime checks and next action.
- `BUGS.md`: live native defects awaiting verification.
- `chromium/baseline.json`: immutable upstream and oracle pins.
- `chromium/patches/series`, `chromium/patches/ember/`: ordered native source changes.
- `chromium/resources/manifest.json`: copied branding, glass, New Tab, font and conversion resources.
- `chromium/tools/port.js`: preparation, build, package and validation orchestration.
- `test/chromium-port.test.js`, `test/conversions.test.js`: native integration contracts and pure conversion rules.
- External checkout: `C:\src\ember-chromium\configuration\build\src`; build output: `out\Default` beneath it.

## Development contract

1. Keep all native work on `chromium-port` until the user changes that decision. Do not merge into `main`, delete Electron history, or replace Chromium with an Electron launcher/shim.
2. Keep Chromium source, downloads, profiles and build output outside the repository. Source changes belong in the ordered patch stack; copied assets belong in the resource manifest. Preserve license files.
3. Treat `baseline.json` as a revision lock. Do not silently track an upstream branch or mix revision families. Preparation must remain deterministic, idempotent and unwilling to overwrite foreign edits.
4. Use Chromium's real Profile, Browser, TabStripModel, navigation, downloads, permissions, sandbox and extension systems. Keep a normal Windows HWND and OS-native window behavior.
5. Compile affected objects and WebUI targets, run focused tests, verify patch postimages/resources, and record runtime limits. A screenshot or successful object compile is never a substitute for focus, security, lifecycle or extension interaction checks.
6. The user runs the final full `chrome` build for this parity pass. Do not start a full Ninja browser build or clear `.ninja_log`, generated graph, profiles or incremental outputs.
7. Never change Windows COM interfaces or type-library IDs only in install metadata. Change the owning IDL and regenerate all persisted MIDL outputs in the same slice, then test registration and upgrade.
8. For a numbered ROADMAP feature, read its complete section and global rules, map shared state and lifecycle dependencies, inspect the actual implementation and tests, then choose architecture. Update the roadmap only after evidence supports the status.

## Native shell invariants

- Run 6 acceptance correction 0071 uses sibling native settings-section cards with outside titles, single toggle labels and unchanged preferences/routes. Ember's real OmniboxController must enable unscoped_open_tab_suggestions; the upstream false default otherwise prevents ordinary sidebar title/content matching before OpenTabProvider starts. Exact tab/document/URL/profile metadata owns both acceptance and live favicon; retain the query while traversing rows, show Open in Different Tab, preserve bangs and never wake renderers for a query. Native regression sources enter mouse/keys through Aura; final linked acceptance remains user-run.
- Run 6 build correction 0070 dereferences the CreateNewWindow Mojo-contract non-null referrer before constructing content::Referrer. The late 0069 popup-route edit escaped the earlier compile claim; the actual focused Ninja browser object now passes. Preserve URL/policy and compile the final source after late edits; user performs full linking/runtime acceptance.
- Run 6 / patch 0069 adds native settings groups, SplitTabData-owned following, fullscreen-within-tab/F11 ownership, tab-local reading return, bounded content suggestions and Downloads. Footer order is Downloads, Media, Workspaces, Snap, Extensions, Settings (236 DIP). Keep native download models/security subpages and final-address copy; preserve warning colors with the Downloads-only dark/native foreground glass option. Reused rows and popup generations protect live updates. Runtime acceptance remains user-run.
- Follower routing must validate split ID AND epoch, exact source/destination and live source document before dispatch; swap/orientation preserve page identities. Native same-tab link attribution and popup/security paths remain authoritative; never replay POST or infer arbitrary SPA navigation. Reading toast capture uses EmberGlassView::SetPanel through the existing capture stream, never a second background paint owner. Content indexing is local/limited and exact-profile; queries cannot wake discarded tabs.

- Recent work (2026-10-04, Codex): B66 / patch 0068 corrects the live-proven zero-sized Media ScrollView content and the browser image-paste command's inappropriate renderer clipboard-read gate. Touches utility controller, native WebContents paste and focused browser regressions; 99 runnable tests and three native object compilations pass. Prior uncommitted work is preserved; runtime acceptance follows the user's final link.
- Media's manually positioned ScrollView contents need real 300x300 bounds as well as preferred size: Windows uses bounds-based scrolling and otherwise layered controls paint over a zero-sized input container. Native utility surfaces belong under GetClientContentsView(). Test both scrolling feature states.
- Browser-owned image paste follows native Paste command semantics; do not apply renderer clipboard-read IPC/recent-page-interaction checks to an explicit sidebar capture action. Keep exact focused-frame and caller profile/origin/document/generation validation, attachment proof and no submission; never grant website clipboard permissions to make Snap work.

- Utility popup controls use a decoration-free native bubble frame with explicit client hit testing. Escape is a Views accelerator; never register the glass View itself as an Aura pre-target handler or dereference a native window during post-native Views teardown. Native input regressions must enter through Aura, not only RootView.
- Snap recapture retains its visible WebView and chat/draft, freezes the current destination document/URL, and takes the focused source page at its current size before focus changes. Initialize native Blink frame focus before revalidating/focusing the genuine composer.

- Keep the hidden `TabStripComboButton`: BrowserView's tab-search bubble host depends on it. Reserve its margin only when visible.
- The horizontal `TabStrip` is direct content of a layered `ScrollView` with `SetUseContentsPreferredSize(true)`. The New Tab button stays at the viewport edge; wheel easing lives in `TabStripScrollContainer`, and reduced motion scrolls immediately.
- The compact Forward button stays outside Chromium's responsive overflow. `IDC_FORWARD` owns enabled state and navigation.
- Background-tab drags must not select/wake the source. Reorder with `MoveWebContentsAt(..., false)`; selected-tab drags retain Chromium's native detach path. Favorite and split previews use an event-transparent live Views surface, not a bitmap.
- The Favorite rail stores bookmark IDs. Grid dimensions control visible capacity; shrinking must preserve hidden bookmarks. An unfilled cell is an invisible spacer, not a painted tile. Drops insert/reorder/replace according to capacity.
- A transfer of the final tab closes the source window. Do not reseed New Tab during `TabDragController::Detach()`; an ordinary final-tab close does reseed it.
- New Tab is Ember brand plus search. Realbox Mojo owns its ranked suggestions and navigation. Floating search reparents the existing native LocationBarView into a BrowserView overlay and restores layer opacity/input events. Normal-window native result rows attach below that input in the same chrome-owned glass surface; LocationBarView retains ownership and the native controller/ranking/favicons. Dismiss the whole surface before tab/split/sidebar-mode changes and before returning the location view to ToolbarView at destruction. Outside-click checks include the results/close controls, and Escape reaches the native textfield controller. App windows retain the upstream popup widget. Bang resolution is shared with New Tab, including pasted prefix/suffix aliases, explicit alias priority, internal commands and reachable-host precedence.
- The optional Unsplash New Tab mode uses an Appearance toggle, topic dropdown and profile-local Access Key. It disables the NTP's native DWM translucency, fetches the chosen photo through the browser process, centers and crops its data image on resize, and credits the photographer. The Secret Key is never requested.
- The New Tab search lens blurs a viewport-anchored copy of the photo inside its clipped surface in opaque Unsplash mode. CSS backdrop-filter computed but left the photo visibly sharp in this WebUI. A transparent DWM-backed New Tab cannot supply stable renderer pixels to a CSS/SVG backdrop filter; applying one there previously fed old frames back into the lens.
- A ChatGPT Bang submission is armed only by an explicit Quick Search, stays in memory for the current tab, and sends only when the exact composer and enabled Send button match. A changed draft is left alone.
- Explicit tab sleep uses Chromium's external discard reason and refreshes tab UI state. Visible/in-use tabs and split panes remain protected.
- EmberGlass capture normalizes transparent renderer pixels before cached blur/refraction, then applies a neutral smoke tint and light foreground. Clear the owning ScrollView background, not only child cards. Browser-owned bubbles capture the requesting page or split pane; external extensions' own popup content is excluded. Embedded search captures skip widget movement and close hooks; cached backgrounds follow result/resize bounds without stretching a short input capture, and generations reject stale capture callbacks. Search uses the existing EmberGlassTransition for opening, closing and height retargets; logical dismissal is immediate, cached native rows survive only the closing reveal, and interrupted reopening detaches them before restarting the controller.
- The default rail is 52px; the persisted Appearance wide option is 96px. Both use one column of 36px square tiles with the original 19px favicons. Legacy visible capacity migrates to at most seven rows without deleting hidden bookmark IDs. The sidebar native rectangle starts below the 32px caption row, so its backing cannot occlude the genuine horizontal mark; thin search sits below that row and above Favorites, with the floating surface anchored beside it. Wide/collapsed Ctrl+L uses the same browser-level left anchor; native extension overflow receives the actual footer width, centered in thin mode and right-aligned in wide mode.
- Normal Windows chrome uses supported DWM acrylic continuously, with an opaque fallback if the API fails; root perimeter paint excludes child shell surfaces to avoid double tint. Website and opaque-NTP viewport backings remain intact. Transparent New Tabs use one focus-independent predicate, disabled by Unsplash mode. Split layouts have an additional MultiContentsBackgroundView: clip transparent NTP viewports out of that backing, keep website backings opaque, and repaint when the native backdrop state changes. Read existing slots through web_contents(); GetWebContents() creates an untabbed page in an empty slot and crashes tab-dependent observers. SetFillsBoundsOpaquely is valid only for textured layers; solid-color layers derive opacity from SetColor and CHECK-fail on that setter.
- Upload convenience choices enter `FileSelectHelper` with the original frame/listener. Closing the picker cancels that request. Private profiles do not persist recent uploads.
- Selection conversion uses local pure rules in an isolated renderer world. It is anchored to the selected frame and bounded to its content surface. Only recognized foreign currency triggers a fixed rate-table request; no selected text or page URL is sent.
- Use the official Ember logo assets already in `chromium/resources`. Extension controls belong to the sidebar footer and collapse with it.
- Chromium Settings Appearance owns the Favorite grid/list and the selection-conversion preferences. Do not reintroduce Electron preference stores or a second Settings UI.

- Run 5 utilities have one BrowserView-owned controller. Native Extensions, transient media/workspace/volume popovers and floating search dismiss one another; Snap source-page input leaves its dedicated side page open. Closing Snap retains its WebContents/draft; teardown releases it. Capture freezes the focused split source before dismissing other surfaces or resizing.
- Transient Media/Workspaces/tab-volume surfaces use native browser-owned popup Widgets (0066), explicitly activatable for native controls/keyboard focus. Keep their EmberGlassView material/motion; immediate switches hide the old native window and teardown closes pending widgets. Snap alone remains in the layerless browser utility view.
- Keep the full-window utility controller layerless. Widget native-child targeting tests layer rectangles before Views custom hit tests; transparent full-window interactive layers still block renderer input. Bound interactive layers to their actual surfaces and mark capture-feedback layers event-transparent. Clear ScrollView configuration with SetBackgroundColor(std::nullopt), including its viewport; SetBackground(nullptr) alone is restored by theme/attachment changes.
- Footer feedback paints a clipped 28 DIP rounded square inside each 36 DIP button. Footer Extensions disables the old toolbar InkDrop and inherited child margins; keep native FocusRing. Favorites scroll before the bottom-anchored six-button footer shrinks.
- Media artwork shrinks proportionally into its 72 DIP slot without background bars; small images retain their size.
- MediaSession artwork is decoded as RGBA; ImageSkiaRep requires native N32 (BGRA on Windows) and enforces it with a release CHECK. Convert pixels before creating native artwork; failed/empty conversions use the existing fallback.
- Tab gain is browser-owned WebContents state, separate from mute: 1.0 default, 0.0–2.0 native audio-group PCM gain, carried through discard replacement. Media opening never writes it; its slider intentionally writes only 0.0–1.0. Encoded passthrough cannot receive PCM gain.
- Native image-byte paste creates a named image.png File with PNG MIME, matching ordinary clipboard file naming without using the clipboard. Retry retains undispatched captures and rechecks dispatched attachments without repasting; same-surface editor recreation waits for matching capture proof.
- Snap uses normal Profile cookies, native image-byte paste and isolated-world composer checks; it never invokes the bang helper or Send. Match SHA-256 of the captured PNG, new attachment evidence and the site's enabled Send readiness before claiming attachment. Source/destination document, URL and generation guard async callbacks. Do not restore a system-clipboard implementation or infer upload success from native dispatch.

- Preserve the exact cached GN Python launcher when regenerating: this checkout uses `C:/src/ember-chromium/tool-shims/python3.exe`, not the real interpreter path. Even equivalent launchers change Ninja generator fingerprints. Check the pending plan before handoff.
- Never run another Ninja process, including `-n`, against an output directory with an active build. Ninja 1.12.1 dry runs still create/remove response files and may remove dependency files. For stopped-build planning use `-d keeprsp -d keepdepfile`; compilation and planning remain sequential.

## Verification and QA

### Active work - 2026-10-04 - Codex - Media crash and Snap recapture

- Status: source corrections captured in 0067; 99 runnable tests and patch checks pass. Current user binary reproduced under CDB; linked fixed-binary acceptance remains pending.
- Touches: next ordered patch 0067, native utility event hosting/teardown, Snap composer focus and same-chat Capture, regression tests and records.
- Preserve: all existing uncommitted work, approved material/geometry, normal profile, successful image upload, drafts, native media/gain and incremental outputs.


### Active work - 2026-10-04 - Codex - Native utility popup and image paste corrections

- Status: source corrections implemented in 0066; four native objects compile, 98 runnable tests pass and 66-patch/42-resource prepared checks pass. Linked acceptance remains user-run.
- Touches: native popup ownership/focus/teardown, Media artwork fitting, Blink paste File naming, Snap readiness/retry proof, composer tests and records.
- Preserve: all prior local edits, glass/motion/geometry, native sessions/tab gain and clipboard-free/no-send Snap.


### Active work - 2026-10-04 - Codex - Utility targets and responsive composer

- Status: corrections implemented in 0065; two production objects/native regressions compile and 94 runnable tests pass. Linked runtime verification remains user-run.
- Touches: ordered patch 0065, direct utility descendant targeting/regressions, usable Snap editable normalization and isolated tests.
- Preserve: all previous uncommitted work, accepted geometry, source ownership, drafts and incremental outputs. Native computer inspection was blocked because review could not verify Ember’s current URL; no bypass.

### Active work - 2026-10-04 - Codex - Utility interaction corrections

- Status: source corrections in 0064; current-binary isolated CDB reproduction identifies the Views event target miscast in outside-click handling. Final browser link and acceptance remain user-run.
- Touches: utility root coordinates, bounded Media control paint/scroll sizing, unconditional native speaker mute with shared interrupted/reduced-motion feedback, balanced footer vectors, Snap session/composer readiness and regression coverage.
- Preserve: existing uncommitted Run 5 work, approved glass/search, original favorite icons, cached GN commands, profiles and incremental outputs.
- Contract: utility event targets can be Views or Aura windows; use known widget/root coordinates. Responsive Snap account DOM can be absent: same-origin session proof is bounded/cancellable, contains only a boolean, and never authorizes guest paste or message submission.


### Active work - 2026-10-04 - Codex - Native page input and Favorites paint

- Status: source fixed in 0063; traced the full-window utility layer native-targeting veto and ScrollView’s restored default dialog background. Affected objects/native regressions compile; runtime checks remain user-run.
- Touches: patch 0063, bounded utility/capture layers, configured transparent scrolling and native event-routing/theme regressions.
- Preserve: accepted glass, five-button footer, all existing uncommitted work, outputs and profiles; user performs final linking.

### Active work - 2026-10-04 - Codex - Media artwork crash

- Status: source fixed in 0062; reproduced with the desktop shortcut launch configuration and matched the original crash dump. Affected objects/regression compile, 89 runnable tests pass; user relinking is pending.
- Touches: patch 0062, artwork conversion and native regression coverage, bug/status records.
- Preserve: all Run 5 work, cached GN commands, profiles and outputs; no full browser build by Codex.

### Active work - 2026-10-03 - Codex - Run 5 utilities

- Status: source/checks complete on `chromium-port`; full browser linking and runtime acceptance remain user-run.
- Touches: ordered patch 0061, native footer/utility ownership, media-session UI, tab audio gain, reusable ChatGPT side page, focused tests and records.
- Checklist: source/reference inspection, implementation, affected-object compilation, runnable tests, patch/resource postimages and final diff reviewed. Native tests compile only; linked browser acceptance is pending.
- Preserve: accepted 0060 glass/search geometry, all existing patches, resources, profiles and incremental outputs. Workspaces is a placeholder; #12/#13 stay planned.

### Active work - 2026-10-03 - Codex - Accepted glass polish

- Status: user verified 0059 transparency and approved the dark glass. Patch 0060 implements a small alpha reduction, caption/corner paint ownership and search control/favicon corrections; focused compilation and patch/resource checks pass, awaiting user linking.
- Paint contract: exclude only the rounded viewport from root shell paint, retaining matching tint at its exterior corners. TopContainerView reserves ToolbarView's pixels instead of painting another tint underneath; resting normal-window caption buttons omit their extra base fill and retain native hover/press behavior.
- Icon contract: the host owns the single magnifier. Native provider slots show real favicons; History-only misses fetch the configured icon URL through the existing profile BitmapFetcherService, with coalescing, memory cache, weak callbacks and cancellation. Preserve extension-provided icons, original handlers and bang semantics.
- Feedback contract: sidebar search has hover/press/open feedback. Search actions retain their native hit targets while painting centered 28 DIP rounded squares. The user performs final browser linking.

### Active work - 2026-10-03 - Codex - Transparent host and compact search

- Status: patch 0059 follows the user's successful 0058 build; focused native compilation and postimage/resource checks pass, awaiting user linking and visual runtime checks.
- Host contract: normal Ember custom captions must retain DesktopWindowTreeHostWin's transparent-compositor policy. The upstream custom-titlebar veto silently restored opaque Aura roots during frame changes. Keep fullscreen and app-window behavior.
- Search contract: LocationIconView owns its background override; suppress the backplate there through icon/theme updates, preserving the favicon and accessible action. Floating input is 40 DIP, resting panel 52 DIP including its border, with keyword insets preserving the actual icon size.
- Preserve opaque website/Unsplash surfaces, existing New Tab transparency predicates, native handlers and the previous patch stack. User performs the full browser build.

### Active work - 2026-10-02 - Codex - Search construction crash and shell correction

- Status: source fixed in patch 0058 after 0057, with production objects and regression translation unit compiled; user performs linking/runtime verification.
- Crash contract: suggestion ellipsis/separator text is constructed before its row has a Widget/ColorProvider. Initialize detached RenderText neutrally and let the existing attached match update apply native colours.
- Shell contract: remove opaque titlebar underpaint, route direct shell palette IDs through shared dark DWM tint, declare sidebar layer non-opaque, and clip all four corner underlays to the rounded exterior. Preserve approved menu/search material and exact geometry.

### Active work - 2026-10-02 - Codex - Run 4 correction pass

- Status: patch 0057 follows the verified 0056 startup guard; source corrections and focused compilation are complete, awaiting the user browser link and runtime QA.
- Touches: neutral native suggestion roles, fixed keyword/favicon/separator spacing, stable removal lane, copy/close proportions, damage-driven renderer glass, shared shell tint/corner ownership and one Extensions perimeter.
- Contract: preserve approved CPU smoke/refraction, native providers/models and existing motion. Renderer frames are bounded to eight FPS and exclude chrome/extension overlays; transparent New Tabs keep the DWM fallback. The user runs the final full browser build.

### Active work - 2026-10-02 - Codex - Startup registration guard

- Status: fixed and runtime verified in user-rebuilt binary; fresh/existing profiles and exact desktop shortcut open successfully. Original WER offset resolved using the linked PDB.
- Touches: LocationBarView layout and focus-ring BrowserView lookups; preserve all previous patches.
- Contract: BrowserView lookup may be null during initial toolbar layout before native window registration. User performs relinking.

### Active work - 2026-10-01 - Codex - Run 3 search reform

- Status: source implemented on `chromium-port`, awaiting user linking/runtime QA; preserve earlier patches and accepted geometry.
- Touches: native search/bang presentation, keyboard traversal, existing shared motion, genuine corner-logo occlusion, DWM/shared glass, copy anchor and New Tab suggestions.
- Contract: user performs final full browser build.

### Active work - 2026-10-01 - Codex - Run 2 corrections

- Status: source fixed on `chromium-port`, awaiting the user build and linked runtime checks; preserve accepted run 1 tab/tile geometry and all native models.
- Touches: floating native input/results ownership and lifecycle, sidebar search placement, shared smoke, split group boundary, browser-owned Extensions framing, New Tab icon binding, ordered patch 0054 and regression coverage.
- Contract: no final full browser build; user performs final linking.

### Active work â€” 2026-10-01 â€” Codex â€” Approved visual revamp

- Status: source implemented on `chromium-port`; user build linked successfully but hit a diagnosed split-backing startup CHECK; source corrections for the layer CHECK and an empty-slot WebContents creation crash are ready for incremental rebuild.
- Touches: native shell/sidebar/search, split-tab presentation, shared browser-owned glass/menu surfaces, New Tab resources, patch stack and validation.
- Contract: preserve Chromium handlers, Realbox ranking and Bang parsing; external extension content and website/OS surfaces stay unchanged. The user runs the final full browser build.

`npm test` runs the remaining native repository tests. `npm run chromium:check-patches` validates patch hunks. The `port.js` prepared-state check reverses the full applied stack in scratch and checks copied resources. A pristine checkout can run `npm run chromium:verify-patches`.

Drive an existing browser through its remote debugging port; synthetic OS input can steal the user's keyboard. Put visual test windows on the user's second monitor (currently PL288H left of primary, bounds `-1920,224,1920Ã—1080`); re-enumerate after display changes. Record commands, results and known unverified behavior in `CHROMIUM_PORT_STATUS.md`.

Source files use LF. Verify multiline changes and `git diff --check` before handoff.
