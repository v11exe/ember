# Ember native Chromium port status

Last updated: 2026-09-03 on branch `chromium-port`.

**Read this first:** the native build host is healthy at 12/12 checks, the
pinned external checkout and incremental build graph are preserved at
`C:\src\ember-chromium`, and patch 0008 (native Favorites) is built, packaged,
and runtime-verified. Preserve that checkout and its `.ninja_log`; the next
bounded slice is the measured patch-0007 address/Copy correction.

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
- Eight ordered upstream Chromium patches covering Ember product strings, install
  and profile paths, URL scheme, HTML/PDF ProgIDs, registry/policy roots,
  archive names, installer log name, stable product GUID, Ember-owned toast,
  elevator and tracing class CLSIDs, and an Ember-specific AppContainer SID
  family component. The third patch owns visible window, About/version,
  accessibility, relaunch, default-browser, uninstall, and startup-error text;
  the fourth advances Windows shortcut-icon migration and the fifth replaces
  Chromium's shared WebUI product glyph. The sixth patch begins the real native
  shell by reserving Ember's sidebar and page geometry in `BrowserView`; the
  seventh adds a live active-tab address chip and functional Copy Link feedback;
  the eighth adds a bookmark-backed 2x2 Favorite grid. All eight patches are
  built and runtime-verified.
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
- The pinned official x64 native build, final branding rebuild, first native
  shell rebuild, portable archive and installer, plus sandboxed isolated-profile
  launch/navigation/icon/accessibility/geometry/shutdown probes. This is the
  practical identity baseline and first functioning shell slice, not full
  Electron feature parity.

## Parity matrix

| Subsystem | State | Current evidence / remaining work |
| --- | --- | --- |
| Reproducible source and build architecture | **Healthy on primary host** | The restored host passes 12/12 checks. A fresh pinned acquisition applied 109 common, 23 Windows, and all eight Ember patches; the final 466-action resume completed the Favorites rebuild and packaging. The external checkout, `out/Default`, and `.ninja_log` are preserved at `C:\src\ember-chromium`. Two consecutive prepares are idempotent, all eight patch files pass structural hunk validation, and the prepared postimages verify in an isolated 20-file tree. Reproducibility on a second clean host remains untested. |
| Product and Windows installer identity | **Practical baseline complete** | `chrome.exe`/`chrome.dll` report product `Ember`; live window/HWND titles, About/version content, Settings About title, accessibility/default-browser/relaunch strings, deterministic package filenames, executable/HWND icons, About art, Settings toolbar logo, and the About-menu glyph are Ember-owned. Direct PE and live HWND extraction prove the icon path rather than relying on shell cache. The stable Chrome UA and CDP `Chrome/...` token remain intentional for compatibility. The executable name stays upstream and artifacts remain unsigned; deep installer registry/toast/COM/upgrade/uninstall/coexistence testing is deferred for this friends-only build while UI parity is prioritized. Interface/type-library IDs remain unchanged unless IDL plus every persisted x86/x64/arm64 MIDL output can be regenerated together. |
| Native Windows top-level window | **Partial** | A responding normal 1570×796 HWND now owns the first Ember shell geometry while retaining the real browser/renderer/GPU/utility process tree. Caption hit testing, Snap Layouts, DWM corners, minimise/restore animation, DPI changes and multi-monitor behavior still need focused tests. |
| Native C++/Views shell | **Partial — three native slices built** | Patch 0006 creates the native 168 px rail and 8 px page inset for normal browser windows. Patch 0007 adds the live active-tab address chip and Copy Link behavior. Patch 0008 adds the persistent bookmark-backed Favorite grid with measured icon-only geometry and cross-window tab reuse. All three are built and runtime-verified. Patch 0007 still needs its measured visual correction before the stock Chromium top chrome is compacted; the accepted measurements are in the two native parity specs under `docs/superpowers/specs/`. |
| Tabs and navigation | **Not started** | Create/select/close/reorder, wheel scroll physics, navigation history, focus, page fullscreen, omnibox resolution, Tab-to-search, bangs, and internal URLs remain Electron-only. |
| Favorites/sidebar/Copy Link | **Partial — baseline behavior live** | The native rail follows committed navigation and active-tab changes, writes the exact active visible URL to the Windows copy/paste clipboard, announces `Copied`, and resets after 1.2 seconds. The built 2x2 Favorite grid persists the three oracle defaults exactly once, paints 70×43 icon-only controls with 19 px favicon/fallback images, and reuses matching tabs across native windows without duplicating targets. Address editing, grid capacity settings, native add/remove/reorder, tab drops, and the satisfaction animation remain Electron-only. |
| Profiles, history, downloads, bookmarks, settings, session restore | **Not started** | Must map Ember behavior onto Chromium Profile/Browser/TabStripModel and native storage/lifecycle systems with normal/private isolation. |
| Hibernation | **Not started** | Must preserve every current blocker and cached-thumbnail/scroll/history contract using native renderer lifecycle controls. |
| Extensions | **Not started** | Final port must use Chromium's real extension system, Web Store install path, profiles, actions/popups, permissions, service workers, and lifecycle—not Electron extension emulation. |
| Internal pages and protocol | **Not started** | New tab, settings, history, downloads, bookmarks, unreachable/archive flows, and any retained `ember://` routing need native Chromium integration and security review. |
| Bounded overlays and material | **Not started** | Upload, conversion, context menu, Ctrl+Tab, archive, extension popup, and related focus/capture behavior need native equivalents and image/interaction diffs. |
| Security and privacy model | **Partial** | The isolated runtime used Chromium's browser broker plus GPU, renderer and utility roles with no `--no-sandbox`; real HTTPS navigation succeeded. Windows token/AppContainer, site isolation, permissions, private profiles, telemetry/network defaults, crash reporting, update trust and extension boundaries still require focused audits. |
| Packaging and distribution | **Development packages built** | The current eight-patch build emits a 197,385,870-byte portable ZIP (`FE576E11…A838`) and 126,777,344-byte installer (`2D78FF75…C845`) as deterministic `ember_151.0.7922.173-1.1_*_x64` artifacts, with a generated ownership manifest that permits safe replacement of prior managed packages but never overwrites foreign bytes. Binaries are unsigned and install/registry/protocol/upgrade/uninstall/clean-machine behavior is intentionally deferred while UI parity is built. |
| Automated native parity harness | **Partial** | The Electron references are present, `chromium/tools/capture-native.js` records wide/medium/compact native captures through CDP, and the Favorites slice used Windows UI Automation plus target identities, persisted profile bytes, HWND capture, and graceful CDP shutdown. Interaction thresholds and broader native lifecycle coverage still need to be committed. |
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

- Final eight-patch structural check — `npm run chromium:check-patches` validates
  every hunk body/count before acquisition. Two consecutive prepares are
  idempotent, and `verifyPreparedBuildState` proves all applied Ember postimages
  in an isolated 20-file scratch tree plus all 18 resource destinations.
- Final `node --test test/chromium-port.test.js` — 33/33 focused contracts pass,
  including the native Favorites source/lifecycle contract, both measured
  parity specifications, the capture runner, and the patch hunk checker.
- Final Electron oracle `npm start` — launched normally and was stopped
  deliberately after the live window appeared. The persisted third-party
  extension emitted its already-recorded unsupported API/service-worker errors.
- Final Favorites build — a deliberate review checkpoint retained the Ninja
  graph after 118 of 583 queued actions; the definitive resume completed all
  466 remaining actions. `browser_view.obj` compiled at action 55, the UI
  library and `chrome.dll` linked, `chrome.exe` completed at action 463, and
  installer/portable packaging completed at actions 464–466. Only unrelated
  upstream warnings were emitted.
- Final eight-patch artifacts:
  - `browser_view.obj`: 1,119,924 bytes / SHA-256
    `596ACBACF9B69874041E0955B4E8331E7AC3960D767A21085A15E71D19F135D1`.
  - `chrome.dll`: 298,979,840 bytes / SHA-256
    `9694E4261B1D32D8AB8D3936162F2F42B8EF690111625948A55F99EF387F2F02`.
  - `chrome.exe`: 4,263,936 bytes / SHA-256
    `DC354C3328FC3E67277AE458D2DFF1078F53989E009B946AF7905D45F9003FE6`.
  - installer: 126,777,344 bytes / SHA-256
    `2D78FF75EF45E6C60D14798F8B4689599C2C80FD6C0032BB65598F7A448CC845`.
  - portable ZIP: 197,385,870 bytes / SHA-256
    `FE576E117A0BF1D49BE4003196019305DD97A4AA23901E6F09291B948135A838`.
- Final Favorites runtime — a clean 900×556 native window exposed Google,
  YouTube, and Google Calendar as accessible 70×43 buttons at `(136,172)`,
  `(216,172)`, and `(136,225)`, proving exact 10 px horizontal/vertical gaps.
  Those coordinates still reflect patch 0007's stale rail padding/address-row
  placement; they prove the Favorite grid's internal geometry, not final rail
  placement. Patch 0007's measured correction is the next slice.
  The fresh-profile HWND capture showed centred fallback glyphs rather than
  blank tiles. Invoking Google from another tab preserved the exact Google CDP
  target ID and page-target count. A second native window painted the Google
  tile's open state (`#433B36` interior versus resting YouTube `#2B221C`), and
  invoking it activated the original Google HWND while preserving the same
  target identity. Clean close/relaunch retained exactly one `Ember Favorites`
  folder and the same three defaults; the `Bookmarks` SHA-256 stayed
  `30BA4042B28E52D64D16DF7DB4A9451B336E38D402F1834EF2E875D2FB808308`.
  A final process audit found the browser, GPU, three renderer, and two utility
  processes with zero `--no-sandbox` flags. All runs ended with zero matching
  profile processes and zero singleton artifacts.

- Historical seven-patch resource/tooling `node --test test/chromium-port.test.js` — 27/27
  focused contracts pass. They cover seven-patch ordering/apply/reverse,
  18-resource path and image validity, no-op copies that preserve timestamps,
  content-hashed configuration upgrades, RC invalidation markers, and managed
  package replacement/tamper refusal.
- Final eight-patch `prepare` — two consecutive passes with 18 exact resources,
  schema-3 source/configuration hashes, and no duplicated series entries.
  Applied postimages reverse cleanly in an isolated 20-file tree.
- Sidebar feature `build --resume` preflight — all seven patches, all 18
  resources and all 12/12 doctor checks passed with 67.7 GiB free. The main
  incremental build completed 583 actions. Final visual QA removed an exposed
  Windows mnemonic from the custom button; its focused object compile passed,
  the 338-action rebuild hit one transient `undname.exe` miss after linking,
  the isolated resource-allowlist retry passed, and the verified resume
  completed all remaining 335 resource/executable/installer/package actions.
- Sidebar runtime — a fresh isolated normal HWND exposed the formatted active
  URL and clean `Copy` button through Windows UI Automation. Invoking the
  button placed the exact active visible URL on the clipboard, changed its
  accessible label to `Copied`, and reset to `Copy` after 1.2 seconds. Creating
  a second tab and reactivating the first updated the rail in both directions.
  Eight browser/GPU/renderer/utility processes ran with zero `--no-sandbox`
  flags; normal close left zero processes and no singleton artifacts.
- Current `npm test` — 410/410 pass. Current `npm run smoke` — pass in 12.2
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

## First native shell geometry checkpoint

Last recorded: 2026-08-30 23:50 BST.

- **Patch:** `0006-ember-native-shell-geometry.patch` adds an Ember-owned Views
  child to normal `BrowserView` windows and threads it through the current
  `BrowserViewLayoutViews`/`BrowserViewTabbedLayoutImpl` path. It reserves
  168 px before Chromium lays out its real tabs, toolbar, side panels, dialogs
  and contents, then insets only the page region by 8 px on every edge.
  Fullscreen hides the rail and removes both reservations.
- **Compile/build:** the three directly affected objects compiled first. Two
  consecutive deterministic prepares then passed with six patches, and the
  official `--jobs 6 --resume` build completed 584/584 actions including the
  optimized DLL/executable links, resource allowlist, locale packs, installer
  and portable package.
- **Runtime geometry:** a deterministic green page in a 1570×796 live window
  produced a screenshot with the exact rail color `#1A100A` at x=8..175
  (168 px), black page gap at x=176..183 (8 px), and live contents beginning at
  x=184. The page also retained its 8 px trailing and bottom gaps. This is real
  Views layout, not an overlay or screenshot mock.
- **Runtime security/lifecycle:** the sandboxed run contained seven processes
  across browser, GPU, renderer and utility roles with no `--no-sandbox` flag.
  The title was `Ember Shell Geometry - Ember`; `Browser.close` removed all
  processes and profile singleton artifacts.
- **Built binaries:** `chrome.exe`, 4,263,936 bytes, SHA-256
  `DC354C3328FC3E67277AE458D2DFF1078F53989E009B946AF7905D45F9003FE6`;
  `chrome.dll`, 298,953,216 bytes, SHA-256
  `CCF868272BCCC3718291E617F5A2B9E3F1827B3F572CE6718A6F05DEA0B7F078`.
- **Packages:** installer 126,778,880 bytes / SHA-256
  `623B9C0C706935663AF23B51B24252BA96D5814DB40A86E56E89A73F260C147B`;
  portable ZIP 197,369,205 bytes / SHA-256
  `89B4FA0C69F94985151A736AA8CEA37AF6CC8D302ECDA7308EDE3D36F99FC8C6`.
- **Historical visual gap:** this checkpoint deliberately contained only the
  structural rail. Patches 0007 and 0008 subsequently added address/Copy and
  Favorite controls; Chromium's stock tab/toolbar presentation still remains.

## Native sidebar address and Copy Link checkpoint

Last recorded: 2026-08-31.

- **Patch:** `0007-ember-sidebar-address-copy-link.patch` touches only
  `browser_view.cc` and `browser_view.h`. It extends the patch-0006 rail with a
  native Views address row, observes the already-active `WebContents`, formats
  its visible URL, and refreshes on active-tab, toolbar and committed primary
  navigation updates. It does not create a second tab or navigation model.
- **Copy behavior:** the focusable native button writes `GetVisibleURL().spec()`
  to `ClipboardBuffer::kCopyPaste`, changes to `Copied`, emits an accessibility
  announcement, then returns to `Copy` after 1,200 ms. Empty/invalid URLs keep
  the action disabled. Visual QA caught and removed the localized Windows
  mnemonic that initially painted `&Copy` in this custom surface.
- **Build:** two consecutive prepares proved the seven-patch series idempotent,
  the focused `browser_view.obj` compile passed, and the official wrapper
  completed the native UI graph, DLL/executable, resource packs, mini installer
  and managed packages. One post-link PDB allowlist pass encountered a transient
  `Unexpected undname output`; the correctly configured isolated retry passed,
  and verified `--resume` completed the remaining 335 actions without relinking
  the DLL. This is recorded as a tooling flake, not hidden as a source pass.
- **Runtime interaction:** Windows UI Automation exposed the exact URL label and
  clean `Copy` button. An InvokePattern action copied
  `http://127.0.0.1:8878/ember-copy-final` byte-for-byte, showed `Copied`, and
  reset after the bounded timer. A CDP-created second tab showed
  `127.0.0.1:8878/ember-second-final?active=1`; reactivating the first target
  restored the original label. The HWND-native screenshot is
  `C:\src\ember-chromium\runtime-ui-0007-final.png` (external evidence only).
- **Security/lifecycle:** the isolated profile used eight normal Chromium
  browser/GPU/renderer/utility processes with zero `--no-sandbox` flags. CDP
  retained the intentional `Chrome/151.0.7922.173` compatibility token. Normal
  window close left zero processes and no SingletonLock/Cookie/Socket.
- **Built binaries:** `chrome.exe`, 4,263,936 bytes, SHA-256
  `DC354C3328FC3E67277AE458D2DFF1078F53989E009B946AF7905D45F9003FE6`;
  `chrome.dll`, 298,957,824 bytes, SHA-256
  `9FC6229785F57E0A8945A083D03F818072F0E661D9DBA850831142DDA982D2AD`.
- **Packages:** installer 126,767,616 bytes / SHA-256
  `AA59F26AAF2D52087AB845B719433E2EE8A6BB9883692E93A8A4E6A5A188F10A`;
  portable ZIP 197,375,610 bytes / SHA-256
  `DA1FBD88CAFE10F9F67B6ECBFE6F02FD4F18D01D318B9B2A1A0409A16AF1157E`.
- **Known visual gap, now measured (2026-09-01):** this is functional but
  intentionally plain, and the exact distance from the oracle is recorded in
  `docs/superpowers/specs/2026-09-01-native-sidebar-visual-parity.md`. In short:
  the row is 36 px where the oracle is 33, radius 9 where it is 7, fill `.188`
  where it is `.075`, with no border, hover or focus state; the rail's insets
  are `Insets(8)` where the oracle is `34/9/8/9` with a 10 px row gap; the text
  is `.902` where it is `.82` and middle-elides where the oracle clips; the URL
  goes through `url_formatter::FormatUrl()` instead of Ember's own rule, which
  strips the scheme for https as well as http; and the Copy control is a gold
  `Copy` text button where the oracle is a 26 px transparent button holding a
  12×7 white link glyph, with the confirmation raised as a separate bounded
  toast rather than by relabelling the button. Focus-to-edit and sidebar
  collapse are not implemented natively at all.

## Build host restored — 2026-09-02, reverified 2026-09-03

The Claude development host is healthy again and `doctor` reports **12/12**.
What was missing, and what fixed it:

- `LongPathsEnabled` set to `1` (plus `git config --system core.longpaths true`).
  This was the hard blocker — Chromium cannot even be checked out without it.
- Visual Studio **Build Tools 2026 18.9.1** installed at
  `C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools` with
  `VC.Tools.x86.x64`, `VC.ATLMFC` and the 26100 SDK component. The winget id is
  `Microsoft.VisualStudio.BuildTools` — there is no `...2026.BuildTools` id.
- SDK **Debugging Tools 10.0.26100.7705**. `winget install` for the SDK will
  *not* add this: it sees the SDK already installed and skips the override
  entirely. The cached installer matching the installed SDK exactly, under
  `C:\ProgramData\Package Cache\{204d0387-...}\winsdksetup.exe`, run with
  `/features OptionId.WindowsDesktopDebuggers /quiet /norestart`, does add it.
- `httplib2==0.22.0` reinstalled.

The external checkout still had to be rebuilt from nothing: `C:\src\ember-chromium`
had been deleted along with `out/Default` and `.ninja_log`, so this is a full
fresh acquisition and a complete build, not a resume. `build --resume` refuses
outright when the source root is missing; the first build on a clean host takes
no `--resume`.

That fresh acquisition is now complete. The final pinned checkout, output tree,
and new `.ninja_log` are present at `C:\src\ember-chromium`; the 2026-09-03
reboot audit again passed all 12 doctor checks with 101.6 GiB free. Resume this
state for the next slice—do not reacquire it as part of routine validation.

## Historical build host regression — 2026-09-01

The external checkout and the entire native toolchain are gone from this host.
No native compile, build, package or runtime probe is possible until they are
restored. The audit below it is the *historical* healthy state, retained so the
restored host can be compared against it.

- `C:\src\ember-chromium` does not exist. The ~15 GiB `out/Default`, all built
  binaries and both generated packages are gone with it. Nothing named
  `ember_151*` remains anywhere on `C:`.
- `node chromium/tools/port.js doctor --work-root C:\src\ember-chromium` now
  reports **8/12**:
  - **FAIL** Visual Studio 2026 C++ — only `Visual Studio Build Tools 2022`
    17.14.37614.0 (installed 2026-08-25) is present. `baseline.json` pins
    product line 2026 / major 18.
  - **FAIL** SDK Debugging Tools —
    `C:\Program Files (x86)\Windows Kits\10\Debuggers\x64\dbghelp.dll`
    is missing.
  - **FAIL** Long paths — `HKLM\SYSTEM\CurrentControlSet\Control\FileSystem`
    `LongPathsEnabled` is `0`. Chromium cannot be checked out without it.
  - **FAIL then FIXED** Python httplib2 — reinstalled as `0.22.0`.
  - PASS: Windows x64, 31.1 GiB RAM, 1315.5 GiB free, Git 2.55.0, Python
    3.12.10, 7-Zip, Windows SDK 10.0.26100.7705 in 10.0.26100.0.
- Restoring the host requires an elevated install of VS 2026 Build Tools with
  `Microsoft.VisualStudio.Component.VC.Tools.x86.x64` and
  `Microsoft.VisualStudio.Component.VC.ATLMFC`, the SDK Debugging Tools
  feature, and `LongPathsEnabled = 1`. After that, `build` performs a full
  fresh acquisition (100 GiB free floor) and a complete rebuild, not a resume —
  `.ninja_log` is gone, so no object work survives.
- `prepare` still works and was re-run twice on 2026-09-01: it only clones the
  pinned configuration repository and its common submodule, which is small.
  Both passes emitted exactly eight nonduplicated Ember series entries.

## Native Favorites result — 2026-09-03 (built and runtime-verified)

- **Patch:** `0008-ember-sidebar-favorites.patch` exists, is eighth in the
  series, and touches only `browser_view.cc`/`browser_view.h`. It makes
  `BrowserView` a `bookmarks::BaseBookmarkModelObserver`, finds or creates a
  metadata-marked `Ember Favorites` folder under Other Bookmarks, seeds
  Google / YouTube / Google Calendar exactly once behind a separate
  `ember_favorites_initialized` marker on the other node, and rebuilds a 2×2
  grid of 70×43 focusable icon-only buttons from the folder's first four
  HTTP(S) children. Cached favicons and `favicon::GetDefaultFavicon()` both go
  through the same exact 19×19 resize path, so an uncached clean-profile tile
  is never blank.
- **Matching:** root shortcuts match a normalized host (`www.` stripped, lower
  cased) or any child subdomain of it, preferring an already-open direct-host
  root tab; non-root shortcuts match normalized host plus exact path, ignoring
  query and fragment. Activation searches `GlobalBrowserCollection`, uses the
  owning window's `TabStripModel::ActivateTabAt` on a match, and calls
  `chrome::AddTabAt` only when nothing matches. Open-state refresh is broadcast
  to all same-profile normal `BrowserView`s.
- **Measured visuals:** the completed patch uses the oracle's 98 px grid box,
  70×43 tiles, 10 px gaps, 7 px radius, 19×19 centred image, resting
  fill/border alphas `0x13`/`0x06`, hover fill `0x21`, and open
  fill/border alphas `0x2E`/`0x0E`. Pressed scale is `.97` over the shared
  130 ms cubic timing; reduced motion applies state immediately. Names remain
  available through tooltip and accessibility properties without painting text.
- **Evidence:** patch hunk validation, focused contracts, two idempotent prepares,
  isolated applied-postimage verification, the final native object/DLL/EXE and
  package build, fresh-profile HWND capture, Windows UI Automation, CDP target
  identities, two-window activation, persistent bookmark bytes, relaunch, and
  clean shutdown all pass. Exact actions, hashes, coordinates, and profile hash
  are recorded in the validation section above.
- **Unimplemented by design so far:** dragging tabs into Favorites, editing or
  removing Favorites natively, configurable grid capacity (fixed 2×2 / first
  four children), empty-slot and drop-target treatments, and the
  `favorite-satisfied` animation.

## Historical Windows build-host audit

`node chromium/tools/port.js build --work-root C:\src\ember-chromium --jobs 6
--resume` passed 12/12 prepared-build checks and completed the sidebar rebuild:

- Windows x64 with 31.9 GiB RAM and a safe short external work root.
- 67.7 GiB free at the final build start versus the 60 GiB prepared-build floor
  and 100 GiB new-acquisition floor; 66.27 GiB remained after build/runtime work.
- Git 2.42, Python 3.12.1 with `httplib2==0.22.0`, 7-Zip, and long paths.
- Visual Studio Build Tools 2026 18.9.1 with the core x86/x64 C++ tools and
  ATL/MFC.
- Windows SDK directory 10.0.26100.0 with file version 10.0.26100.8249 and x64
  SDK Debugging Tools `dbghelp.dll` version 10.0.26100.7705.

Initial acquisition retains the 100 GiB floor. A prepared build may use
`--resume`: the tool verifies the pinned source commit and that all eight Ember
patches reverse cleanly in an isolated 20-file scratch tree, verifies all 18
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

1. Correct patch 0007's active-address and Copy Link visuals to the accepted
   measurements in
   `docs/superpowers/specs/2026-09-01-native-sidebar-visual-parity.md`, retaining
   its already-verified URL, clipboard, accessibility, and feedback behavior.
2. Keep real Chromium `Profile`, `Browser`, `TabStripModel`, navigation and
   renderer security as the backing systems; do not recreate an Electron shim.
3. Then compact and style the real native tab strip/toolbar toward the accepted
   32 px top shell using the measured top-chrome parity specification; add the
   12 px page radius and bounded material only in later reviewed slices.
4. Commit deterministic wide, medium and compact native capture/interaction
   probes and compare them with the checked-in Electron oracle.
5. Revisit signing and installer integration only when the friends-only build
   needs distribution hardening; do not block UI parity on those release-scale
   tasks.

Do not implement currently planned `ROADMAP.md` features as part of parity. Port
only behavior that exists at the locked Electron oracle commit.
