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

## Verification and QA

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
