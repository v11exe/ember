# AGENTS.md — Ember

Shared instruction set for every coding agent on this repo. Two objectives:
**(a)** two agents editing the same repo must not clobber each other,
**(b)** this file is the project's orientation cache — read it instead of
re-exploring the repo, so each session spends tokens on work, not discovery.

This file is loaded into context every session. Keep it **under ~250 lines**.
Density over prose. If a section stops being true, edit it — a stale line here
costs more than a missing one.

---

## 0. Orientation cache — read this, don't re-explore

Everything below is current as of the last Work Log entry. Trust it. Do not
`ls -R`, do not grep for structure, do not open files just to find out what they
are. Open a file only when you are about to read or change its logic.

**Repo:** `v11exe/ember` · branch `main` · Windows dev machines.

**Stack:** Electron `^43.4.1`, CommonJS JS (TypeScript still planned). No build
step. `npm start` runs it; gates are `npm test` and `npm run smoke`.

**File map** (complete):

```
src/main/index.js        app bootstrap, BaseWindow, IPC handlers, lifecycle
src/main/tabs.js         TabManager — create/close/select/layout, CHROME_HEIGHT=84
src/main/extensions.js   Chrome Web Store install + chrome.* APIs + "Add to Ember"
src/main/{panel,floating-panel}.js bounded dropdown/overlay WebContentsViews
src/main/bookmarks.js    bookmark HTML parser + atomic JSON userData store
src/main/history.js      visit log + recently-closed, atomic JSON, capped at 5000
src/main/downloads.js    live DownloadItem mirror + finished list, atomic JSON
src/main/settings.js     prefs (sessionRestore, window bounds, hibernation)
src/main/hibernation.js  idle-tab discard policy (pure) + sweep timer + probes
src/main/tab-thumbnails.js  cached page screenshots, keyed by tab id
src/main/selection-panel.js  conversion popup beside a selected value
src/main/rates.js        ECB exchange rates, fetched lazily, cached for a day
src/main/archive.js      Wayback availability lookup, cached, click-only
src/main/session.js      saved tab set for restore-on-launch, sync writes
src/main/session-prompt.js  close-time "reopen tabs?" dialog on FloatingPanel
src/main/shortcuts.js    pure key -> command table (Chrome parity) + zoom ladder
src/main/popup-positioner.js  viewport guard for real extension popup windows
src/main/{upload-panel,context-menu-panel}.js real file/menu controllers
src/main/{recent-uploads,upload-files,context-menu-model}.js overlay data/actions
src/main/protocol.js     ember:// scheme, serves internal pages + shared assets
src/main/page-preload.js sandboxed nav bridge + real file-input interception
src/renderer/preload.js  chrome UI bridge (contextBridge "ember"), browser-action
src/renderer/chrome.*    tab strip, toolbar, extensions panel (html/css/js)
src/renderer/theme.css   palette + type stack + motion tokens, all defined once
src/renderer/brand.*     exact supplied PNG icon/full-logo mounts
src/renderer/panel-preload.js  panel bridge + injectBrowserAction()
src/renderer/pages/      newtab, extensions, upload, context-menu, history, downloads,
                         session-prompt, settings, conversion, unreachable
src/renderer/pages/liquid-glass-ui.{js,css}  shared page material + selector lens
src/renderer/pages/page-glass.js  full-page refraction; reuses upload-optics maps
src/renderer/pages/backdrop-contrast.js  flags light captures so overlays flip palette
src/shared/              IPC/URL/bangs/conversions/archive/file/geometry contracts
scripts/smoke.js         boot check
scripts/capture-ui.js    offscreen wide/medium/compact visual QA captures
test/                    node:test unit/contracts + two real popup fixtures
```
**Milestones** — 1 shell ✅ · 2 tab manager ✅ · 3 chrome UI + IPC ✅ ·
8 extensions ✅ (built early, out of order) · 4 sessions and partitions ·
5 adblock + per-site Shields · 6 history/bookmarks/downloads ✅ · 7 GX layer
(theming + glass menus/uploads ✅, tab discarding ✅; network limiter, tab
islands, sidebar outstanding).

**Gotchas** (cost real debugging time, don't rediscover):
- A hibernated tab keeps its record but has `view === null` and
  `webContents === null`. Guard both; `tabs.select()` wakes first, so the
  active tab is always live.
- `webContents.destroy()` fires `'destroyed'` a turn late, so a stale handler
  would forget a tab that has since been woken. `#wire` compares
  `tab.webContents === wc` rather than reading a flag.
- `capturePage()` on a hidden `WebContentsView` has no frame and comes back
  empty, so `TabManager` screenshots the *outgoing* tab in `select()`.
  `ThumbnailCache` keeps the previous entry when a capture fails.
- `.setting` sets `display`, outranking the user agent's `[hidden]` rule; a
  settings row that can hide needs `.setting[hidden] { display: none }`.
- `injectBrowserAction()` must be *called* in a preload; requiring the module
  does nothing. It also exposes `window.browserAction.activate()`, which is how
  the panel opens a popup from its own row icons.
- Action icons need `ElectronChromeExtensions.handleCRXProtocol(session)`.
- Popup position: the package computes `x = anchor.x + anchor.width - popupWidth`,
  so popups open **leftward** by default. Putting `right` in `alignment` flips
  that and shoves them off-screen. Anchor rects are **window**-relative, so a
  panel in its own view must add its own offset (see `PANEL_ORIGIN`).
- The package does not clamp popup windows. `PopupPositioner` constrains real
  popups against the parent window after preferred-size changes.
- Dropdowns get their own `WebContentsView` (`src/main/panel.js`). Growing the
  chrome view to full height instead paints black over the whole page —
  transparency does not work there.
- Upload/context overlays share `FloatingPanel`; never replace page bounds.
- Chrome-UI key handlers only fire when the chrome view has focus. Shortcuts that
  must work while a page is focused (Ctrl+H) go through `before-input-event` in
  `index.js`, not `chrome.js`.
- CSS `backdrop-filter` needs colour behind it. Full-page glass (history,
  downloads) paints its own ambient blobs; overlay glass samples a real capture.
  `page-glass.js` builds one `feDisplacementMap` filter per distinct element size
  from the same canonical switch map, so refraction is real, not a blur.
- Upload outer optics use an aspect-matched map with a 24px active perimeter;
  recapture its 40px bleed whenever the panel relayouts, and have its hover lens
  sample the independently aligned raw capture rather than the processed shell.
- Context-menu outer optics generate an aspect-matched map from the one canonical
  switch map; the selector owns a separately aligned raw-capture sample.
- `capturePage()` returns an empty image once a window starts closing, so any
  close-time overlay needs its own light to refract, not just a capture.
- Motion tokens live in `theme.css` (`--ease`, `--dur-1..3`); use them rather
  than literal durations, and let the global reduced-motion rule handle opt-out.
- Omnibox keywords (settings, extensions, history, downloads) resolve in
  `shared/urls.js`, before the bare-domain check, exact single word only.
- Bangs (`shared/bangs.js`) resolve in the same place. An alias may not contain
  a dot, slash, colon or space — that is what keeps `yt.com` a site. An explicit
  `!` outranks an internal page name; a bare keyword does not. The store keeps
  only the diff against the defaults, removal tombstones included.
- `.results` is a flex column, so its children need `flex: none` or a page
  taller than the viewport squashes every card instead of scrolling.
- `page-preload.js` reports the page's selected text to main for the conversion
  popup. The text never leaves the machine, and only a currency selection
  causes a network request (frankfurter.app, ECB daily reference rates).
- The conversion popup sits *above* the selection by preference, the way Opera
  does: covering lines already read beats covering the ones still ahead.
- A main-frame `did-fail-load` swaps in `ember://unreachable`; a 404/410 does
  not, because the site's own page is often the useful one. Statuses arrive via
  `session.webRequest.onCompleted`, whose filter needs `urls` as well as
  `types`, and can land either side of `did-navigate` — hence `tab.httpStatus`
  carries the URL it belongs to. archive.org is asked only on a click.
- `win.setFullScreen()` is a no-op on the transparent frameless window on
  Windows. F11 fills the display bounds by hand and restores them (see
  `fullScreenFrom`).
- Overlays refract the page behind them, so over a white page light text
  vanishes. `backdrop-contrast.js` measures the capture and sets
  `data-backdrop="light"`, which flips the palette tokens in `glass.css`.
- `isNativeGlassUrl` covers newtab, history, downloads and settings; those pages
  ride the native window material and must paint no background of their own.
  `body.native-glass-page` (liquid-glass-ui.css) does that and hides `.ambient`.
- Their surfaces are the new-tab search material, mounted by
  `liquid-glass-ui.js` on `[data-lg]`. The layers are real children, so
  `element.textContent = …` wipes them — use `EmberLiquidGlass.setLabel()`;
  children keep any `position`/`z-index` they already declare. List hover is
  the dropdown's selector lens, `attachLens(host, { items })`, re-callable after
  a re-render. The aberration pushes blue 40px, so `.lg-warp` overhangs by
  `--lg-bleed` and `.lg` clips it — without that a small control loses its fill.
- `ember://extensions` is the dropdown panel's own document and needs
  `window.emberPanel`, which only the panel preload provides. As a tab it renders
  an empty shell, which is why it stays off the native glass list.
- Shortcuts live only in main (`before-input-event`); the renderer must not
  duplicate them or they double-fire when the chrome view has focus.
- `browser` is the focused window; `browsers` holds them all. Private windows
  run on the `persist:ember-private` partition and skip history.
- Files are LF via `.gitattributes`, but Git may hand you CRLF working copies.
  Multi-line string replacement in scripts silently no-ops against those.
  Verify edits landed instead of trusting the write.

**Not yet set up** (don't go looking): TS config, linter, CI,
CODEOWNERS, branch protection, `electron-updater`, tab reordering/drag,
find bar, `ember://extensions` as a real tab.

**Decided, don't relitigate:** `WebContentsView` not `BrowserView` · frameless
window with custom controls · omnibox falls back to Google search · extensions
via `electron-chrome-web-store` + `electron-chrome-extensions`, which makes the
project **GPL-3.0** · internal pages on `ember://` via `protocol.handle` ·
adblock via `@ghostery/adblocker-electron` when milestone 5 lands · Shields
keyed by eTLD+1 · `better-sqlite3` + `safeStorage` + JSON settings · no
Widevine, so DRM video will not play · not every CWS extension works, Electron
implements a subset of the platform.

---

## 1. Shared codebase — no assigned areas

Either agent may touch any file. There are no fenced-off areas and no
per-directory owners. The humans decide who works on what; your job is to not
destroy the other agent's work while doing it. The rule that does that is §2:
**every push must contain the other agent's changes as well as your own.**

Default posture is **additive**. Add, extend, wrap. If finishing your change
requires deleting or rewriting something the other agent wrote, that is not a
merge decision you make alone — stop and ask your human first.

Any change that moves files wholesale (a TypeScript migration, a folder
reshuffle) must be announced in the Work Log before it starts — it conflicts
with everything in flight.

---

## 2. Sync protocol

### Before starting

1. `git fetch origin && git status`.
2. Read the Work Log (§4) — it says what the other agent is doing *right now*.
3. If an `in-progress` entry lists a file you're about to touch, say so in your
   own entry and keep your change additive, or wait. Don't silently double up.
4. Add your Work Log entry **before** writing code; commit it first.

### Every push integrates their work first

Never push without syncing. The sequence, every time:

```bash
git fetch origin
git log --oneline HEAD..origin/main        # what landed since you branched
git diff HEAD...origin/main --stat         # which files they touched
git rebase origin/main
npm start                                  # smoke: window boots, no errors
git push
```

Lines 2 and 3 are the point: **look at what changed since your last sync before
resolving anything.** If their commits touched a file you also touched, read
their version before deciding what yours should do.

### Resolving conflicts — keep both, never overwrite

- Both added different things → keep **both**. This is most conflicts.
- Both changed the same line → take **theirs** as the base, re-apply your change
  on top of it. Never resolve by deleting their line.
- They deleted something you edited, or vice versa → don't guess. Keep the
  content, note it in your Work Log entry, tell your human.
- Genuinely incompatible designs → stop. Don't pick a winner. Ask.

### Confirm nothing was lost, before pushing

A clean rebase is not proof you kept their work. Check:

```bash
git diff origin/main                 # every hunk should be intentionally yours
git log --oneline origin/main..HEAD  # only your commits, none of theirs replayed away
```

If something they pushed is missing from your branch, restore it before pushing.
If you can't tell, don't push — fetch again and re-read their commits.

### Never

Force-push anything · rewrite, revert or "clean up" the other agent's commits ·
resolve a conflict by taking your whole side · push a branch that isn't rebased
onto current `origin/main` · end a session with a dirty tree without saying so.

---

## 3. Rules

**IPC** — every channel name is a named constant in `src/shared`; no string
literals elsewhere. New channel = reviewed PR into `src/shared` first, then both
sides build against it. Rename/remove = breaking, needs a Work Log note.
Renderer reaches main only through the preload bridge, `contextIsolation: true`,
`nodeIntegration: false`. No exceptions.

**Code** — `BrowserView` is banned (deprecated since Electron 30). No
`chrome://` pages. Don't reuse Opera GX or Brave names, icons, sounds, or
shaders — inspiration only.

**Docs** — `README.md` stays exactly as it is: the title and the one-line
description, nothing else. Do not expand it, do not add sections to it, and do
not create other `README.md` files, a `docs/` folder, or any other prose
documentation. This is deliberate — everything an agent needs belongs in §0 of
this file, and everything a human needs is in the code. If you think something
must be written down, put it in §0 or a Work Log entry.

**Git** — branches `feat/… fix/… chore/… refactor/…`. Commits
`<area>: <imperative summary>` (`main: add tab manager`). Rebase, don't merge.
One PR per Work Log entry. Gates
before push: `npm start` today; add `npm run typecheck` and `npm run lint` here
as they come to exist.

**Token discipline** — update §0 in the same commit that makes it stale
(new dependency, new top-level dir, milestone done, decision changed). Prefer
editing a line in §0 over adding a new one. Work Log keeps the **10 newest**
entries; when trimming, fold anything still true into §0 and drop the rest —
the log is a handoff channel, not history. Git already has the history.

---

## 4. Work Log

Newest at top. One entry per branch, updated in place. Status:
`in-progress` → `pushed` → `merged` (or `abandoned`).

```markdown
### <YYYY-MM-DD> — <agent> — <title>
- **Status / Branch:** in-progress · `feat/tab-manager`
- **Touches:** `src/main/tabs.ts`, `src/shared/ipc.ts` — list every file; this
  is how the other agent spots a collision before it happens
- **Summary:** one or two sentences: what and why.
- **For the other agent:** new IPC channels, renamed files, contracts they must
  implement against. `none` if none.
```

### 2026-08-23 — Claude Code — Internet Archive fallback
- **Status / Branch:** merged · `main`
- **Touches:** `src/shared/{archive,ipc}.js`, `src/main/{archive,tabs,index,context-menu-model}.js`,
  `src/renderer/pages/unreachable.{html,css,js}`, `src/renderer/chrome.{html,css,js}`,
  `src/renderer/{chrome.*,preload.js}`, `test/archive.test.js`
- **Summary:** Roadmap feature 4. A page that cannot be reached gets Ember's own
  error page with Retry and View archived version; a 404 or 410 keeps the site's
  own page and surfaces the archive as a toolbar action instead. Nothing
  redirects on its own.
- **For the other agent:** new channel `archive:open` and `UNREACHABLE_URL`.
  `TabManager` tabs gain `pageStatus`, reported in `state().nav`.

### 2026-08-23 — Claude Code — Smart selection conversions
- **Status / Branch:** merged · `main`
- **Touches:** `src/shared/{conversions,ipc}.js`,
  `src/main/{selection-panel,rates,page-preload,index,settings}.js`,
  `src/renderer/pages/conversion.{html,css,js}`,
  `src/renderer/pages/settings.{html,css,js}`, `test/conversions.test.js`
- **Summary:** Roadmap feature 3. Selecting a price, measurement or time on a
  page shows a compact glass popup with the value converted into the units the
  user prefers. Currency uses ECB rates, cached in userData for a day.
- **For the other agent:** new channels `selection:changed` and
  `selection:action`. `page-preload.js` now reports selection rects for every
  page, which is the first thing it does on real web pages beyond file inputs.

### 2026-08-23 — Claude Code — Omnibox bangs / quick searches
- **Status / Branch:** merged · `main`
- **Touches:** `src/shared/{bangs,urls}.js`, `src/main/{settings,index}.js`,
  `src/renderer/pages/settings.{html,css,js}`, `src/renderer/pages/history.css`,
  `src/renderer/theme.css`, `test/bangs.test.js`
- **Summary:** Roadmap feature 2. `yt liquid glass` and `!gh electron` resolve
  in the omnibox before the default search, against a built-in table plus a
  fully editable user list stored in settings.
- **For the other agent:** `toNavigationUrl(input)` gains an optional second
  argument `{ bangs }`; calling it with one argument keeps today's behaviour.

### 2026-08-23 — Claude Code — Tab hibernation + thumbnail cache
- **Status / Branch:** merged · `main`
- **Touches:** `src/main/{hibernation,tab-thumbnails,tabs,settings,index,context-menu-model,context-menu-panel}.js`,
  `src/shared/ipc.js`, `src/renderer/{preload.js,chrome.js,chrome.css}`,
  `src/renderer/pages/settings.{html,js,css}`, `test/{hibernation,tab-thumbnails}.test.js`
- **Summary:** Roadmap feature 1. Idle background tabs genuinely lose their
  renderer after a configurable timeout; the tab record survives with url, title,
  favicon, scroll and a cached screenshot, and clicking it rebuilds the view.
  Protected categories (active, audible, capturing, downloading, dirty forms,
  never-sleep tab/domain, internal pages) are exempt. Right-click a tab for
  Sleep now / Never sleep this tab / Never sleep this domain.
- **For the other agent:** `TabManager` tabs may now have `view === null` and
  `webContents === null` when `tab.asleep` is true — guard before touching them.
  New channels `tab:action` and `tab:context-menu`. `ThumbnailCache`
  (`src/main/tab-thumbnails.js`) is the one place page screenshots are cached;
  read from it rather than calling `capturePage()` for a preview.

### 2026-08-22 — Claude Code — Native glass on every internal page
- **Status / Branch:** merged · `main`
- **Touches:** `src/shared/native-glass.js`,
  `src/renderer/pages/{liquid-glass-ui.js,liquid-glass-ui.css,history.*,downloads.*,settings.*}`,
  `test/{native-glass,liquid-glass-ui}.test.js`
- **Summary:** The Windows AccentBlurBehind surface now backs history, downloads
  and settings as well as the new tab, so they sit on the same translucent window
  instead of the ambient purple-orange wash. Every surface on those pages is the
  new-tab search material (same blur, saturation, aberration and rim; elasticity
  0) and lists hover with the dropdown menu's sliding selector lens.
- **For the other agent:** `isNativeGlassUrl` now matches those four URLs — for
  new-tab-only behaviour compare against `NEW_TAB_URL` directly. New shared
  renderer modules `liquid-glass-ui.{js,css}` are served from `pages/`;
  `page-glass.js` is now used only by whatever still opts into it.

### 2026-08-22 — Claude Code — Shortcuts, multi-window, light-backdrop glass
- **Status / Branch:** merged · `main`
- **Touches:** `src/main/{shortcuts,index,tabs}.js`, `src/shared/ipc.js`,
  `src/renderer/{glass.css,theme.css,chrome.js}`,
  `src/renderer/pages/{backdrop-contrast.js,upload.js,context-menu.js,session-prompt.*,history.css}`,
  `test/shortcuts.test.js`
- **Summary:** Full Chrome-parity shortcut set incl. Ctrl+1..9, Ctrl+Tab,
  Alt+arrows, F11, zoom and Ctrl+Shift+N private windows. Overlays now detect a
  light captured backdrop and flip to dark text. Shared edge tokens unify glass
  borders, rims and shadows.
- **For the other agent:** shortcuts belong in `src/main/shortcuts.js` — add to
  the table, not to renderer key handlers. Ctrl+Shift+B stayed in `chrome.js`
  and still works because the table does not claim it.

### 2026-08-22 — Codex — Native Glass new-tab integration
- **Status / Branch:** pushed · `native-glass`
- **Touches:** `AGENTS.md`, `src/main/{index,native-backdrop}.js`, `src/main/page-preload.js`, `src/shared/{ipc,native-glass}.js`, `src/renderer/pages/{newtab.*,native-glass.js}`, `test/{native-glass,renderer-contracts}.test.js`
- **Summary:** Make only the new-tab viewport expose a live Windows AccentBlurBehind surface tinted `8C000000`, then layer a configurable DOM-backed Liquid Glass search surface above it so the material visibly blurs a second time. The window root is transparent so the native layers are visible, and teardown is safe after Electron destroys the parent.
- **For the other agent:** New native-glass configuration and IPC may be added; no `poc/` content, dependencies, files, or commits will enter this branch.
### 2026-08-22 — Claude Code — Polish pass: motion, type, settings (BRANCH)
- **Status / Branch:** pushed · `feat/polish` (stacked on `feat/session-restore`)
- **Touches:** `src/renderer/theme.css`, `src/renderer/chrome.css`,
  `src/renderer/pages/{newtab,history,downloads,session-prompt,settings}.*`,
  `src/shared/urls.js`, `src/shared/ipc.js`, `src/main/{index,page-preload}.js`
- **Summary:** One motion system in theme tokens applied across chrome and pages,
  Segoe UI Variable for smoother UI text, omnibox keywords for internal pages,
  and a real `ember://settings` page exposing the session-restore preference.
- **For the other agent:** this branch contains `feat/session-restore` as well.
  New channels `settings:get|set` and `SETTINGS_URL`.

### 2026-08-22 — Claude Code — Session restore + window state (BRANCH)
- **Status / Branch:** pushed · `feat/session-restore`
- **Touches:** `src/main/{settings,session,session-prompt,index}.js`,
  `src/renderer/pages/session-prompt.*`, `src/renderer/pages/liquid-glass.js`,
  `test/session.test.js`, `AGENTS.md`
- **Summary:** Closing with tabs open asks "Reopen these tabs next time?" with
  Yes / No / Yes-and-don't-ask-again / No-and-don't-ask-again, on the shared
  captured-backdrop glass. Saved tabs reopen on next launch. Window size and
  position persist too.
- **For the other agent:** new stores write `settings.json` and `session.json`
  in userData. The prompt reuses `FloatingPanel` and the existing
  `overlay:action` channel with command `session`; no new IPC channels.

### 2026-08-22 — Claude Code — Downloads page + real page glass
- **Status / Branch:** pushed · `feat/downloads-and-page-glass`
- **Touches:** `src/main/{downloads,index}.js`, `src/shared/ipc.js`,
  `src/main/page-preload.js`, `src/renderer/pages/{downloads.*,page-glass.js,history.*}`,
  `src/renderer/theme.css`, `test/downloads.test.js`, `AGENTS.md`
- **Summary:** Milestone 6 downloads at `ember://downloads` (Ctrl+J): live progress,
  pause/resume/cancel, open/show/remove, filters and totals. History and downloads
  now use real refraction via `page-glass.js` rather than a plain blur.
- **For the other agent:** new channels `downloads:query|action|changed` and
  `DOWNLOADS_URL`. New ambient tokens live in `theme.css` — reuse those for any
  future full-page surface instead of new rgba values.

