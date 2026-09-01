# Ember native Chromium port

This directory is the source-controlled overlay for Ember's native Chromium
fork. It intentionally does **not** contain a Chromium checkout or build output.
The existing Electron application remains in this repository as the behavioral
and visual oracle until the native port reaches audited parity.

Current progress and the subsystem-by-subsystem parity matrix live in
[`CHROMIUM_PORT_STATUS.md`](../CHROMIUM_PORT_STATUS.md). The immutable upstream
revisions live in [`baseline.json`](baseline.json).

## Architecture

The port follows the maintainable pattern used by ungoogled-chromium and
Helium:

1. Keep a small, pinned Windows build-configuration checkout outside Ember.
2. Keep Ember-owned Chromium changes as an ordered patch stack in this repo.
3. Keep Ember-owned raster/SVG/ICO branding in a path-safe manifest overlay.
4. Overlay both onto the pinned configuration's Windows build flow.
5. Let the upstream build scripts acquire and build Chromium in the external
   work root.

`chromium/tools/port.js` refuses work roots inside, above, or equal to the Ember
repository. It also refuses unexpected edits in its managed configuration
checkout. Re-running `prepare` is deterministic, does not duplicate series
entries, and upgrades an older generated overlay only when its complete stamped
bytes still match.

```text
Ember repository                         External work root
chromium/baseline.json                   configuration/       pinned small repo
chromium/patches/series        ->        configuration/patches/series
chromium/patches/ember/*       ->        configuration/patches/ember/*
chromium/resources/*           ->        configuration/ember-resources/*
                                         configuration/build/src/ Chromium source
                                         profile/             isolated test profile
```

## Commands

Run the doctor first. The default external root is
`C:\src\ember-chromium`; `EMBER_CHROMIUM_ROOT` or `--work-root` can select a
different short path on a drive with enough space.

```powershell
npm run chromium:baseline
npm run chromium:verify-upstreams
npm run chromium:doctor -- --work-root D:\src\ember-chromium
npm run chromium:prepare -- --work-root D:\src\ember-chromium
```

`prepare` clones only the pinned Windows configuration and its common build
submodule. It does not download the full Chromium source. `build` performs that
large acquisition after the doctor passes. Before acquisition it verifies that
all three remote tags still resolve to the recorded commits; after compilation
it rejects output whose source `HEAD` is not the pinned Chromium commit:

```powershell
npm run chromium:build -- --work-root D:\src\ember-chromium --jobs 18
npm run chromium:package -- --work-root D:\src\ember-chromium
npm run chromium:run -- --work-root D:\src\ember-chromium --url https://example.com
```

If acquisition and patching completed but GN or Ninja stopped, resume the same
verified checkout instead of repeating the download and patch stages:

```powershell
npm run chromium:build -- --work-root D:\src\ember-chromium --jobs 18 --resume
```

Resume mode verifies the pinned source commit, proves the already-applied Ember
patch postimages in an isolated scratch tree, applies the lower prepared-build
free-space floor from `baseline.json`, and repairs the narrow case where GN
exists but `build.ninja` was never generated. It then enters the upstream CI
path, which retains the existing source and incremental object files.

On Windows the tool also creates an external `python3.bat` launcher for the
interpreter that passed the doctor. This prevents depot_tools from accidentally
resolving the disabled Microsoft Store `python3.exe` alias. The verified Visual
Studio install is passed to Chromium through its product-line-specific
environment variable; no machine-global environment variables are changed.

Arguments after a second `--` are passed to the upstream Python script. For
example, `... chromium:build -- --work-root D:\src\ember-chromium -- --tarball`
uses its tarball acquisition path.

The run command uses a dedicated profile under the work root. The current patch
stack changes product, installer, policy, registry, protocol, toast/elevated
service class identities, the AppContainer SID family, and visible window,
About, accessibility, relaunch, default-browser, uninstall, and startup-error
text. Packaging normalizes completed upstream artifacts to deterministic Ember
filenames, records their hashes in a generated ownership manifest, and replaces
only an unchanged prior managed artifact. The resource overlay supplies the
Windows ICO, scaled product/About rasters and shared WebUI logos; a content-hash
stamp invalidates the two RC objects whose ICO dependency Ninja does not track.
The executable is
still named `chrome.exe`, and Chromium's COM interface/type-library IDs remain
unchanged so checked-in MIDL output stays ABI-consistent; identity parity is
therefore partial, not complete.

### First verified Windows result

The pinned Chromium 151 official x64 build completed on 2026-08-29 across two
incremental Ninja windows: 36,636 actions before the upstream 3.5-hour CI timeout
and 21,241 actions after `--resume`, with no failed action. Upstream packaging
then produced a 120.88 MiB installer and 187.99 MiB portable ZIP. The built
`chrome.exe`/`chrome.dll` report product name `Ember`, and an isolated-profile
runtime probe verified the real browser/GPU/renderer/utility process tree,
default sandbox flags, HTTPS navigation, and clean shutdown.

The third patch then completed a 2,910-action incremental rebuild and a fresh
runtime probe. Window titles now end in Ember, `chrome://version` identifies the
Ember product and authors, Settings says `About Ember`, and packaging emits the
120.85 MiB installer and 187.99 MiB portable ZIP under deterministic
`ember_151.0.7922.173-1.1_*_x64` names. Chromium's stable Chrome user-agent
token remains intentional for web compatibility.

The first native branding-resource build then completed 476 incremental actions
and caught Chromium's missing RC include dependency: the old executable icon
remained embedded even though the source ICO had changed. The final five-patch,
18-resource rebuild subsequently passed all 12 host checks and completed 952
executed actions, including both invalidated RC outputs, the optimized DLL and
executable links, localized resource packs, mini installer, and packages.

Direct PE extraction now returns Ember's gold 256 px meteor, the live HWND owns
the gold 32 px meteor, and `chrome://settings/help` renders Ember art in its top
toolbar, About card and About-menu glyph. Accessibility strings, window title,
official build text and shutdown were also verified. CDP deliberately retains
`Chrome/...` because the pinned ChromeDriver parser and shader-cache namespace
depend on that compatibility token.

This closes the practical build/runtime identity baseline, not UI parity. For
the current small friends-only distribution, executable renaming, signatures
and deep installer/upgrade/coexistence testing are deferred so work can move to
the native Ember C++/Views shell and existing features. Exact file hashes,
runtime evidence, disk measurements and the next UI slice are recorded in
`../CHROMIUM_PORT_STATUS.md`.

Patch six starts UI parity in Chromium itself. A normal `BrowserView` now owns
a 168 px Ember rail and lays out the real tab strip, toolbar, dialogs, side
panels and web contents beside it; the page receives the oracle's 8 px inset,
and fullscreen removes the shell reservation. The six-patch incremental build
completed 584 actions and a deterministic live-page screenshot measured both
dimensions exactly while the ordinary Chromium sandbox/process model remained
enabled.

Patch seven makes that rail useful. Its native address row follows the active
Chromium `WebContents` across committed navigation and tab changes, and its
focusable Copy button writes the exact visible URL to the ordinary Windows
clipboard with accessible `Copied` feedback and a 1.2-second reset. UI
Automation proved the label, clipboard, feedback timer and two-way tab switch;
the final eight-process run retained the normal sandbox and shut down cleanly.
Patch eight adds the first Favorite grid. `BrowserView` observes the profile's
own `BookmarkModel`, finds or creates a metadata-marked `Ember Favorites` folder
under Other Bookmarks, seeds Google / YouTube / Google Calendar exactly once,
and paints its first four HTTP(S) children as a 2x2 grid of focusable buttons.
Activation reuses a matching open tab through `TabStripModel::ActivateTabAt`
using Ember's broad-root and exact-path rules, and opens a new tab only when
nothing matches. Favorites are shortcuts, never a second tab strip.

**Patch eight has never been built or run.** It passes the focused contract
tests and two idempotent prepares, and that is all the evidence that exists for
it. As of 2026-09-01 the external checkout is gone from the development host and
`doctor` reports 8/12, so the next native step is restoring the toolchain and
performing a full fresh acquisition and build. See the build-host regression
section of `../CHROMIUM_PORT_STATUS.md`.

The next UI slice after that is compacting and styling the real top chrome
toward Ember's 32 px shell. Its measured contract — strip anatomy, tab states,
the dynamic width formula, wheel physics and the shell material — is extracted
from the oracle in
`../docs/superpowers/specs/2026-09-01-native-top-chrome-parity.md`.

To check the Ember patch stack against a pristine checkout of the exact
Chromium commit:

```powershell
npm run chromium:verify-patches -- --source D:\src\chromium-151.0.7922.173
```

## Patch workflow

- Make upstream edits against the exact commit in `baseline.json`.
- Store one reviewable concern per patch under `patches/ember/` and append it to
  `patches/series`.
- Regenerate branding with `tools/generate-brand-resources.ps1`; update the
  explicit resource manifest rather than copying files ad hoc into Chromium.
- Run the focused Node tests, `chromium:verify-patches`, then `prepare` twice to
  prove both applicability and idempotence.
- Never commit `configuration/`, `build/src`, `out/`, downloaded toolchains, or
  profiles. If a required change cannot be expressed as a patch or small Ember
  resource overlay, document the exception before adding it.
- Do not edit the generated external overlay as the source of truth. Change the
  files in this directory and rerun `prepare`.
- Do not change a COM interface or type-library ID only in install metadata.
  Change its IDL and regenerate every checked-in x86, x64, and arm64 MIDL output
  in the same patch, then compile and test registration, activation, and upgrade
  behavior on Windows.

## Electron parity references

`reference/electron/9ae3217/` contains the deterministic Windows captures for
the exact Electron oracle commit. Regenerate a candidate set without fetching
third-party imagery with:

```powershell
$env:EMBER_CAPTURE_OFFLINE = '1'
node_modules\.bin\electron.cmd scripts\capture-ui.js <output-directory>
```

The checked-in manifest records shell geometry and the promoted scenarios. A
native screenshot is not accepted on visual similarity alone: its matching
interaction, focus, lifecycle, accessibility, and Windows window-management
behavior must also pass.

## Upstream basis and licensing

The build configuration is pinned to
[ungoogled-chromium-windows](https://github.com/ungoogled-software/ungoogled-chromium-windows),
which in turn pins
[ungoogled-chromium](https://github.com/ungoogled-software/ungoogled-chromium).
The external-checkout, common/platform patch layering, resource overlay, and
validation design was also informed by
[Helium](https://github.com/imputnet/helium) and
[Helium for Windows](https://github.com/imputnet/helium-windows). The exact
research commits are recorded in `baseline.json`.

Ember does not vendor or relicense Chromium or those projects here. Preserve
all upstream licenses in acquired source and packaged distributions. Ember-owned
port tooling and patches remain under this repository's GPL-3.0 license.
