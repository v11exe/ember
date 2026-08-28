# Ember native Chromium port status

Last updated: 2026-08-28 on branch `chromium-port`.

This is the mutable handoff and parity ledger for the native Chromium fork. It
is deliberately strict: a subsystem is not complete until native runtime
evidence covers its visuals, interaction, lifecycle, platform behavior, and
security boundaries. The Electron application remains the oracle and remains
runnable.

## Locked baseline

| Layer | Revision |
| --- | --- |
| Electron oracle | Ember `main` at `9ae3217b20f72bc05a9ce1b11d9d84ce544c746d` |
| Chromium | `151.0.7922.173` at `a96602f30358e9b5d256a0464e7e4d4bec223004` |
| ungoogled-chromium Windows config | `151.0.7922.173-1.1` at `63f51219bac808e0e5d1d5ba7958ad2aaa159dde` |
| ungoogled-chromium common config | `151.0.7922.173-1` at `4087f48e6d66e55486fe7c3a634303559634ba3f` |
| Helium Windows research reference | `332bb0b40bb27e3b52ee530f35b60625b36732d3` |
| Helium common research reference | Windows-pinned `971d367d47ef82b3b6e3a4454aaf67e82c3e5f03` |

`chromium/baseline.json` is the machine-readable authority. Revision bumps must
update the manifest, rebase every Ember patch, regenerate the Electron/native
comparison evidence as appropriate, and record the result here. Never silently
follow an upstream branch.

## Milestone delivered in this branch

- A real external-checkout architecture, not a vendored Chromium tree or an
  Electron compatibility shim.
- A safe Node CLI for baseline inspection, environment diagnosis, pinned config
  preparation, patch verification, build, packaging, and isolated-profile run.
- Two ordered upstream Chromium patches covering Ember product strings, install
  and profile paths, URL scheme, HTML/PDF ProgIDs, registry/policy roots,
  archive names, installer log name, stable product GUID, Ember-owned toast,
  elevator and tracing class CLSIDs, and an Ember-specific AppContainer SID
  family component.
- Thirty deterministic Electron oracle screenshots spanning the shell at three
  sizes, new tab, sidebar/address states, omnibox states, upload/conversion
  overlays, Ctrl+Tab switcher, and context-menu optics. The manifest records the
  exact geometry and excludes one known blank raw capture.
- Offline visual capture mode so committed references never depend on a fetched
  photograph, plus a less flaky offscreen-paint settling boundary.
- Focused contracts for pins, safe paths, patch ordering/hashing, managed dirty
  paths, deterministic series generation, CLI parsing, GUID/product identity,
  and reference PNG integrity.

## Parity matrix

| Subsystem | State | Current evidence / remaining work |
| --- | --- | --- |
| Reproducible source and build architecture | **Partial** | Exact external configuration/common commits prepared twice successfully. Full source/dependency acquisition, upstream/Ember patching, substitution, and GN generation have completed; the first pinned native build is compiling. |
| Product and Windows installer identity | **Partial** | Two ordered patches apply to a pristine nine-file scratch tree at the exact Chromium commit. Ember owns the product GUID, integration names, toast/elevator/tracing class CLSIDs and sandbox SID family. Chromium interface/type-library IDs intentionally remain unchanged until IDL plus all checked-in x86/x64/arm64 MIDL outputs can be regenerated together. No compiled binary, icon audit, executable rename, About page, installer, registry, toast, COM activation, upgrade or coexistence test yet. |
| Native Windows top-level window | **Not started** | Must use a normal HWND/DWM path with native caption hit testing, Snap Layouts, rounded corners, minimise/restore animation, DPI changes, and multi-monitor behavior. |
| Native C++/Views shell | **Not started** | Must reproduce the accepted 32 px top shell, 168 px sidebar, 8 px page inset, 12 px page radius, bounded material, tab strip, navigation controls, and caption reservation without renderer-hosted Electron chrome. |
| Tabs and navigation | **Not started** | Create/select/close/reorder, wheel scroll physics, navigation history, focus, page fullscreen, omnibox resolution, Tab-to-search, bangs, and internal URLs remain Electron-only. |
| Favorites/sidebar/Copy Link | **Not started** | Ordered grid, capacity semantics, matching/wake behavior, tab drops, address editing, and copy feedback remain Electron-only. |
| Profiles, history, downloads, bookmarks, settings, session restore | **Not started** | Must map Ember behavior onto Chromium Profile/Browser/TabStripModel and native storage/lifecycle systems with normal/private isolation. |
| Hibernation | **Not started** | Must preserve every current blocker and cached-thumbnail/scroll/history contract using native renderer lifecycle controls. |
| Extensions | **Not started** | Final port must use Chromium's real extension system, Web Store install path, profiles, actions/popups, permissions, service workers, and lifecycle—not Electron extension emulation. |
| Internal pages and protocol | **Not started** | New tab, settings, history, downloads, bookmarks, unreachable/archive flows, and any retained `ember://` routing need native Chromium integration and security review. |
| Bounded overlays and material | **Not started** | Upload, conversion, context menu, Ctrl+Tab, archive, extension popup, and related focus/capture behavior need native equivalents and image/interaction diffs. |
| Security and privacy model | **Not started** | No native audit yet for sandboxing, site isolation, permissions, private profiles, telemetry/network defaults, crash reporting, update trust, or extension boundaries. |
| Packaging and distribution | **Not started** | No compiled `chrome.exe`, packaged archive, Ember-named installer, signing, upgrade/uninstall, or clean-machine test. |
| Automated native parity harness | **Not started** | Electron references are present; native deterministic launch/capture, pixel/geometry thresholds, interaction probes, and accessibility checks remain to build. |
| Electron oracle | **Passing baseline capture** | Electron 43.4.1 produced the checked-in offline reference set. Existing Electron source is intentionally retained. |

## Fidelity contract extracted from the oracle

- Shell geometry: top `32`, sidebar `168`, collapsed rail `8`, page inset `8`,
  page radius `12`, bookmark strip `30`, sidebar transition `210 ms`.
- Tabs: minimum `95`, maximum `190`, gap `8`, new-tab control `34`, drag
  reserve `96`, tab height `28`, and radius `6`.
- Motion tokens: fast `110 ms`, normal `180 ms`, slow `280 ms`; navigation
  throw `340 ms`; reload spin `520 ms`.
- The current opaque acrylic window, DWM-owned outer curve, real caption
  controls, sidebar interpolation, bounded views, focus behavior, modifier-release
  handling, and overlay capture alignment are behavioral requirements, not
  Electron implementation requirements.

The visual sources are `src/renderer/theme.css`, `shell-material.css`,
`chrome.css`, `sidebar.css`, and `src/shared/chrome-layout.js`; the promoted
pixels and geometry are under `chromium/reference/electron/9ae3217/`.

## Validation evidence

Completed on this host:

- `node --test test/chromium-port.test.js` — 18/18 focused contracts pass.
- `git diff --check` in the exact Chromium sparse checkout — pass.
- `port.js verify-patches` — both Ember patches apply sequentially in an
  isolated nine-file scratch tree based on exact Chromium commit `a96602f...`;
  the pristine source checkout remains unchanged.
- `port.js prepare` against a new external work root — pass; exact Windows and
  common commits verified.
- A second `prepare` against the same root — pass with both Ember patches; the
  managed series contains exactly two nonduplicated entries and its copied bytes
  match the repository overlay.
- `EMBER_CAPTURE_OFFLINE=1 electron scripts/capture-ui.js ...` — pass with 31
  raw PNGs; 30 nonblank/promoted scenarios are checked in and validated.

- `npm test` — 400/400 pass with the build-resume/toolchain contracts included.
- `npm run smoke` — pass on the required retry. One concurrent-build run failed
  when its active page renderer disappeared during the probe; the immediate
  clean-profile rerun passed and explicitly skipped the same three
  frame-dependent assertions because this host produces no capturable runtime
  frames. Keep the first result as a flake signal; it is not attributed to these
  Chromium-tooling-only changes.
- `npm start` — live application launch confirmed, then stopped deliberately
  with Ctrl+C. A persisted third-party extension logged its pre-existing
  unsupported `chrome.tabs.onRemoved` service-worker error; Ember itself
  launched.
- `port.js doctor --work-root C:\src\ember-chromium` — 12/12 exact host checks
  pass after installing VS 2026 C++/ATL/MFC and the SDK Debugging Tools.
- The first full build acquired 504,294 source objects, synced all 155 gclient
  projects, downloaded the pinned PGO/LLVM/Rust inputs, applied 109 common plus
  23 Windows upstream patches and both Ember patches, completed domain
  substitution, and generated a 31,404-target Ninja graph from 4,791 GN files.
- First `port.js build --work-root C:\src\ember-chromium --jobs 18 --resume`
  Ninja window — reached the upstream CI timeout after the full 3.5 hours
  (`15:08:21`–`18:38:18` BST). No failed compiler action was reported. The
  durable `.ninja_log` contains 86,159 completion records and its latest outputs
  are Blink modules/V8 bindings. `chrome.exe`, `chromedriver.exe`, and
  `mini_installer.exe` are not linked yet, so this is progress evidence rather
  than a completed build claim.

## Live native build checkpoint

Last recorded: 2026-08-28 23:59 BST.

- **State:** second verified Ninja window active since 23:11 BST. Ninja reported
  21,241 remaining actions after loading the existing graph, proving the first
  window completed 36,636 / 57,877 actions (63.3%). The resumed window has now
  completed another 4,241 actions, putting the durable total at 40,877 / 57,877
  (70.63%) with exactly 17,000 actions remaining. There is still no failed
  action.
- **Source:** exact pinned Chromium `a96602f...`; 109 common, 23 Windows, and two
  Ember patches remain applied.
- **Generated graph:** 57,877 actions from 31,404 GN targets / 4,791 files.
- **Latest durable outputs:** Blink modules/V8 binding objects at the end of the
  first 12,597,493 ms Ninja log window; the second window resumed from those
  outputs, linked `proto_extras_plugin.exe` and
  `country_native_names_generator.exe`, and has progressed through Blink web
  platform, Autofill/payment, DevTools, core `content/browser`, public browser
  interfaces, Mojo/protobuf generators, performance-manager and Viz service
  objects.
- **Final artifacts:** not present yet. Do not mark packaging/runtime complete.
- **Recovery rule:** rerun the documented `--resume` command; never repeat
  acquisition, unpacking, patching, substitution, or completed object work.

## Current Windows build-host audit

`node chromium/tools/port.js doctor --work-root C:\src\ember-chromium` currently
passes all 12 required checks:

- Windows x64 with 31.9 GiB RAM and a safe short external work root.
- 104.0 GiB free during the latest audit versus the 100 GiB acquisition floor;
  verified prepared builds may resume above the separate 60 GiB floor.
- Git 2.42, Python 3.12.1 with `httplib2==0.22.0`, 7-Zip, and long paths.
- Visual Studio Build Tools 2026 18.9.1 with the core x86/x64 C++ tools and
  ATL/MFC.
- Windows SDK directory 10.0.26100.0 with file version 10.0.26100.8249 and x64
  SDK Debugging Tools `dbghelp.dll` version 10.0.26100.7705.

Initial acquisition retains the 100 GiB floor. A prepared build may use
`--resume`: the tool verifies the pinned source commit and that both Ember
patches reverse cleanly in an isolated scratch tree, repairs only an incomplete
GN bootstrap, and retains the source and incremental objects. A child-only
`python3.bat` shim avoids the broken Windows Store alias, while the verified
Build Tools path is supplied through `vs2026_install` because this host installed
it under Program Files (x86).

COM coexistence remains a source-level blocker even after the host is ready:
Ember-specific interface and type-library IDs require coordinated edits to both
Windows IDLs and every persisted `third_party/win_build_output/midl` artifact
for x86, x64, and arm64, including binary `.tlb` files regenerated by MIDL.
Changing install metadata alone would break QueryInterface/build consistency,
so this baseline deliberately changes only class CLSIDs.

## Next vertical slice

1. Finish the active pinned Ninja build and fingerprint the first Windows
   `chrome.exe`, `chromedriver.exe`, `mini_installer.exe`, and package.
2. Launch the native binary with an isolated profile; verify visible
   Ember identity, profile paths, installer registry keys, protocol registration,
   process tree, sandbox, and startup/shutdown behavior.
3. Close remaining identity gaps (icons/resources, executable/install artifacts,
   About/version surfaces) as the next reviewable patch unit.
4. Implement the first native C++/Views vertical slice: a normal Chromium
   `Browser` window with Ember shell geometry, one functioning tab, omnibox
   navigation, and real Windows caption/Snap behavior.
5. Add deterministic native capture and interaction probes for that slice, diff
   them against the checked-in Electron wide/medium/compact references, and
   update this matrix with evidence rather than estimates.

Do not implement currently planned `ROADMAP.md` features as part of parity. Port
only behavior that exists at the locked Electron oracle commit.
