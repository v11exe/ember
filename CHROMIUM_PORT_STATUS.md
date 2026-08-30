# Ember native Chromium port status

Last updated: 2026-08-30 on branch `chromium-port`.

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
- Five ordered upstream Chromium patches covering Ember product strings, install
  and profile paths, URL scheme, HTML/PDF ProgIDs, registry/policy roots,
  archive names, installer log name, stable product GUID, Ember-owned toast,
  elevator and tracing class CLSIDs, and an Ember-specific AppContainer SID
  family component. The third patch owns visible window, About/version,
  accessibility, relaunch, default-browser, uninstall, and startup-error text;
  the fourth advances Windows shortcut-icon migration and the fifth replaces
  Chromium's shared WebUI product glyph.
- A deterministic 18-file Ember branding overlay for the Windows executable,
  scaled raster logos, About artwork, shared WebUI SVGs, and generated ICO. The
  build hook hashes that overlay and invalidates Chromium's two untracked `.rc`
  outputs only when its bytes change.
- Thirty deterministic Electron oracle screenshots spanning the shell at three
  sizes, new tab, sidebar/address states, omnibox states, upload/conversion
  overlays, Ctrl+Tab switcher, and context-menu optics. The manifest records the
  exact geometry and excludes one known blank raw capture.
- Offline visual capture mode so committed references never depend on a fetched
  photograph, plus a less flaky offscreen-paint settling boundary.
- Focused contracts for pins, safe paths, patch ordering/hashing, managed dirty
  paths, deterministic series generation, CLI parsing, GUID/product identity,
  and reference PNG integrity.
- The pinned official x64 native build, final five-patch/18-resource branding
  rebuild, portable archive and installer, plus sandboxed isolated-profile
  launch/navigation/icon/accessibility/shutdown probes. This is a native
  Chromium baseline milestone, not a claim that the Ember shell or Electron
  feature set has been ported.

## Parity matrix

| Subsystem | State | Current evidence / remaining work |
| --- | --- | --- |
| Reproducible source and build architecture | **Passing baseline** | Exact external configuration/common commits prepared repeatedly. Full acquisition, 155-project sync, 134 upstream patches, substitution, GN generation, the original 57,877-action build, the 2,910-action visible-identity rebuild, the 476-action intermediate resource build, and the final 952-action five-patch/18-resource rebuild plus automatic packaging completed at the pinned revision. Reproducibility on a second clean host remains untested. |
| Product and Windows installer identity | **Practical baseline complete** | `chrome.exe`/`chrome.dll` report product `Ember`; live window/HWND titles, About/version content, Settings About title, accessibility/default-browser/relaunch strings, deterministic package filenames, executable/HWND icons, About art, Settings toolbar logo, and the About-menu glyph are Ember-owned. Direct PE and live HWND extraction prove the icon path rather than relying on shell cache. The stable Chrome UA and CDP `Chrome/...` token remain intentional for compatibility. The executable name stays upstream and artifacts remain unsigned; deep installer registry/toast/COM/upgrade/uninstall/coexistence testing is deferred for this friends-only build while UI parity is prioritized. Interface/type-library IDs remain unchanged unless IDL plus every persisted x86/x64/arm64 MIDL output can be regenerated together. |
| Native Windows top-level window | **Partial** | The first native build created a responding normal HWND and stock Chromium browser/renderer/GPU/utility process tree. Caption hit testing, Snap Layouts, DWM corners, minimise/restore animation, DPI changes, multi-monitor behavior and Ember geometry have not been tested or implemented. |
| Native C++/Views shell | **Next active slice** | Reproduce the accepted 32 px top shell, 168 px sidebar, 8 px page inset, 12 px page radius, bounded material, tab strip, navigation controls, and caption reservation without renderer-hosted Electron chrome. |
| Tabs and navigation | **Not started** | Create/select/close/reorder, wheel scroll physics, navigation history, focus, page fullscreen, omnibox resolution, Tab-to-search, bangs, and internal URLs remain Electron-only. |
| Favorites/sidebar/Copy Link | **Not started** | Ordered grid, capacity semantics, matching/wake behavior, tab drops, address editing, and copy feedback remain Electron-only. |
| Profiles, history, downloads, bookmarks, settings, session restore | **Not started** | Must map Ember behavior onto Chromium Profile/Browser/TabStripModel and native storage/lifecycle systems with normal/private isolation. |
| Hibernation | **Not started** | Must preserve every current blocker and cached-thumbnail/scroll/history contract using native renderer lifecycle controls. |
| Extensions | **Not started** | Final port must use Chromium's real extension system, Web Store install path, profiles, actions/popups, permissions, service workers, and lifecycle—not Electron extension emulation. |
| Internal pages and protocol | **Not started** | New tab, settings, history, downloads, bookmarks, unreachable/archive flows, and any retained `ember://` routing need native Chromium integration and security review. |
| Bounded overlays and material | **Not started** | Upload, conversion, context menu, Ctrl+Tab, archive, extension popup, and related focus/capture behavior need native equivalents and image/interaction diffs. |
| Security and privacy model | **Partial** | The isolated runtime used Chromium's browser broker plus GPU, renderer and utility roles with no `--no-sandbox`; real HTTPS navigation succeeded. Windows token/AppContainer, site isolation, permissions, private profiles, telemetry/network defaults, crash reporting, update trust and extension boundaries still require focused audits. |
| Packaging and distribution | **Development packages built** | The final 188.22 MiB portable ZIP and 120.91 MiB installer are emitted as deterministic `ember_151.0.7922.173-1.1_*_x64` artifacts, with a generated ownership manifest that permits safe replacement of prior managed packages but never overwrites foreign bytes. They contain the final rebuilt Ember icon/resources. Binaries are unsigned and install/registry/protocol/upgrade/uninstall/clean-machine behavior is intentionally deferred while UI parity is built. |
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

- Current resource/tooling `node --test test/chromium-port.test.js` — 25/25
  focused contracts pass. They cover five-patch ordering/apply/reverse,
  18-resource path and image validity, no-op copies that preserve timestamps,
  content-hashed configuration upgrades, RC invalidation markers, and managed
  package replacement/tamper refusal.
- Current `prepare` — two consecutive passes with five Ember patches, 18 exact
  resources, schema-3 source/configuration hashes, and no duplicated series
  entries. Applied postimages reverse cleanly in an isolated 15-file tree.
- Final `build --resume` preflight — all five patches, all 18 resources and all
  12/12 doctor checks passed with 67.1 GiB free. Ninja completed the final 952
  executed actions, including both explicitly invalidated RC outputs,
  `chrome.dll`, resource packs, `chrome.exe`, mini installer and packages.
- Current `npm test` — 408/408 pass. Current `npm run smoke` — pass in 11.5
  seconds with the same three frame-dependent assertions explicitly skipped on
  this no-capturable-frame host. A preceding cold-start run exposed that the
  harness cached `tabs.active` before chrome created its first tab; the harness
  now awaits readiness and has a focused regression contract. Current
  `npm start` — live Electron oracle launch confirmed and stopped deliberately;
  the persisted third-party extension emitted its pre-existing unsupported
  API/service-worker errors.
- Post-identity-build `node --test test/chromium-port.test.js` — 20/20 focused
  contracts pass.
- `git diff --check` in the exact Chromium sparse checkout — pass.
- Historical post-identity patch verifier — all three then-current Ember patches apply sequentially in an
  isolated 13-file scratch tree based on exact Chromium commit `a96602f...`;
  all three applied postimages also reverse cleanly from the prepared checkout,
  and the pristine source remains unchanged.
- Historical post-identity `port.js prepare` against a new external work root — pass; exact Windows and
  common commits verified.
- A second historical `prepare` against the same root — pass with all three then-current Ember patches;
  the managed series contains exactly three nonduplicated entries and its copied
  bytes match the repository overlay.
- `EMBER_CAPTURE_OFFLINE=1 electron scripts/capture-ui.js ...` — pass with 31
  raw PNGs; 30 nonblank/promoted scenarios are checked in and validated.

- Post-identity-build `npm test` — 402/402 pass with the visible-identity and
  collision-safe package-normalization contracts included.
- Post-identity-build `npm run smoke` — pass in 11.8 seconds, with the same three
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
  23 Windows upstream patches and the first two Ember patches, completed domain
  substitution, and generated a 31,404-target Ninja graph from 4,791 GN files.
- First `port.js build --work-root C:\src\ember-chromium --jobs 18 --resume`
  Ninja window — reached the upstream CI timeout after the full 3.5 hours
  (`15:08:21`–`18:38:18` BST). No failed compiler action was reported. The
  durable `.ninja_log` retained every completed object.
- Second verified resume window (`23:11`–`02:11` BST) loaded 21,241 remaining
  actions and completed all of them without a failed action. Across both windows
  the graph completed all 57,877 actions from 31,404 GN targets / 4,791 files,
  linked `chrome.dll`, `chrome.exe`, `chromedriver.exe` and
  `mini_installer.exe`, then generated both upstream-named packages. The later
  identity slice rebuilt affected outputs and normalized those names.

## First native build and runtime checkpoint (historical baseline)

Last recorded: 2026-08-29 02:19 BST.

- **State:** native build and automatic package generation completed successfully
  from the exact pinned source. The first window completed 36,636 actions and
  the second completed the remaining 21,241, for 57,877 / 57,877 total.
- **Source:** exact pinned Chromium `a96602f...`; 109 common, 23 Windows, and the
  first two Ember patches were applied at this checkpoint.
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
- **Observed gaps at this checkpoint:** the visible title/About/logo, CDP
  browser product and UA identified Chromium/Chrome/ungoogled-chromium; both
  package filenames were upstream-named and the binaries were not signed. The
  visible strings and package-name parts of this observation are superseded by
  the checkpoint below.
- **Disk:** `out\Default` is 15.04 GiB after the official build (including
  objects and PDBs), the runtime profile is 0.01 GiB, and 81.02 GiB remains free.
- **Recovery rule:** rerun the documented `--resume` command; never repeat
  acquisition, unpacking, patching, substitution, or completed object work.

## Visible identity and packaging checkpoint

Last recorded: 2026-08-29 19:20 BST.

- **Patch:** `0003-ember-visible-product-surfaces.patch` changes the pinned
  Chromium GRIT resources and version WebUI binding for Ember window, About,
  accessibility, relaunch, default-browser, uninstall, and error surfaces. It
  deliberately leaves the stable `Chrome/...` UA token unchanged for website
  compatibility.
- **Build:** the verified incremental rebuild began with 2,910 actions. At
  `808/1751`, several independent Clang processes failed together while Windows
  logged event 26, `Virtual Memory Minimum Too Low`. The generated 340 MiB of
  Clang crash reports were removed after the evidence was captured. Resuming
  the same checkout with `--jobs 6` compiled those exact translation units and
  completed all 951 remaining actions, including GRIT output, `chrome.dll`,
  `chrome.exe`, locale packs, setup, mini installer, and packages. This is host
  memory-pressure evidence, not a source failure.
- **Runtime identity:** a fresh isolated profile launched the rebuilt binary
  without sandbox-disabling flags. Its HWND titles were `New Tab - Ember` and
  `About Version - Ember`; `chrome://version` rendered `The Ember Authors`, the
  Ember copyright, and `Ember 151.0.7922.173 (Official Ember Build, ungoogled
  Chromium base) (64-bit)`; `chrome://settings/help` titled itself `Settings -
  About Ember`. DevTools `Browser.close` left zero browser processes.
- **Built files:** `chrome.exe` 4,256,768 bytes / SHA-256
  `5E5C205025E20D2ED37939795DBCC85419459AD829FCE34106F0DBE4A90EC5CA`;
  `chrome.dll` 298,944,512 bytes / SHA-256
  `71B54A3702A580B8630795F13C01AE5CB421886B974A14DD499782E8156F94C6`.
- **Packages:** `ember_151.0.7922.173-1.1_installer_x64.exe`, 126,717,952
  bytes (120.85 MiB), SHA-256
  `50C27C8249272F479BC503147346A9EBAEA23BE21B840A9D5E89FBDF57F7F6A0`;
  `ember_151.0.7922.173-1.1_windows_x64.zip`, 197,125,680 bytes (187.99
  MiB), SHA-256
  `B3664297C371907C0A54D7A2610E095D3377B70CFBEC99C5DB3F0CDAEDEBE31D`.
  The package directory contains only these two Ember-named artifacts.
- **Remaining identity work:** replace upstream icons/About logo, decide whether
  renaming `chrome.exe` is worth the compatibility and upstream-maintenance
  cost, audit CDP identity, test the installer integrations, and establish a
  signing/distribution policy.
- **Disk:** 76,254,695,424 bytes (71.02 GiB) remained free after the rebuild.

## Native branding-resource checkpoint (complete)

Last recorded: 2026-08-30 18:50 BST.

- **Prepared source:** five Ember patches and 18 overlay destinations. The
  resources are generated deterministically from Ember's canonical square and
  horizontal meteor assets and cover the multi-image Windows ICO, 16–256 px
  product rasters, About rasters, static product/animation SVG wrappers, and the
  shared dark WebUI logo. Patch four increments the Windows profile shortcut
  icon version from 10 to 11; patch five replaces the shared monochrome
  `cr:chrome-product` path.
- **Overlay architecture:** the exact pinned Windows `build.py` receives a
  small configuration patch that validates every manifest path, copies only
  differing bytes, hashes the full overlay, and deletes only
  `chrome_exe.res`/`chrome_dll.res` when the hash changes. This closes the
  discovered Ninja gap where `.rc` includes do not track an updated ICO. A
  schema-3 generated-state hash allows later overlay versions to replace only
  exact previously managed configuration bytes.
- **Final build:** after the disk gate passed at 67.1 GiB free, all 12 host
  checks passed and `--jobs 6 --resume` completed the final 952 executed Ninja
  actions. The first action rebuilt `chrome_dll.res`; action 948 rebuilt
  `chrome_exe.res`; the optimized DLL/executable links, PDB allowlist scan,
  locale/resource packs, mini installer and managed package generation all
  completed without a source failure.
- **Built binaries:** `chrome.exe`, 4,263,936 bytes, SHA-256
  `DC354C3328FC3E67277AE458D2DFF1078F53989E009B946AF7905D45F9003FE6`;
  `chrome.dll`, 298,952,192 bytes, SHA-256
  `BACE40B8A17962E120C61843ADBBE0C90410803D8C2981E3E9452E3FA259CB42`.
- **Final packages:**
  `ember_151.0.7922.173-1.1_installer_x64.exe`, 126,781,952 bytes, SHA-256
  `01FCED3F412D382C4D2194DDE7945A732307F1F0C05D43520F58C9DDB418ABDD`;
  `ember_151.0.7922.173-1.1_windows_x64.zip`, 197,359,769 bytes, SHA-256
  `C94A178347BC4135076FE1E7A4AF3411BA611823CF2041AB7CEDFCE949C1E873`.
  `.ember-packages.json` records the same lengths and hashes.
- **Runtime evidence:** direct `PrivateExtractIcons` extraction from the rebuilt
  PE returned the gold 256 px Ember meteor from resource ID 4. The live HWND
  title was `Settings - About Ember - Ember`, and its `GCLP_HICON` was the gold
  32 px Ember meteor. CDP navigation rendered the Settings toolbar logo, About
  card art, and About-menu meteor as Ember, while its accessibility tree exposed
  `About Ember`, the exact official build label and Ember copyright. The stable
  Chrome UA/CDP token remained intact. `Browser.close` left zero matching
  browser processes and no profile singleton artifacts.
- **Compatibility decision:** source audit showed
  `ChromeContentBrowserClient::GetProduct()` also namespaces GPU shader caches,
  while ChromeDriver's pinned parser accepts only `Chrome/` and
  `HeadlessChrome/`. CDP `Browser: Chrome/151.0.7922.173` and the stable Chrome
  UA token remain intentional automation/site-compatibility surfaces; visible
  product identity stays Ember.
- **Scope decision:** this is sufficient practical product identity for Ember's
  small friends-only distribution. Executable renaming, signing, clean-machine
  install/upgrade/uninstall, deep registry/toast/COM coexistence and shortcut
  migration runtime matrices remain documented but are deferred. Engineering
  now moves to the visible native C++/Views shell and existing Ember features.

## Current Windows build-host audit

`node chromium/tools/port.js build --work-root C:\src\ember-chromium --jobs 6
--resume` passed 12/12 prepared-build checks and completed the final resource
rebuild:

- Windows x64 with 31.9 GiB RAM and a safe short external work root.
- 67.1 GiB free at build start versus the 60 GiB prepared-build floor and
  100 GiB new-acquisition floor; 62.8 GiB remained after build/runtime work.
- Git 2.42, Python 3.12.1 with `httplib2==0.22.0`, 7-Zip, and long paths.
- Visual Studio Build Tools 2026 18.9.1 with the core x86/x64 C++ tools and
  ATL/MFC.
- Windows SDK directory 10.0.26100.0 with file version 10.0.26100.8249 and x64
  SDK Debugging Tools `dbghelp.dll` version 10.0.26100.7705.

Initial acquisition retains the 100 GiB floor. A prepared build may use
`--resume`: the tool verifies the pinned source commit and that all five Ember
patches reverse cleanly in an isolated 15-file scratch tree, verifies all 18
resources, repairs only an incomplete GN bootstrap, and retains the source and
incremental objects. A child-only
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

1. Implement the first native C++/Views shell slice on the real Chromium
   `BrowserView`: Ember's 32 px top chrome, 168 px sidebar, 8 px page inset,
   native tab strip, omnibox/navigation controls, and Windows caption reservation.
2. Keep real Chromium `Profile`, `Browser`, `TabStripModel`, navigation and
   renderer security as the backing systems; do not recreate an Electron shim.
3. Add deterministic native capture and interaction probes for wide, medium and
   compact layouts, then compare them to the checked-in Electron oracle.
4. Port the existing sidebar/Favorites/Copy Link and tab interaction contracts
   in small functioning slices after the basic shell geometry works.
5. Revisit signing and installer integration only when the friends-only build
   needs distribution hardening; do not block UI parity on those release-scale
   tasks.

Do not implement currently planned `ROADMAP.md` features as part of parity. Port
only behavior that exists at the locked Electron oracle commit.
