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
3. Overlay that stack onto the pinned configuration's Windows patch series.
4. Let the upstream build scripts acquire and build Chromium in the external
   work root.

`chromium/tools/port.js` refuses work roots inside, above, or equal to the Ember
repository. It also refuses unexpected edits in its managed configuration
checkout. Re-running `prepare` is deterministic and does not duplicate series
entries.

```text
Ember repository                         External work root
chromium/baseline.json                   configuration/       pinned small repo
chromium/patches/series        ->        configuration/patches/series
chromium/patches/ember/*       ->        configuration/patches/ember/*
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

Arguments after a second `--` are passed to the upstream Python script. For
example, `... chromium:build -- --work-root D:\src\ember-chromium -- --tarball`
uses its tarball acquisition path.

The run command uses a dedicated profile under the work root. The current patch
stack changes product, installer, policy, registry, protocol, toast/elevated
service class identities, and the AppContainer SID family. The executable is
still named `chrome.exe`, and Chromium's COM interface/type-library IDs remain
unchanged so checked-in MIDL output stays ABI-consistent; identity parity is
therefore partial, not complete.

To check the Ember patch stack against a pristine checkout of the exact
Chromium commit:

```powershell
npm run chromium:verify-patches -- --source D:\src\chromium-151.0.7922.173
```

## Patch workflow

- Make upstream edits against the exact commit in `baseline.json`.
- Store one reviewable concern per patch under `patches/ember/` and append it to
  `patches/series`.
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
