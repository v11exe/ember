# Native Chromium integration

Ember does not vendor Chromium. [`baseline.json`](baseline.json) pins the Chromium revision, the Windows build configuration and its submodule. The external work root defaults to `C:\src\ember-chromium`; its source is `configuration\build\src` and its incremental output is `configuration\build\src\out\Default`.

## Source layout

| Path | Purpose |
| --- | --- |
| `patches/series` | Ordered Ember patches applied to pinned Chromium. |
| `patches/ember/` | Ember-owned C++/Views, WebUI and build integration. |
| `resources/manifest.json` | Path-safe resource overlay destinations. |
| `resources/branding/`, `resources/glass/`, `resources/newtab/`, `resources/typography/`, `resources/snap/` | Product assets and WebUI sources. |
| `resources/conversions.js` | Pure local detection and conversion rules, embedded as a native resource. |
| `tools/port.js` | Doctor, preparation, validation, build, run and package workflow. |
| `tools/check-patch-hunks.js` | Static patch integrity check. |
| `tools/capture-native.js` | CDP-based browser capture for visual QA. |

`prepare` generates a managed configuration overlay. It refuses unexpected changes and keeps the full Chromium tree outside Git. `build --resume` validates the pinned source, the applied patch postimages and the resource destinations before entering the upstream incremental build. `package` normalizes and hashes upstream installer/ZIP artifacts without overwriting foreign files.
The standalone doctor requires 100 GiB for fresh acquisition. A verified
prepared `build --resume` uses the 60 GiB floor.

## Development workflow

1. Read [AGENTS.md](../AGENTS.md), [ROADMAP.md](../ROADMAP.md) when implementing a numbered feature, and [CHROMIUM_PORT_STATUS.md](../CHROMIUM_PORT_STATUS.md) for current gates.
2. Change the prepared Chromium checkout for focused compilation, then capture the exact change as the next ordered patch. Put replaceable WebUI and product assets in `resources/manifest.json`.
3. Validate patch postimages and overlay resources, run `npm test`, and compile affected native objects or WebUI targets. Do not infer runtime behavior from compilation.
4. Run `npm run chromium:prepare -- --work-root C:\src\ember-chromium` to update the generated external patch series. The final full build and package are user-run for this parity pass.
5. Update the status document with evidence and remaining runtime checks.

Do not edit generated configuration files as source, alter `baseline.json` casually, reset the external build graph, or vendor Chromium. The Electron branch `main` is available for historical behavior and visual comparison.

## Commands

```powershell
npm run chromium:doctor -- --work-root C:\src\ember-chromium
npm run chromium:prepare -- --work-root C:\src\ember-chromium
npm run chromium:check-patches
npm test
npm run chromium:build -- --work-root C:\src\ember-chromium --jobs 6 --resume
npm run chromium:package -- --work-root C:\src\ember-chromium
npm run chromium:run -- --work-root C:\src\ember-chromium
```

The full build can be lengthy. Use `--resume` after an interrupted prepared build. Product licensing and borrowed material remain documented in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
