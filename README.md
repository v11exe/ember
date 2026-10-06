# Ember

Ember is a Windows browser built on native Chromium. It combines Chromium's profiles, renderer sandbox, tabs, navigation, downloads and extensions with Ember's compact shell, Favorite sidebar, EmberGlass surfaces and browsing shortcuts.

The native browser is maintained as a pinned Chromium patch stack plus a small resource overlay. Chromium source and build output stay outside this repository. The Electron implementation remains on `main` as a historical behavior oracle; `chromium-port` is the native project.

## Current features

- Compact horizontal tabs, native window controls, collapsible sidebar, Favorite sites and address field.
- Tab sleep/wake, recent uploads, New Tab search, Quick Searches, Copy Link, Ctrl+Tab switcher, and native split-tab drag targets.
- EmberGlass menus, dialogs and overlays with the official Ember branding.
- Optional Unsplash photo backgrounds for New Tab. Turn them on in Settings → Appearance, enter your own Unsplash Access Key and choose All photos or a specific Unsplash topic. No Secret Key is needed. Photos stay centered and crop to cover the page as its size changes; the search bar blurs the photo behind it.
- Selection conversions for currency, temperature, distance, weight, volume and time. Currency rates are fetched only for a recognized foreign-currency selection.

The selection popup, sidebar Extensions placement, New Tab photo option and corrected shell controls have passed focused source checks. A newly linked full browser still needs the runtime checks in [CHROMIUM_PORT_STATUS.md](CHROMIUM_PORT_STATUS.md).

Run 5 adds the five-button utility footer, real media controls, per-tab 0–200% audio gain and a reusable ChatGPT capture side page in source. Workspaces currently says “Work in progress”. Full-build runtime acceptance is pending; see [the native status record](CHROMIUM_PORT_STATUS.md).

## Build on Windows

Requirements: Windows x64, Visual Studio 2026 C++ tools, Windows SDK 10.0.26100, Python 3, Git, 7-Zip, at least 16 GiB RAM and sufficient free space on the work-root drive. The doctor reports exact missing requirements.
The standalone doctor uses the 100 GiB fresh-acquisition floor; a verified
`build --resume` checks the 60 GiB prepared-build floor.

```powershell
npm run chromium:doctor -- --work-root C:\src\ember-chromium
npm run chromium:prepare -- --work-root C:\src\ember-chromium
npm run chromium:build -- --work-root C:\src\ember-chromium --jobs 6 --resume
npm run chromium:package -- --work-root C:\src\ember-chromium
npm run chromium:run -- --work-root C:\src\ember-chromium
npm test
```

`--resume` keeps the prepared Chromium checkout and incremental build products. Omit it only when preparing a new work root. The package command places the managed Ember installer and portable ZIP in the external work root. `npm run chromium:check-patches` validates patch hunk counts; `npm run chromium:verify-patches` checks the stack against a pristine pinned source checkout.

See [chromium/README.md](chromium/README.md) for the patch/resource layout and [AGENTS.md](AGENTS.md) for development rules. [ROADMAP.md](ROADMAP.md) holds numbered feature specifications. Third-party material is credited in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
