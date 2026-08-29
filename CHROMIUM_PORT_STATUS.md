# Ember native Chromium port status

Last updated: 2026-08-29 on branch `chromium-port`.

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
- The first pinned official x64 native build, portable archive and installer,
  plus a sandboxed isolated-profile launch/navigation/shutdown probe. This is a
  native Chromium baseline milestone, not a claim that the Ember shell or
  Electron feature set has been ported.

## Parity matrix

| Subsystem | State | Current evidence / remaining work |
| --- | --- | --- |
| Reproducible source and build architecture | **Passing baseline** | Exact external configuration/common commits prepared twice. Full acquisition, 155-project sync, 134 upstream patches, two Ember patches, substitution, GN generation, 57,877 Ninja actions across two resumable windows, and automatic packaging completed at the pinned revision. Reproducibility on a second clean host remains untested. |
| Product and Windows installer identity | **Partial** | `chrome.exe`/`chrome.dll` report product `Ember` and `mini_installer.exe` reports `Ember Installer`; product, integration, class-ID and SID-family source patches compile. The visible title/About/logo/UA and package filenames still say Chromium/Chrome/ungoogled-chromium, the executable remains `chrome.exe`, and artifacts are unsigned. Installer registry, toast, COM activation, upgrade, uninstall and coexistence are untested. Interface/type-library IDs remain unchanged until IDL plus all persisted x86/x64/arm64 MIDL outputs can be regenerated together. |
| Native Windows top-level window | **Partial** | The first native build created a responding normal HWND and stock Chromium browser/renderer/GPU/utility process tree. Caption hit testing, Snap Layouts, DWM corners, minimise/restore animation, DPI changes, multi-monitor behavior and Ember geometry have not been tested or implemented. |
| Native C++/Views shell | **Not started** | Must reproduce the accepted 32 px top shell, 168 px sidebar, 8 px page inset, 12 px page radius, bounded material, tab strip, navigation controls, and caption reservation without renderer-hosted Electron chrome. |
| Tabs and navigation | **Not started** | Create/select/close/reorder, wheel scroll physics, navigation history, focus, page fullscreen, omnibox resolution, Tab-to-search, bangs, and internal URLs remain Electron-only. |
| Favorites/sidebar/Copy Link | **Not started** | Ordered grid, capacity semantics, matching/wake behavior, tab drops, address editing, and copy feedback remain Electron-only. |
| Profiles, history, downloads, bookmarks, settings, session restore | **Not started** | Must map Ember behavior onto Chromium Profile/Browser/TabStripModel and native storage/lifecycle systems with normal/private isolation. |
| Hibernation | **Not started** | Must preserve every current blocker and cached-thumbnail/scroll/history contract using native renderer lifecycle controls. |
| Extensions | **Not started** | Final port must use Chromium's real extension system, Web Store install path, profiles, actions/popups, permissions, service workers, and lifecycle—not Electron extension emulation. |
| Internal pages and protocol | **Not started** | New tab, settings, history, downloads, bookmarks, unreachable/archive flows, and any retained `ember://` routing need native Chromium integration and security review. |
| Bounded overlays and material | **Not started** | Upload, conversion, context menu, Ctrl+Tab, archive, extension popup, and related focus/capture behavior need native equivalents and image/interaction diffs. |
| Security and privacy model | **Partial** | The isolated runtime used Chromium's browser broker plus GPU, renderer and utility roles with no `--no-sandbox`; real HTTPS navigation succeeded. Windows token/AppContainer, site isolation, permissions, private profiles, telemetry/network defaults, crash reporting, update trust and extension boundaries still require focused audits. |
| Packaging and distribution | **Partial** | A 187.99 MiB portable ZIP and 120.88 MiB installer were produced and hashed. Both package filenames still carry the upstream `ungoogled-chromium` name; binaries are unsigned and install/registry/protocol/upgrade/uninstall/clean-machine behavior has not been exercised. |
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

- Post-build `node --test test/chromium-port.test.js` — 18/18 focused contracts
  pass.
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

- Post-build `npm test` — 400/400 pass with the build-resume/toolchain contracts
  included.
- Post-build `npm run smoke` — pass in 17.8 seconds, with the same three
  frame-dependent assertions explicitly skipped because this host produces no
  capturable runtime frames. One earlier concurrent-build run lost its active
  renderer before the immediate clean-profile retry passed; retain that result
  as a flake signal rather than attributing it to tooling-only changes.
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
  durable `.ninja_log` retained every completed object.
- Second verified resume window (`23:11`–`02:11` BST) loaded 21,241 remaining
  actions and completed all of them without a failed action. Across both windows
  the graph completed all 57,877 actions from 31,404 GN targets / 4,791 files,
  linked `chrome.dll`, `chrome.exe`, `chromedriver.exe` and
  `mini_installer.exe`, then generated both upstream packages.

## First native build and runtime checkpoint

Last recorded: 2026-08-29 02:19 BST.

- **State:** native build and automatic package generation completed successfully
  from the exact pinned source. The first window completed 36,636 actions and
  the second completed the remaining 21,241, for 57,877 / 57,877 total.
- **Source:** exact pinned Chromium `a96602f...`; 109 common, 23 Windows, and two
  Ember patches remain applied.
- **Generated graph:** 57,877 actions from 31,404 GN targets / 4,791 files.
- **Built files:** `chrome.exe` 4,256,768 bytes / SHA-256
  `5E5C205025E20D2ED37939795DBCC85419459AD829FCE34106F0DBE4A90EC5CA`;
  `chrome.dll` 298,944,512 bytes /
  `22062B9734742DE599AA14E76B721C9C904E72D67334F55E92CFC9DA69C4FDC1`;
  `chromedriver.exe` 42,826,752 bytes /
  `2807C0F057343E1BC3E670585B5F6050286D6080053F9E012E918B9C183D2686`;
  `mini_installer.exe` 126,752,768 bytes /
  `D5B5F5391E1C7F17C451EF96DC89D98DB9CA32B64CD75AB10725AE441CBB59D6`.
- **Packages:** upstream-named installer 120.88 MiB with the same hash as
  `mini_installer.exe`; upstream-named portable ZIP 197,120,693 bytes /
  SHA-256 `086F4709240C3DC84192037424B113952549F4743338E53BB7C6A2524ACDDAB6`.
- **Runtime:** a fresh profile at
  `C:\src\ember-chromium\profile-runtime-20260829` launched the built binary
  with DevTools port 9223, no sandbox-disabling flags, three page targets and a
  seven-process browser/GPU/renderer/utility tree. `chrome://version` rendered
  the exact official x64 revision and isolated paths; `https://example.com`
  navigated and rendered successfully. The browser owned a responding normal
  HWND. `Browser.close` then removed all seven processes, the profile singleton
  lock and the debugging listener.
- **Observed gaps:** the visible title/About/logo, CDP browser product and UA
  still identify Chromium/Chrome/ungoogled-chromium; both package filenames are
  upstream-named and the binaries are not signed. The installer was built but
  not executed, so registry/protocol/COM/upgrade behavior is not yet evidence.
- **Disk:** `out\Default` is 15.04 GiB after the official build (including
  objects and PDBs), the runtime profile is 0.01 GiB, and 81.02 GiB remains free.
- **Recovery rule:** rerun the documented `--resume` command; never repeat
  acquisition, unpacking, patching, substitution, or completed object work.

## Current Windows build-host audit

`node chromium/tools/port.js doctor --work-root C:\src\ember-chromium` currently
passes 11/12 initial-acquisition checks. The only failure is expected after the
build: 81.0 GiB free is below the 100 GiB required to acquire a new checkout.
Every toolchain check passes, and the verified prepared checkout remains above
the separate 60 GiB `--resume` floor:

- Windows x64 with 31.9 GiB RAM and a safe short external work root.
- 81.0 GiB free after the completed build versus the 100 GiB new-acquisition
  floor; verified prepared builds may resume above the separate 60 GiB floor.
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

1. Close remaining identity gaps (icons/resources, executable/package names,
   title/About/UA surfaces) as the next reviewable patch unit and keep installer
   registry/COM/upgrade tests isolated from the development machine where
   practical.
2. Add an explicit signing/distribution decision; do not represent unsigned
   development artifacts as release-ready.
3. Implement the first native C++/Views vertical slice: a normal Chromium
   `Browser` window with Ember shell geometry, one functioning tab, omnibox
   navigation, and real Windows caption/Snap behavior.
4. Add deterministic native capture and interaction probes for that slice, diff
   them against the checked-in Electron wide/medium/compact references, and
   update this matrix with evidence rather than estimates.

Do not implement currently planned `ROADMAP.md` features as part of parity. Port
only behavior that exists at the locked Electron oracle commit.
