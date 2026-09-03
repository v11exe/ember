# Native Chromium upstream research notes

This file preserves architecture and source-level findings that are expensive
to rediscover. Revalidate them whenever `chromium/baseline.json` changes; the
baseline file, not this prose, remains the revision authority.

## Selected fork architecture

Ember uses a short external work root, a pinned Windows configuration checkout,
its pinned common submodule, and an Ember-owned ordered patch/resource overlay.
The full Chromium checkout, depot tools, downloaded toolchains, build output,
profiles, and packages stay outside this repository.

This follows the maintainable layering used by:

- Chromium's official Windows build flow:
  <https://chromium.googlesource.com/chromium/src/+/main/docs/windows_build_instructions.md>
- ungoogled-chromium Windows:
  <https://github.com/ungoogled-software/ungoogled-chromium-windows>
- ungoogled-chromium common configuration:
  <https://github.com/ungoogled-software/ungoogled-chromium>
- Helium's small platform repository plus pinned common source:
  <https://github.com/imputnet/helium-windows> and
  <https://github.com/imputnet/helium>

No upstream implementation or proprietary browser asset was copied into the
Electron application. Ember's source-controlled native changes are reviewable
patches applied to the exact Chromium revision.

## Windows identity findings

`chrome/install_static/chromium_install_modes.h` supplies install-mode product,
protocol, ProgID, class-ID, and AppContainer SID-family values. Distinct class
CLSIDs can be patched there as a first identity slice. Interface and type-library
IDs cannot safely be changed there alone.

The elevator interface ID is owned by:

- `chrome/elevation_service/elevation_service_idl.idl`
- `third_party/win_build_output/midl/chrome/elevation_service/{arm64,x64,x86}/`
  persisted `elevation_service_idl.h`, `_i.c`, `_p.c`, and binary `.tlb` outputs

The elevated tracing interface ID is owned by:

- `chrome/windows_services/elevated_tracing_service/tracing_service_idl.idl`
- `third_party/win_build_output/midl/chrome/windows_services/elevated_tracing_service/{arm64,x64,x86}/`
  persisted `tracing_service_idl.h`, `_i.c`, `_p.c`, and binary `.tlb` outputs

The corresponding `midl(...)` build rules compare generated files with those
persisted outputs. Hand-editing install metadata would misalign client/service
QueryInterface behavior or fail the build. Binary type libraries must be
regenerated with Windows MIDL. If Ember later takes ownership of interface IDs,
review the IDL library UUIDs at the same time and test registration, activation,
upgrade/uninstall, and Chromium/Ember side-by-side behavior on Windows.

The first patch stack therefore keeps Chromium's interface and type-library IDs,
while assigning Ember-specific toast, elevator, and tracing class CLSIDs. The
AppContainer SID family retains Chromium's per-process suffixing and changes the
stable distribution component so the complete prefix differs from Chromium's.
This is source-level isolation evidence only until a built process tree and
Windows token/AppContainer audit pass.

## Host and build findings

The exact Chromium 151 source requires Visual Studio 2026 (major version 18),
not Visual Studio 2022. Its pinned Windows checks require SDK directory
`10.0.26100.0`, SDK file version at least `10.0.26100.7705`, and Debugging Tools
`dbghelp.dll` version at least `10.0.26100.3323`. Ember records and validates
those exact constraints instead of accepting a directory name alone.

The validated host now has Visual Studio Build Tools 2026 18.9.1 with the core
VCTools workload, VC 14.51.36231 x86/x64 tools, ATL/MFC, Windows SDK files at
10.0.26100.8249, x64 Debugging Tools at 10.0.26100.7705, Git 2.42, Python
3.12.1, 7-Zip, long paths, and `httplib2==0.22.0`. The debugger payload is about
249 MiB across x86, x64, and arm64; it is a build prerequisite, not part of the
shipped browser.

Two Windows-specific bootstrap details were discovered during the first full
acquisition:

- depot_tools invokes `python3`, which can resolve to the nonfunctional Windows
  Store alias even when `python.exe` is valid. The port tool writes an external
  `python3.bat` shim for the doctor-verified interpreter and prepends only that
  child directory to `PATH`.
- Chromium finds VS 2026 through `vs2026_install`. Build Tools installed under
  `Program Files (x86)`, outside Chromium's default probe, so the port derives
  that child-process variable from its verified installation. It does not set a
  permanent machine variable.

The full acquisition produced 504,294 source objects, synced 155 gclient
projects, downloaded the pinned PGO/LLVM/Rust inputs, applied 109 common plus 23
Windows upstream patches and the first two Ember patches, and completed domain
substitution. The download cache was removed only after all hashes/unpacks had
completed, reclaiming 1.82 GiB without touching source or build output.

`build --resume` exists for this prepared state. It verifies the source HEAD,
proves all eight applied Ember patch postimages by reverse-applying them in an
isolated 20-file scratch tree, verifies all 18 resource destinations, accepts
only known generated state including `.gcs_entries`, and uses the 60 GiB
prepared-build floor. If a failed GN attempt
left `out/Default/gn.exe` without `build.ninja`, resume deletes only that partial
bootstrap executable so upstream regenerates the Ninja graph. Incremental Ninja
objects are retained.

`chromium/tools/port.js doctor` intentionally blocks initial source acquisition
until every requirement passes. Do not weaken these checks to manufacture build
evidence. The lower resume floor applies only after the exact pinned and patched
checkout has been verified.

## First native build and runtime findings

The pinned official x64 build completed on 2026-08-29 without a failed Ninja
action. The first 3.5-hour CI window completed 36,636 of 57,877 actions and the
verified resume completed the remaining 21,241 in about three hours. The most
expensive final step was the optimized `chrome.dll` link, which used about
10.7 GiB working memory; post-link resource-allowlist and locale generation then
produced `chrome.exe` and the mini installer. The upstream build script also
created its installer and portable ZIP automatically.

The resulting `chrome.exe` and `chrome.dll` have Windows product name `Ember`,
version 151.0.7922.173. `mini_installer.exe` reports `Ember Installer`. The
portable ZIP is 197,120,693 bytes (187.99 MiB), the installer 126,752,768 bytes
(120.88 MiB), and the completed `out/Default` tree is 15.04 GiB including
incremental objects and PDBs. Exact hashes are kept in `CHROMIUM_PORT_STATUS.md`.

A supervised launch with a fresh external profile and DevTools port proved:

- a real responding top-level HWND and a seven-process browser/GPU/renderer/
  utility tree;
- default sandboxed process roles with no `--no-sandbox` flag;
- the exact pinned official x64 revision and isolated executable/profile paths
  on `chrome://version`;
- successful HTTPS navigation and rendering of `https://example.com`; and
- graceful `Browser.close`, after which every process, the profile singleton
  lock, and the debugging listener disappeared.

The third Ember patch owns visible product strings in
`chrome/app/chromium_strings.grd`, Settings-specific strings in
`chrome/app/settings_chromium_strings.grdp`, and dedicated official/developer
Ember build labels in `components/version_ui_strings.grdp` selected by
`chrome/browser/ui/webui/version/version_ui.cc`. Dedicated version IDs avoid
depending on the ungoogled patch's modification of Chromium's original build
label, so the Ember patch applies both to pristine pinned Chromium and after the
upstream patch stack.

The incremental identity build initially encountered synchronized Clang
crashes while Windows logged `Virtual Memory Minimum Too Low`; the exact failed
translation units succeeded when the same Ninja graph resumed at `--jobs 6`.
The remaining 951 actions completed, including GRIT resources, `chrome.dll`,
`chrome.exe`, locale packs, and both packages. The optimized DLL link used about
9 GiB working memory in this pass. Treat parallelism as a host-memory budget:
the prepared checkout and object graph were healthy, and no reacquisition or
clean rebuild was required.

The rebuilt runtime now titles its HWNDs `New Tab - Ember` and `About Version -
Ember`. `chrome://version` identifies Ember, The Ember Authors, and the exact
official ungoogled-Chromium-based build; `chrome://settings/help` says `About
Ember`. Packaging normalization emits only deterministic Ember-named installer
and portable artifacts and refuses to overwrite a differing existing package.
The stable `Chrome/...` user-agent token is deliberately retained for website
compatibility. Executable naming, signing, final rebuilt icon verification, and
installer integration remain open. The installer was not executed on the
development machine, so registry, protocol, COM activation, update, upgrade,
uninstall, and coexistence behavior remain unverified.

## Branding-overlay and automation findings

The exact Helium Windows research commit `332bb0b...` and its pinned common
commit `971d367...` were inspected in a disposable external clone. Its
maintainable pattern is a small source-controlled resource list plus generated
and copied resource stages invoked by the platform build script
(`resources/platform_resources.txt`, common `resources/helium_resources.txt`,
`utils/generate_resources.py`, and `replace_resources.py`). Ember reimplements
that architecture with its own manifest, validation, generator and canonical
assets; no Helium visual asset or source implementation was copied.

Chromium's DevTools browser product is not an isolated display string.
`content/browser/devtools/devtools_http_handler.cc` obtains it from
`ContentBrowserClient::GetProduct()`, and Chrome's implementation returns the
same stable product token used by compatible browser plumbing. The pinned
ChromeDriver parser in `chrome/test/chromedriver/chrome/browser_info.cc` accepts
only `Chrome/` or `HeadlessChrome/`, and that product also participates in GPU
shader-cache namespacing. Ember therefore keeps CDP `Chrome/151.0.7922.173` and
the stable Chrome UA intentionally while branding user-visible surfaces as
Ember.

The first 15-resource incremental build completed 476 actions and rendered the
gold Ember mark on the live About page. Direct `PrivateExtractIcons` extraction
then proved `chrome.exe` still embedded Chromium's blue icon. The source ICO was
byte-for-byte Ember, but `out/Default/obj/chrome/chrome_initial/chrome_exe.res`
and the corresponding DLL resource still predated the overlay: Windows RC
includes are not dependency-tracked by this Ninja graph. The Windows build hook
now hashes the full prepared overlay and invalidates exactly
`chrome_exe.res` and `chrome_dll.res` only when those bytes change. It also
copies only differing resources so ordinary resumes do not create false mtime
rebuilds.

The live Settings capture exposed two more upstream glyph routes:
`ui/webui/resources/images/chrome_logo_dark.svg` used by the shared toolbar and
`cr:chrome-product` defined in `ui/webui/resources/cr_elements/icons.html.ts`.
The former is now an Ember-owned generated SVG wrapper; the latter is replaced
by a small monochrome Ember meteor path in patch five. All five patches reverse
cleanly from the applied 15-file source set and all 18 resource destinations
verify. After 67.1 GiB became available, the final six-job build completed 952
executed actions. It rebuilt both explicitly invalidated RC outputs, the DLL,
localized resource packs, executable, mini installer and managed packages.

Direct `PrivateExtractIcons` extraction from the final `chrome.exe` returned
the 256 px gold Ember meteor from PE resource ID 4. The live browser HWND's
`GCLP_HICON` returned the 32 px gold meteor. A CDP screenshot and accessibility
tree proved the Settings top-toolbar logo, About card art, About-menu glyph,
title, official Ember build label and Ember copyright together. Graceful
`Browser.close` left zero matching processes and no singleton artifacts. This
closes the practical identity slice; deeper installer/upgrade/coexistence work
is deferred for the friends-only distribution so shell and feature parity can
take priority.

## First native Views shell result

`BrowserView` owns the correct integration point. Patch six adds the rail as a
normal child only for `Browser::TYPE_NORMAL`, passes it through
`BrowserViewLayoutViews`, and reserves its width at the start of
`BrowserViewTabbedLayoutImpl::CalculateProposedLayout`. That shifts Chromium's
real horizontal tab strip, top container, side-panel calculations, contents,
modal-dialog anchor and minimum size together; no WebContents overlay or
Electron compatibility layer is involved. The page-only 8 px inset is applied
after top/infobar/side-panel layout and before contents layout, while fullscreen
hides the rail and skips both reservations.

The affected objects and full six-patch build pass. A 1570×796 sandboxed live
probe measured `#1A100A` x=8..175 for the 168 px rail, x=176..183 for the 8 px
gap, and page start x=184. Seven normal Chromium processes ran without
`--no-sandbox` and shut down through CDP. Keep this layout seam for subsequent
rail controls and top-shell styling instead of introducing a parallel window or
renderer-hosted chrome.

## First native sidebar feature result

`BrowserView` already owns the required `TabStripModelObserver` and active
`WebContentsObserver` lifecycles. Patch seven reuses those observers rather than
creating a second navigation controller: active-tab changes, toolbar updates
and committed primary navigations all refresh one address label from
`GetActiveWebContents()->GetVisibleURL()`. The adjacent Views button writes the
same exact URL to `ClipboardBuffer::kCopyPaste`, provides bounded `Copied`
feedback, and remains keyboard-focusable and visible to Windows accessibility.

The focused object and full seven-patch native build pass. Windows UI Automation
invoked the real button without synthetic input, verified the exact clipboard
value and 1.2-second reset, then proved a CDP-created second tab updates the rail
and reactivating the first restores its URL. Visual inspection caught the
localized Windows `&Copy` mnemonic leaking into the custom button; the final
source uses a clean visible `Copy` label. Eight browser/GPU/renderer/utility
processes retained sandbox flags and shut down normally. Continue with
profile-backed Favorite tiles on this same rail before changing the real tab
strip and toolbar.

## Native Favorites result (patch eight, built and runtime-verified)

Chromium already provides everything Ember's Favorite rail needs, so the patch
adds no storage layer of its own:

- `BookmarkModelFactory::GetForBrowserContext()` gives each profile's real
  `BookmarkModel`, which persists to the profile's `Bookmarks` file and is
  synced/backed up by Chromium's own machinery. No JSON store is ported.
- `BaseBookmarkModelObserver` collapses the whole observer surface into one
  `BookmarkModelChanged()`, with `BookmarkNodeFaviconChanged()` overridden
  separately so a favicon arriving repaints without rebuilding identical state.
- Node metadata (`SetNodeMetaInfo`/`GetMetaInfo`) is the correct way to mark
  Ember's folder: it survives rename and move, unlike matching on the title.
  A second marker on the other node records that seeding already happened, so
  a user who deletes every default does not get them back on the next launch.
- `BookmarkModel::GetFavicon()` returns the model's own cached favicon and
  starts a load when it is absent, which is why the favicon observer matters.
- Tab reuse goes through `GlobalBrowserCollection` in activation order and
  `TabStripModel::ActivateTabAt`, so Chromium keeps owning tab ownership,
  activation and focus. `chrome::AddTabAt` is used only when nothing matches,
  and open-state refresh is broadcast to every same-profile normal
  `BrowserView`.

Model mutation during a model notification is the hazard here: seeding runs
inside a posted task guarded by an `ember_updating_favorites_` reentrancy flag
and a pending-refresh flag, because `AddFolder`/`AddURL`/`SetNodeMetaInfo` each
re-enter `BookmarkModelChanged()`.

The final patch was regenerated from exact patch-0007 pre/postimages after the
hunk checker found four stale hand-edited counts. Its measured Views surface is
70×43 per icon-only tile with 10 px gaps, a 7 px radius, exact oracle state
alphas, and a shared 19×19 cached/fallback favicon path. The final 466-action
resume compiled `browser_view.obj`, linked the UI library/DLL/executable, and
produced both packages.

A fresh 900×556 profile then exposed the three accessible controls at
`(136,172)`, `(216,172)`, and `(136,225)`. Re-invoking Google preserved its CDP
target identity and total target count. A second native window painted Google's
open state and activated the original Google HWND without duplicating the tab.
Clean close/relaunch retained exactly one metadata folder and the same three
defaults with an unchanged Bookmarks SHA-256. Both launches ended with zero
matching profile processes. This closes the fixed 2×2 Favorites baseline; native
add/remove/reorder, configurable capacity, tab drop, empty slots, and the
satisfaction animation remain future parity work.

## Next source inspection targets

With the build and practical visible-identity slice proven, continue in this
order:

1. correct patch seven's address/Copy visuals to the measured native-sidebar
   specification while retaining its verified URL, clipboard, accessibility,
   and feedback behavior;
2. compact and style Chromium's real horizontal tab strip/top container
   toward the 32 px oracle without replacing its focus, extension, sandbox or
   Windows caption behavior;
3. deterministic native visual and interaction capture against the locked
   Electron reference manifest.
4. remaining tab interaction parity in small
   functioning slices;
5. signing and deeper installer integration only when distribution hardening is
   needed, without blocking the visible UI work.

Do not implement a `ROADMAP.md` feature still marked planned while closing
native parity.
