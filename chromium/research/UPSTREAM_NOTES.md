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

The validated host had Visual Studio 2022 Build Tools with C++, Windows SDK
10.0.26100.0, Git, Python 3.12.1, 7-Zip, long paths, and
`httplib2==0.22.0`. It lacked:

- the required 100 GiB free-space floor on the selected drive;
- Windows SDK Debugging Tools (`Debuggers\\x64\\dbghelp.dll`).

`chromium/tools/port.js doctor` intentionally blocks source acquisition/build
until every requirement passes. Do not weaken these checks to manufacture build
evidence. Use another short work root on a drive with adequate free space or fix
the host prerequisites, then rerun `prepare`, `verify-patches`, and `build`.

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
