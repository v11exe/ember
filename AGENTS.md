# AGENTS.md — Ember native browser

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
- New Tab is Ember brand plus search. Realbox Mojo owns ranked suggestions and navigation. Bang resolution is shared by New Tab and sidebar and gives an explicit alias priority without stealing exact internal commands or reachable hosts.
- The optional Unsplash New Tab mode uses an Appearance toggle, topic dropdown and profile-local Access Key. It disables the NTP's native DWM translucency, fetches the chosen photo through the browser process, centers and crops its data image on resize, and credits the photographer. The Secret Key is never requested.
- The New Tab search lens blurs a viewport-anchored copy of the photo inside its clipped surface in opaque Unsplash mode. CSS backdrop-filter computed but left the photo visibly sharp in this WebUI. A transparent DWM-backed New Tab cannot supply stable renderer pixels to a CSS/SVG backdrop filter; applying one there previously fed old frames back into the lens.
- A ChatGPT Bang submission is armed only by an explicit Quick Search, stays in memory for the current tab, and sends only when the exact composer and enabled Send button match. A changed draft is left alone.
- Explicit tab sleep uses Chromium's external discard reason and refreshes tab UI state. Visible/in-use tabs and split panes remain protected.
- EmberGlass capture normalizes transparent renderer pixels before blur/refraction. Clear the owning ScrollView background, not only child cards. Bubbles must capture the requesting page or split pane and adapt foreground to backdrop brightness.
- Upload convenience choices enter `FileSelectHelper` with the original frame/listener. Closing the picker cancels that request. Private profiles do not persist recent uploads.
- Selection conversion uses local pure rules in an isolated renderer world. It is anchored to the selected frame and bounded to its content surface. Only recognized foreign currency triggers a fixed rate-table request; no selected text or page URL is sent.
- Use the official Ember logo assets already in `chromium/resources`. Extension controls belong to the sidebar footer and collapse with it.
- Chromium Settings Appearance owns the Favorite grid/list and the selection-conversion preferences. Do not reintroduce Electron preference stores or a second Settings UI.

## Verification and QA

`npm test` runs the remaining native repository tests. `npm run chromium:check-patches` validates patch hunks. The `port.js` prepared-state check reverses the full applied stack in scratch and checks copied resources. A pristine checkout can run `npm run chromium:verify-patches`.

Drive an existing browser through its remote debugging port; synthetic OS input can steal the user's keyboard. Put visual test windows on the user's second monitor (currently PL288H left of primary, bounds `-1920,224,1920×1080`); re-enumerate after display changes. Record commands, results and known unverified behavior in `CHROMIUM_PORT_STATUS.md`.

Source files use LF. Verify multiline changes and `git diff --check` before handoff.
