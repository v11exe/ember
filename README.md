# Ember
A lightweight private personalised browser.

Electron-based, dark by default, with Chrome Web Store extension support and a
Google-backed omnibox.

## Run locally

```
npm install
npm start
```

Boot check (used as the pre-push gate, see `AGENTS.md` §3):

```
npm run smoke
```

## Layout

```
src/main/       main process — window, tabs, extensions, ember:// scheme
src/renderer/   browser chrome (tab strip, toolbar) + internal pages
src/shared/     IPC channel names and URL parsing, used by both sides
scripts/        smoke boot check
```

## Extensions

Ember installs extensions straight from the Chrome Web Store. Click the
extensions button in the toolbar, find one, and the store's install button
reads **Add to Ember**.

Under the hood: [`electron-chrome-web-store`](https://www.npmjs.com/package/electron-chrome-web-store)
handles download, verification and unpacking of the `.crx`;
[`electron-chrome-extensions`](https://www.npmjs.com/package/electron-chrome-extensions)
implements the `chrome.*` APIs extensions call at runtime. Installed extensions
persist in `userData/Extensions` and auto-update.

**Not every extension will work.** Electron is not Chrome — it implements a
subset of the extension platform. Content-script and browser-action extensions
(uBlock Origin, Dark Reader, Stylus) are the good case. Anything depending on
APIs Electron does not implement will install and then misbehave. This is a
platform limit, not a bug in Ember; see the upstream packages for current
coverage.

## Theme

One palette, taken from the logo, defined once in `src/renderer/theme.css` as
CSS custom properties and reused by both the chrome UI and internal pages.
Dark surfaces (`#000` → `#26262D`), ember gradient (`#E8410F` → `#FBE6A2`) for
accents, focus rings and active states.

## License

GPL-3.0 — inherited from `electron-chrome-extensions`, which is GPL-3.0 unless
you hold the author's commercial patron license.
