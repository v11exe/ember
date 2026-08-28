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
Windows upstream patches and both Ember patches, and completed domain
substitution. The download cache was removed only after all hashes/unpacks had
completed, reclaiming 1.82 GiB without touching source or build output.

`build --resume` exists for this prepared state. It verifies the source HEAD,
proves the two applied Ember patch postimages by reverse-applying them in an
isolated nine-file scratch tree, accepts only known generated state including
`.gcs_entries`, and uses the 60 GiB prepared-build floor. If a failed GN attempt
left `out/Default/gn.exe` without `build.ninja`, resume deletes only that partial
bootstrap executable so upstream regenerates the Ninja graph. Incremental Ninja
objects are retained.

`chromium/tools/port.js doctor` intentionally blocks initial source acquisition
until every requirement passes. Do not weaken these checks to manufacture build
evidence. The lower resume floor applies only after the exact pinned and patched
checkout has been verified.

## Next source inspection targets

After producing the first binary, inspect and patch identity surfaces in this
order:

1. executable/package/installer naming and product resources;
2. About/version strings, icons, shortcuts, file associations, and protocol
   registration;
3. installer registry, toast activation, elevated services, upgrade/uninstall,
   and side-by-side behavior;
4. a native `Browser`/Views shell vertical slice using real `Profile`,
   `TabStripModel`, navigation, extension, sandbox, and Windows HWND plumbing;
5. deterministic native visual and interaction capture against the locked
   Electron reference manifest.

Do not implement a `ROADMAP.md` feature still marked planned while closing
native parity.
