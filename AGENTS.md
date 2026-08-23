# AGENTS.md — Ember

Shared instruction set for every coding agent working on Ember. This file is both
the repository orientation cache and the coordination contract. Read it before
changing code.

**Repo:** `v11exe/ember` · default branch `main` · Windows development machines.  
**Stack:** Electron `^43.4.1`, CommonJS JavaScript, no build step.  
**Gates:** `npm start`, `npm test`, `npm run smoke`.

`ROADMAP.md` is the authoritative numbered feature specification. `README.md`
is the concise human-facing feature summary.

---

## 0. Orientation cache

Do not rediscover the whole repository every session. Trust this map until code
you are actively changing proves a line stale; then update this file in the same
change.

```text
ROADMAP.md                     numbered feature source of truth + compatibility guardrails
README.md                      product description + meaningful completed/upcoming QOL
src/main/index.js              app bootstrap, BaseWindow, IPC handlers, lifecycle
src/main/tabs.js               TabManager — lifecycle + shared shell/page view layout
src/main/extensions.js         Chrome Web Store install + chrome.* APIs
src/main/{panel,floating-panel}.js
                               bounded dropdown/overlay WebContentsViews
src/main/bookmarks.js          bookmark HTML import + atomic JSON store
src/main/history.js            visit/recently-closed store
src/main/downloads.js          DownloadItem mirror + finished downloads
src/main/settings.js           preferences
src/main/hibernation.js        true idle-tab renderer discard policy + probes
src/main/tab-thumbnails.js     cached screenshots keyed by tab id
src/main/selection-panel.js    smart-conversion popup
src/main/rates.js              cached exchange-rate provider
src/main/archive.js            click-only Wayback availability lookup
src/main/switcher-panel.js     MRU Ctrl+Tab visual switcher
src/main/session.js            launch/session restore state
src/main/session-prompt.js     close-time restore prompt
src/main/shortcuts.js          browser keyboard command table
src/main/popup-positioner.js   extension popup collision/clamping
src/main/{upload-panel,context-menu-panel}.js
                               file picker/context-menu overlay controllers
src/main/{recent-uploads,upload-files,context-menu-model}.js
                               upload/menu data and actions
src/main/protocol.js           ember:// protocol
src/main/page-preload.js       sandboxed page bridge, selection + file-input interception
src/renderer/preload.js        chrome UI contextBridge
src/renderer/chrome.*          unified 32px top shell + tab strip + caption controls
src/renderer/{sidebar,frame,corner-mask}.*
                               bounded Favorite rail, perimeter gradients + page clipping
src/renderer/shell-{material,metrics}.*
                               synchronized whole-window material across bounded views
src/renderer/theme.css         shared palette/type/motion tokens
src/renderer/brand.*           canonical Ember branding mounts
src/renderer/panel-preload.js  dropdown bridge/browser-action injection
src/renderer/pages/            internal pages and floating overlays
src/renderer/pages/liquid-glass-ui.{js,css}
                               shared internal-page material/selector lens
src/renderer/pages/page-glass.js
                               full-page refraction helper
src/renderer/pages/backdrop-contrast.js
                               light/dark captured-backdrop detection
src/shared/{chrome-layout,favorites}.js
                               shell geometry + ordered Favorite contracts
src/shared/                    IPC, URLs, bangs, conversions, archive and other contracts
scripts/smoke.js               Electron boot/integration gate
scripts/capture-ui.js          visual QA capture utility
test/                          node:test contracts/integration fixtures
```

### Current meaningful roadmap state

- #1 Automatic tab hibernation / renderer offloading — completed.
- #2 Bangs / custom Quick Searches — completed.
- #3 Smart selection conversions — completed.
- #4 Internet Archive fallback — completed.
- #5 Arc-style Ctrl+Tab visual switcher — completed.
- #7 Instant / Favorite sidebar buttons — completed.
- #6 and #8–#37 — planned unless `ROADMAP.md` has subsequently been updated.
- #9 Split View is **not** implemented on current main despite an older roadmap
  draft saying otherwise.
- The recent-file/clipboard upload picker exists, but it is not the full #31
  Recent Files / Library sidebar feature.

### Important invariants / gotchas

- A hibernated tab keeps its record while `view === null` and
  `webContents === null`; guard both. `tabs.select()` wakes before activation.
- `webContents.destroy()` emits `destroyed` late. Compare the renderer identity
  before removing a tab record; a tab may already have been woken.
- `capturePage()` on `WebContentsView` needs an explicit page rect and a bounded
  timeout. Hidden views often cannot produce a frame.
- When leaving a tab, keep the outgoing view visible behind the new one until its
  thumbnail is captured; sleeping tabs reuse that cached screenshot.
- `navigationHistory.restore()` restores navigation entries but not reliable live
  scroll state; Ember restores scroll separately.
- `lastActiveAt` is stamped when a tab is left. `0` means never focused; do not
  replace it with `|| now`.
- Any await inside hibernation must re-check discardability before destroy.
- Hibernation blockers already include active/visible tabs, media/audio, PiP,
  fullscreen, capture, download, unsaved forms/beforeunload, protected tabs and
  user/domain opt-outs. Future Split/Follower/Floating features must set/retain
  the appropriate visible/in-use state rather than bypassing this protection.
- `.setting` can outrank the UA `[hidden]` rule; hideable rows need an explicit
  `.setting[hidden] { display: none }`.
- `injectBrowserAction()` must actually be called from the panel preload.
- Extension action icons need
  `ElectronChromeExtensions.handleCRXProtocol(session)`.
- Extension popups open leftward by default; anchor rects are window-relative.
  Clamp the resulting real popup against its parent window.
- Dropdowns have their own `WebContentsView`. Do not grow the chrome view over
  the page; that caused the full-page black overlay regression.
- Unified chrome is split into bounded top, sidebar and 8px frame views; none may
  sit underneath a transparent page, because Windows composites that path black.
  Page bounds come from `shared/chrome-layout.js`; four 12px transparent radial
  corner overlays provide reliable anti-aliased clipping because Electron's
  native `View.setBorderRadius()` does not clip Windows WebContents pixels. The
  transparent arc forwards pointer/wheel input to the page; do not turn those
  rectangular overlay views into dead hit targets.
- A child `WebContentsView` does not export a reliable full-height CSS caption
  region through `BaseWindow` on Windows. Blank top-chrome dragging therefore
  uses the pointer-captured `win:drag-*` bridge; keep interactive controls out of
  that target set.
- Sidebar collapse interpolates sidebar, page and bottom-frame bounds together
  on 16ms ticks for 210ms. Do not restore Electron's platform `animate` bounds
  option: it is not frame-synchronous on Windows and made native glass jump.
- The Favorite rail is global and ordered today. It resolves a matching site,
  then creates a tab at the stored exact URL; selecting a sleeping match must
  wake it through the ordinary tab lifecycle rather than keeping Favorites alive.
- Horizontal tab drag reorders the existing tab records without recreating their
  renderers. Dropping a tab into the Favorite region stores its exact page URL,
  de-duplicates and reuses by site, and never destroys the source tab. Favorite
  open state includes matching background and sleeping tabs; removal does not
  close them.
- Top, sidebar, frame and corner-mask views receive window-relative shell metrics
  and sample `shell-material.css`. Keep that single material synchronized on every
  resize/collapse frame rather than restoring independent regional gradients.
- Upload/context/switcher/selection overlays use bounded `FloatingPanel`
  infrastructure. Do not replace normal page bounds to fake an overlay.
- Shortcuts that must work while a webpage owns focus go through
  `before-input-event` in main. Do not duplicate shortcuts in renderer code.
- `Ctrl+Tab` commits on Ctrl key-up through the switcher page because Electron's
  main `before-input-event` path did not reliably deliver that key-up.
- `FloatingPanel.patchState()` is for small overlay state changes; do not resend
  expensive screenshots just to change a selected index.
- Bang aliases resolve before default search. Alias syntax intentionally excludes
  dots, slashes, colons and spaces so normal URLs cannot be stolen.
- Explicit `!alias` can outrank an Ember internal-page keyword; a bare alias must
  not silently steal an exact internal command.
- `resolveInput()` in `shared/urls.js` is the single decision point for omnibox
  text. The chip the omnibox shows and the navigation main performs come from
  the same call, so a preview can never promise what Enter will not do. Add new
  input kinds there, never in a renderer.
- A reachable host outranks an alias named after it: `localhost` and
  `localhost:3000` go to the dev server even if a bang is called `localhost`.
- The chrome preload keeps its own copy of the bang list (pushed on
  `bangs:changed`) and resolves synchronously, because the chip has to land on
  the keystroke. Sandboxed `ember://` pages cannot load the resolver and ask
  main over `omnibox:resolve` instead; guard those answers against arriving out
  of order.
- Tab-to-search removes the keyword from the omnibox and keeps it in `engaged`;
  submit re-attaches it so there is still only one resolution path.
- Selection conversion stays local except currency-rate lookup.
- Archive lookup is user-triggered only. Never send failed URLs to archive.org
  in the background and never auto-redirect to an archived page.
- Network failures can replace the page with `ember://unreachable`; 404/410 keep
  the site's own page and expose archive access separately.
- `win.setFullScreen()` is unreliable on the transparent frameless Windows
  window; F11 uses Ember's manual display-bounds path.
- Full-page native-glass pages must not paint an opaque page background.
- Overlay glass over light pages switches palette via `backdrop-contrast.js`.
- `ember://extensions` is the dropdown document and relies on `window.emberPanel`;
  it is not currently a normal internal tab.
- Private windows use `persist:ember-private` and skip history.
- Files are LF via `.gitattributes`; verify scripted multiline replacements.
- No Widevine: DRM playback is not guaranteed.
- Electron supports only a subset of Chrome extension APIs.

### Decisions already made

`WebContentsView`, not deprecated `BrowserView` · custom frameless window ·
Google fallback search · `ember://` internal pages · extension support through
`electron-chrome-web-store` + `electron-chrome-extensions` (GPL-3.0 implications)
· no `chrome://` pages · browser inspiration is behavioral, not copied branding
or proprietary assets.

Not yet established unless the repo later proves otherwise: TypeScript config,
linter, CI, CODEOWNERS, branch protection, `electron-updater`, find bar, or
`ember://extensions` as a normal tab.

---

## 1. Roadmap feature protocol — mandatory

When the user asks for a feature by number, by roadmap name, or otherwise makes
it clear that a task implements a `ROADMAP.md` feature, follow this process.

1. **Read the full feature specification.** Read its entire numbered section,
   including source, priority, examples, requirements, status and completion /
   compatibility guardrails. Also read the global UI rule and priority list.
2. **Map dependencies before coding.** Search all of `ROADMAP.md` for the same
   subsystem and related concepts. Identify every existing or future feature that
   could conflict, duplicate state, alter lifecycle assumptions or share UI.
   Completed-feature guardrails are hard constraints.
3. **Verify current implementation.** Inspect the relevant current code, tests
   and Work Log. Never mark a feature complete because prose says it exists when
   the actual branch does not implement and test it.
4. **Research the feature intensively before choosing architecture.** Prefer
   primary Electron, Chromium and WebExtensions documentation; inspect upstream
   Chromium code where useful; study open-source browsers and extensions that
   implement equivalent behavior.
5. **Inspect extension implementations when relevant.** If a Chromium extension
   solves the same problem, inspect its public source or lawfully available
   distributed CRX/package/source to understand APIs, lifecycle and edge cases.
   Do not blindly copy code, proprietary assets, or license-incompatible source.
   Reimplement the useful technique cleanly inside Ember.
6. **Choose an Ember-native design.** Fit the feature into the existing
   `WebContentsView`, main/preload/IPC and overlay architecture. Prefer shared
   contracts and reusable state over isolated hacks or one-off renderer logic.
7. **Implement the complete acceptance criteria.** Include settings, persistence,
   keyboard/mouse behavior, error states, lifecycle edges and cross-feature
   integration named by the roadmap. A visual mock or partial happy path is not
   a completed roadmap feature.
8. **Test the interactions, not only the feature alone.** Add focused tests and
   regression coverage for every existing feature it can affect. Run the
   relevant focused tests, then `npm test` and `npm run smoke` where applicable.
9. **Re-scan the entire roadmap before declaring completion.** Check whether the
   implementation introduces new assumptions another future feature must honor.
10. **Update `ROADMAP.md` in the same change.** Set the feature to
    `✅ Completed`, keep the full specification, and add/update a
    `Completion / compatibility guardrails` section describing durable behavior,
    dependencies and future clashes. Never delete completed feature text.
11. **Cross-reference future conflicts.** If another planned feature could break
    the completed one, add a concise note to that planned feature too when useful.
12. **Update `README.md` only for meaningful user-facing QOL.** Move the feature
    from Upcoming to Completed when it genuinely changes browsing workflow.
    Do not list appearance-only work, translucent/glass styling, routine browser
    plumbing or basic expected functionality as headline completed features.
13. **Update this file and the Work Log** when architecture, contracts, gotchas or
    implementation state changed.

Concrete compatibility example: #1 hibernation must never sleep a visible/active
future #9 Split pane, #10 Follower view, or #11 floating webpage. Implementing
those future features requires honoring #1's existing lifecycle rules, not
rewriting hibernation as if those features did not exist.

---

## 2. Shared codebase / coordination

Either agent may touch any file. There are no permanent file ownership zones.
Default posture is additive: add, extend or wrap existing behavior.

Before starting:

1. `git fetch origin && git status`
2. Read the Work Log below.
3. Check whether another in-progress task touches the same files.
4. Add/update your Work Log entry before substantial edits.

Before every push:

```bash
git fetch origin
git log --oneline HEAD..origin/main
git diff HEAD...origin/main --stat
git rebase origin/main
npm start
git diff origin/main
git log --oneline origin/main..HEAD
git push
```

If both branches changed the same file, read the other change first. Preserve
both compatible changes. If the designs are genuinely incompatible, do not
silently pick one. Never force-push, erase another agent's work, or resolve a
conflict by taking an entire side without understanding it.

A wholesale file move, TypeScript migration or folder reshuffle conflicts with
nearly everything; record it before starting.

---

## 3. Repository rules

**IPC:** channel names are named constants in `src/shared`; renderer-to-main
access goes through preload bridges with `contextIsolation: true` and
`nodeIntegration: false`.

**Code:** `BrowserView` is banned. No `chrome://` pages. Do not copy another
browser's trademarks, icons, sounds, shaders or proprietary implementation.

**Docs:** `ROADMAP.md` is the detailed numbered source of truth. `README.md`
contains only the short product description plus meaningful Completed and
Upcoming feature lists. Do not add installation/start/build instructions to the
README. Keep implementation detail and compatibility contracts in the roadmap
or this file rather than bloating the README.

**Git:** prefer `feat/...`, `fix/...`, `chore/...`, `refactor/...`. Commit format
is `<area>: <imperative summary>`. Rebase rather than merge when working on a
branch. Do not push without syncing first.

**Maintenance:** when code makes this orientation cache stale, update the stale
line in the same change. Keep Work Log entries concise and trim old entries;
Git is the history archive.

---

## 4. Work Log

Newest first. One entry per active/recent unit of work.

```markdown
### <YYYY-MM-DD> — <agent> — <title>
- **Status / Branch:** in-progress | pushed | merged · `<branch>`
- **Touches:** every affected path
- **Summary:** what changed and why
- **For the other agent:** contracts/risks they must know, or `none`
```

### 2026-08-23 — Codex — Shell compositing and Favorite drag polish
- **Status / Branch:** completed · `feat/ember-shell`
- **Touches:** `docs/superpowers/{specs,plans}/*`, `src/shared/{chrome-layout,favorites,ipc}.js`,
  `src/main/{index,tabs,context-menu-model,context-menu-panel}.js`,
  `src/renderer/{chrome,sidebar,frame,corner-mask,preload,brand}.*`, renderer assets,
  `test/*`, `scripts/capture-ui.js`, `ROADMAP.md`, `AGENTS.md`
- **Summary:** Synchronized the bounded native shell surfaces, removed corner and
  perimeter artifacts, restored the white-stroke chrome mark, and added horizontal
  tab reorder plus tab-to-Favorite pinning, open-state and removal.
- **For the other agent:** Preserve the accepted 32px/168px shell geometry and the
  hibernated-tab lifecycle; native page masks remain required on Windows.

### 2026-08-23 — Claude Code — Omnibox quick-search refinement
- **Status / Branch:** merged · `main`
- **Touches:** `src/shared/{urls,ipc}.js`, `src/main/{index,page-preload}.js`,
  `src/renderer/{preload.js,chrome.*}`, `src/renderer/pages/{newtab.*,liquid-glass-search.js,settings.*}`,
  `scripts/capture-ui.js`, `test/{bangs,preload,renderer-contracts}.test.js`
- **Summary:** Roadmap feature 2, second pass. The omnibox now *shows* the
  quick search it recognised instead of only acting on it at Enter: a chip
  names the engine as you type, Tab commits to it and drops the keyword,
  Backspace steps back out. The new-tab search field shows the same chip.
  Settings gained a restore for Ember's own list and a notice when a keyword
  is overridden.
- **For the other agent:** `toNavigationUrl()` is now a thin wrapper over
  `resolveInput()`, which returns `{ kind, url, alias, term, name }` — use it
  for anything that needs to know what omnibox text means. New channels
  `bangs:get`, `bangs:changed` and `omnibox:resolve`. `capture-ui.js` gained
  `omnibox-{hint,engaged}.png` and `newtab-chip.png`.

### 2026-08-23 — ChatGPT — Roadmap and agent workflow
- **Status / Branch:** merged · `main`
- **Touches:** `ROADMAP.md`, `README.md`, `AGENTS.md`
- **Summary:** Added the numbered feature source of truth, reconciled it with
  current main, and made numbered feature requests follow a research,
  cross-feature compatibility, testing and documentation protocol.
- **For the other agent:** features #1–#5 are verified complete; #9 is currently
  planned. Completed roadmap entries remain in place with compatibility notes.

### 2026-08-23 — Claude Code — Hibernation refinement pass
- **Status / Branch:** merged · `main`
- **Touches:** `src/main/{hibernation,tabs,tab-thumbnails,index}.js`,
  `test/{hibernation,tab-thumbnails}.test.js`
- **Summary:** Restores back/forward, scroll and zoom; fixes idle timing,
  discard-race rechecks, PiP/fullscreen/beforeunload blockers and thumbnails.
- **For the other agent:** sleeping tabs can have no renderer; thumbnail capture
  needs an explicit rect and can be skipped when the compositor has no frame.

### 2026-08-23 — Claude Code — Arc-style Ctrl+Tab switcher
- **Status / Branch:** merged · `main`
- **Touches:** switcher, shortcuts, floating-panel, tabs and switcher tests/pages
- **Summary:** MRU floating card switcher with cached screenshots; Ctrl release
  commits, Escape cancels, sleeping tabs wake only when selected.
- **For the other agent:** `FloatingPanel.patchState()` exists for cheap overlay
  updates; Ctrl+PageUp/PageDown retains physical strip cycling.

### 2026-08-23 — Claude Code — Internet Archive fallback
- **Status / Branch:** merged · `main`
- **Touches:** archive contracts/controller, tabs/index, context menu,
  unreachable page, chrome UI and tests
- **Summary:** Network failures expose Retry/Wayback; 404/410 retain the site's
  page and expose archive action; no automatic archive redirect.
- **For the other agent:** archive lookup remains click-only.

### 2026-08-23 — Claude Code — Smart selection conversions
- **Status / Branch:** merged · `main`
- **Touches:** conversions, selection panel, rates, preload, settings and tests
- **Summary:** Selected prices, measurements and times convert in a compact
  popup according to user preferences.
- **For the other agent:** page preload reports selection geometry; only
  currency conversion needs a network rate lookup.

### 2026-08-23 — Claude Code — Omnibox bangs / Quick Searches
- **Status / Branch:** merged · `main`
- **Touches:** bangs/URL contracts, settings, omnibox integration and tests
- **Summary:** Bare and `!` aliases resolve against defaults plus editable user
  templates before normal fallback search.
- **For the other agent:** preserve URL-safe alias restrictions and internal
  keyword precedence rules.

### 2026-08-23 — Claude Code — Tab hibernation + thumbnail cache
- **Status / Branch:** merged · `main`
- **Touches:** hibernation, thumbnails, tabs, settings, context actions and tests
- **Summary:** Idle tabs genuinely destroy their renderer and retain restorable
  browser state plus cached thumbnail.
- **For the other agent:** every future tab feature must tolerate sleeping tab
  records whose renderer/view does not exist.
