# AGENTS.md — Ember

Shared instruction set for every coding agent working on Ember. This file is both
the repository orientation cache and the coordination contract. Read it before
changing code.

**Repo:** `v11exe/ember` · default branch `main` · Windows development machines.  
**Stack:** Electron `^43.4.1`, CommonJS JavaScript, no build step.  
**Native port target:** external pinned Chromium checkout + Ember patch/resource
overlay; Electron remains the oracle during the port.
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
CHROMIUM_PORT_STATUS.md        mutable native-port parity/build ledger
chromium/baseline.json         immutable oracle/upstream revision pins
chromium/{patches,tools}/      Ember Chromium patch stack + external-checkout CLI
chromium/research/             pinned-upstream architecture and ABI handoff notes
chromium/reference/electron/   deterministic Electron visual oracle by commit
BUGS.md                        shared open defect/polish tracker (B# ids, claim before fixing)
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
src/main/snap-picker.js        screen-anchored Snap-layouts picker window
src/main/key-release.js        OS-level modifier-release watch (the switcher chord)
src/main/window-corners.js     re-asserts DWM rounded corners after events that clear them
src/native/                    small C# bridges compiled on demand (accent blur, key watch)
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
src/renderer/pages/overlay-liquid-glass.{js,css}
                               upstream-standard overlay optics + capture alignment
src/shared/snap-layouts.js     snap arrangement geometry, shared by main and the picker page
src/shared/tab-scroll.js       tab-strip wheel stride, glide and overscroll arithmetic
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
- #8 Arc-style Copy Link button — completed.
- #6 and #9–#37 — planned unless `ROADMAP.md` has subsequently been updated.
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
- The browser window is opaque with `backgroundMaterial: 'acrylic'` and
  `roundedCorners: true`. It is deliberately **not** transparent: a layered
  window is excluded from Snap, Snap Layouts and the minimise/restore
  animations, and has to draw its own corner. `OUTER_RADIUS` is 0 so DWM owns
  the outer curve and nothing rounds it twice.
- Ember paints no window corner: the curve is entirely DWM's. If anything
  clears `DWMWA_WINDOW_CORNER_PREFERENCE` the window goes square and nothing in
  Ember can tell it went square, so `window-corners.js` re-asserts it after the
  events that could — coalesced, and never for a maximised window.
- Windows draws Ember's caption buttons, not Ember. `titleBarStyle: 'hidden'`
  with a **transparent** `titleBarOverlay` is what makes the window an ordinary
  application to the shell: the Snap Layouts flyout appears for a real maximise
  button — one that answers `WM_NCHITTEST` with `HTMAXBUTTON` — and nothing
  else. An opaque overlay colour hides Ember's own bar and gives two stacked
  bars. `.window-controls` stays in the document to reserve `--caption-width`
  but is `visibility: hidden`; never re-show it over the system's buttons.
- `-webkit-app-region: drag` does not work on a `WebContentsView`. Ember moves
  its own window, so Windows never runs a move loop — edge snapping is
  implemented in `WIN_DRAG_END` and resolved from the live cursor, because the
  renderer coalesces drag moves and drops the pending one on pointer-up.
- Windows will not leave the maximised state while a mouse button is held, so
  `unmaximize()`/`restore()` called during a caption drag return with the window
  still zoomed and no event. Dragging a maximised window off the top therefore
  restores on pointer-up; `restoreUnderCursor()` computes the landing rectangle
  when the restore actually fires, from the live cursor, not from the grab.
  `WIN_DRAG_START` is an `invoke` so the renderer waits before taking pointer
  capture.
- Electron's default application menu binds Ctrl+W to Close Window.
  `Menu.setApplicationMenu(null)` at startup is what keeps Ctrl+W a tab close;
  `shortcuts.js` is the only owner of accelerators.
- A view that takes focus while a modifier is held is never sent that
  modifier's key-up. `FloatingPanel.show({ focus: false })` exists for overlays
  driven by a held chord; the switcher uses it and must keep using it.
- `backdrop-filter` samples an element's rectangle, not its rounded box, and a
  composited child is clipped to its ancestor's rectangle. Rounded surfaces
  carrying one need `clip-path`, not just `overflow: hidden`.
- Overlay views are reused, so an entrance animation must be a class removed
  and re-added with a reflow between. A finished CSS animation is no longer in
  `getAnimations()`.
- Overlay surfaces whose own text must be read wear `.glass-frosted` (or the
  shared `--frost-capture` / `--frost-fill` tokens). Any lens sampling the
  capture needs the same frost *and* the same fill, or the hovered row shows
  raw page colour.
- Conversion, upload and Ctrl+Tab surfaces use `overlay-liquid-glass` instead:
  the base material is 100/.5/140/2/0/32 and nested controls are 0/1.0/140/2/0.
  Always route their captured screenshot through `EmberOverlayGlass.setBackdrop()`
  so FloatingPanel bleed stays aligned and capture failure gets the non-plastic
  cool gray-blue fallback.
- **Testing a running Ember: drive it through `--remote-debugging-port`, not
  synthetic input.** `npx electron . --remote-debugging-port=9222`, then
  `http://127.0.0.1:9222/json/list` names one target per `WebContentsView`.
  `Runtime.evaluate` against a target runs code inside that view and
  `Page.captureScreenshot` photographs it alone. SendKeys/`keybd_event` go to
  whatever window has focus — they steal the developer's keyboard, and they
  stop arriving at all once anything else takes foreground.
- `updateTabMetrics()` cancels the pending pass when it is called again, and a
  new tab is followed by a run of state emits. Anything that must happen after
  the widths settle has to survive being superseded — keep it as state (an id,
  a flag), not as a closure handed to that one pass.
- A held-modifier chord cannot be ended by listening for its key-up. A
  `BaseWindow` does not route keys to whichever `WebContentsView` reports
  itself focused, and a sandboxed page view never surfaces a modifier key-up
  through `before-input-event`; a long hold can be released with nothing in
  Ember hearing it. `key-release.js` asks the OS instead. Any future feature
  driven by a held chord must use it.
- `tabs.select()` focuses the page it selected. Without that nothing in the
  window owns the keyboard after a switch and the next shortcut is swallowed.
- Frosted glass gets its readability from blur, never from opacity. Pushing
  `--frost-fill` towards opaque turns every overlay into a painted panel; the
  capture blur and the specular rim are what make it a surface.
- Windows' own Snap Layouts flyout is unreachable: it belongs to the shell and
  appears only for a window the OS is moving, or one answering WM_NCHITTEST
  with HTMAXBUTTON — the first needs a native drag region a `WebContentsView`
  cannot have, the second a window-procedure hook in Ember's process. Ember
  offers the same arrangements itself through `snap-picker.js`. The picker is
  its own screen-anchored, click-through window on purpose: inside the browser
  window it would travel with the cursor during a drag and no zone but the one
  already under the pointer could be reached. Main hit-tests the cursor against
  `shared/snap-layouts.js`; the page only paints what it is told.
- `NativeBackdrop` de-duplicates by material and runs one bridge process at a
  time; concurrent `SetWindowCompositionAttribute` calls on one handle are not
  safe.
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
- The Favorite rail is global and ordered today. An origin-root Favorite matches
  its host (ignoring `www`) plus its subdomains, and prefers an already-open root
  tab on its direct host; a non-root pathname matches only that path on the same
  host and ignores query/fragment. Selecting a sleeping match
  must wake it through the ordinary tab lifecycle rather than keeping Favorites alive.
- Favorite grid dimensions persist from 1×1 through 4×7 (default 2×2). Capacity
  is authoritative: reducing it truncates in reading order. Indexed drops insert
  and shift while space remains; a new site replaces the hovered cell only when
  full; existing Favorite drags only reorder. Keep site icons at 19px even when
  rows 5–7 compress their tile surfaces.
- Horizontal tab drag reorders the existing tab records without recreating their
  renderers. Dropping a tab into the Favorite region stores its exact page URL,
  permits same-site and exact duplicates with distinct tile IDs, and never
  destroys the source tab. Favorite open state includes matching background and
  sleeping tabs; removal does not close them.
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

### Native Chromium port contract

- All native-port work stays on `chromium-port` until the user explicitly
  changes that decision. Never merge it to `main` or delete the Electron app as
  an incidental cleanup.
- The Electron decisions and gotchas above describe the parity oracle. The final
  port must reimplement their user-visible and lifecycle outcomes in Chromium
  C++/Views/browser systems; it must not ship Electron, an Electron launcher, or
  an Electron-API compatibility shim.
- `chromium/baseline.json` is the immutable revision authority for a port
  baseline. Pin Chromium, the Windows build configuration, its common
  submodule, the Helium research references, and the exact Ember oracle commit.
  Never silently track an upstream branch or mix revisions.
- Chromium source, toolchains, downloads, profiles, and build output live in a
  short external work root. Do not vendor a full Chromium tree or generated
  configuration checkout. Source-controlled changes belong in the ordered
  `chromium/patches/series` stack or a small reviewed resource overlay.
- The external configuration is generated state. `chromium/tools/port.js`
  preparation must remain deterministic, idempotent, pinned, path-safe, and
  unwilling to overwrite foreign edits. Preserve upstream license files and
  record borrowed architecture/compatible source rather than copying blindly.
- Windows is the first supported platform. Use a normal HWND and native
  Chromium window plumbing so DWM corners, real caption hit testing, Snap and
  Snap Layouts, DPI changes, multi-monitor bounds, minimise/restore animation,
  accessibility, and input/focus behavior remain OS-native.
- Use Chromium's real `Profile`, `Browser`, `TabStripModel`, navigation,
  download, permission, sandbox/site-isolation, and extension systems. Real
  WebExtensions/Web Store flows and profile/private isolation replace the
  Electron extension/session emulation; do not weaken Chromium security to
  simplify parity.
- Preserve the existing current-main feature set exactly before adding planned
  roadmap work. `ROADMAP.md` items still marked planned are out of scope for the
  port. Hibernation and every completed-feature compatibility guardrail remain
  binding.
- Every vertical slice needs compile/runtime evidence where the host permits,
  focused native tests, regression coverage for affected Electron contracts,
  and visual/interaction comparison against
  `chromium/reference/electron/<oracle>/`. A screenshot alone never proves
  focus, lifecycle, security, extensions, accessibility, or Windows behavior.
- Update `CHROMIUM_PORT_STATUS.md` after every meaningful slice with exact
  commands/results, parity states, known blockers, and the next executable task.
  Do not mark an unbuilt or manually unverified subsystem complete.
- Never change a Windows COM interface or type-library ID only in install-mode
  metadata. Update the owning IDL and regenerate all persisted x86, x64 and
  arm64 MIDL outputs (including binary type libraries) in the same slice, then
  compile and test registration, activation, upgrade and coexistence behavior.

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
or this file rather than bloating the README. `BUGS.md` is the shared defect and
polish tracker: claim a `B#` by setting it in-progress with your agent name
before editing code, mark it fixed in the same change, and never renumber or
delete an entry.

**Git:** prefer `feat/...`, `fix/...`, `chore/...`, `refactor/...`. Commit format
is `<area>: <imperative summary>`. Rebase rather than merge when working on a
branch. Do not push without syncing first.

**Maintenance:** when code makes this orientation cache stale, update the stale
line in the same change. Keep Work Log entries concise and trim old entries;
Git is the history archive.

---

## 4. Work Log

Newest first. One entry per active/recent unit of work.

### 2026-08-30 — Codex — Native Chromium baseline
- **Status / Branch:** branding complete, native UI in-progress · `chromium-port`
- **Touches:** `AGENTS.md`, `CHROMIUM_PORT_STATUS.md`, `package.json`, `scripts/capture-ui.js`, `src/main/index.js`, `test/{chromium-port,smoke-startup}.test.js`, `chromium/`
- **Summary:** Established the pinned external-checkout architecture, Electron visual oracle, safe build/patch/resource tooling, and five identity/security/WebUI patches. The official x64 build completed all 57,877 initial actions plus visible-identity, 476-action intermediate-resource and final 952-action branding rebuilds. Direct PE/live-HWND probes and live Settings pixels/accessibility now prove Ember icons and every targeted glyph; final hash-owned installer/portable packages were produced. A smoke cold-start race found during the gate now awaits the first active tab and has regression coverage; 408/408 tests and smoke pass.
- **For the other agent:** Keep port work on `chromium-port`. Practical identity is closed for this friends-only build; defer executable renaming, signing and deep installer/upgrade/coexistence work unless distribution needs change. Start the native C++/Views shell now: preserve the 32 px top shell, 168 px sidebar, 8 px page inset, real `Profile`/`Browser`/`TabStripModel`, sandbox and Windows HWND behavior. Stable Chrome UA/CDP tokens remain intentional. Exact final hashes/runtime evidence are in `CHROMIUM_PORT_STATUS.md`; COM interface/type-library identity remains shared unless IDL and all persisted x86/x64/arm64 MIDL outputs are regenerated together.

### 2026-08-24 — Codex — Copy Link roadmap completion
- **Status / Branch:** completed · `glass-fixing`
- **Touches:** `ROADMAP.md`, `README.md`, `AGENTS.md`
- **Summary:** Reconciled feature #8 with the shipped sidebar Copy Link action, bounded confirmation feedback, and active-URL fallback behavior.
- **For the other agent:** Future Split View, Link Peek, and floating-page focus models must route Copy Link to their active page source.

### 2026-08-24 — Codex — Liquid-glass overlay restoration
- **Status / Branch:** completed · `glass-fixing`
- **Touches:** `AGENTS.md`, `THIRD_PARTY_NOTICES.md`, `src/main/protocol.js`, shared overlay liquid-glass material/asset, conversion/upload/switcher pages, renderer contracts and visual QA
- **Summary:** Replaced opaque black-plastic selection conversion, recent upload and Ctrl+Tab treatments with a faithful vanilla port of liquid-glass-react's standard filter and exact displacement map; follow-up QA removed the document-background corner artifacts and made nested Copy glass visibly react to hover and press.
- **For the other agent:** The base contract is 100/.5/140/2/0/32; nested controls/cards are 0/1.0/140/2/0. Use the shared capture-aligning helper, and retain its non-black missing-capture fallback.

```markdown
### <YYYY-MM-DD> — <agent> — <title>
- **Status / Branch:** in-progress | pushed | merged · `<branch>`
- **Touches:** every affected path
- **Summary:** what changed and why
- **For the other agent:** contracts/risks they must know, or `none`
```

### 2026-08-24 — Codex — Favorite target matching
- **Status / Branch:** completed · `main`
- **Touches:** `AGENTS.md`, `docs/superpowers/{specs,plans}/*`, `src/shared/favorites.js`, focused Favorite tests
- **Summary:** Quick Sites now retain same-site and exact duplicates, distinguish broad origin-root entries from specific origin/path entries, allocate an unused ID for every tab drop, and choose the correct already-open tab without UI changes.
- **For the other agent:** A broad origin prefers an already-open direct-host root tab, then may reuse a child-subdomain tab. A specific page never falls back to a broad origin tab, and query/fragment do not distinguish it. Existing Quick Site drags reorder; tab drags add duplicates.

### 2026-08-24 — Codex — BaseWindow resource teardown
- **Status / Branch:** in-progress · `main`
- **Touches:** `BUGS.md`, `AGENTS.md`, `docs/superpowers/plans/*`, lifecycle/panel/tab modules and focused tests
- **Summary:** Auditing B34: `BaseWindow` leaves child `WebContentsView` renderers alive unless Ember explicitly closes them. The implementation will add one idempotent per-browser teardown path while preserving the session-close prompt.
- **For the other agent:** Do not add a view or per-window listener without registering it in the teardown owner contract; the shared Snap picker dies only after the final browser window closes.

### 2026-08-24 — Codex — HTML media fullscreen
- **Status / Branch:** completed · `codex/url-bar`
- **Touches:** `src/main/{tabs,index}.js`, `test/tab-layout.test.js`
- **Summary:** HTML fullscreen events now promote the active page WebContentsView to native fullscreen, temporarily hide Ember's bounded shell, and restore the exact normal viewport when media exits fullscreen.
- **For the other agent:** Entering page fullscreen is tab-scoped and keeps only the requesting active tab full-screen; changing tabs exits it before normal selection layout resumes.

### 2026-08-24 — Codex — URL-bar refinement
- **Status / Branch:** completed · `codex/url-bar`
- **Touches:** `src/main/{index,copy-toast}.js`, `src/renderer/{sidebar.*,pages/copy-toast.*}`, tests and visual QA
- **Summary:** Simplified HTTP(S) URLs at rest, restored and selected their raw address on focus without native input chrome, used a white vector link glyph with deliberately open outer curves, and added compact animated copy feedback beside the sidebar without shifting its Favorite grid.
- **For the other agent:** The toast is an independent overlay because the sidebar view clips to 168px; it must not alter sidebar/page bounds or Quick Site hit testing.

### 2026-08-24 — Codex — Sidebar address field
- **Status / Branch:** completed · `codex/url-bar`
- **Touches:** `src/shared/ipc.js`, `src/main/index.js`, `src/renderer/{preload,sidebar}.{js,html,css}`, copy-link asset, focused tests and `docs/superpowers/plans/*`
- **Summary:** Added a native editable active-tab address field and minimal authoritative copy action above the existing Favorite grid; visual QA now captures this bounded sidebar state.
- **For the other agent:** The Favorites grid must move solely through layout; all tile dimensions, placement and drag/drop semantics stay unchanged.

### 2026-08-23 — Codex — Adaptive Favorite grid
- **Status / Branch:** completed · `feat/ember-shell`
- **Touches:** `src/shared/favorites.js`, `src/main/{settings,index}.js`,
  `src/renderer/{preload,sidebar}.*`, `src/renderer/pages/settings.*`, tests and docs
- **Summary:** Made the persisted Favorite rail configurable from 1×1 through
  4×7 with icon-preserving adaptive sizing and animated indexed insertion/replacement.
- **For the other agent:** The default remains 2×2 with the existing three starter
  sites; configured capacity becomes authoritative for stored Favorite count.

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

### 2026-08-24 — Claude Code — Tab strip scrolling (B10)

- **Status / Branch:** pushed · `main`
- **Touches:** `src/shared/tab-scroll.js`, `test/tab-scroll.test.js`,
  `src/renderer/{chrome.js,chrome.css,preload.js}`, `test/preload.test.js`,
  `BUGS.md`, `sync.bat`
- **Summary:** The wheel now glides a tab per notch, strides further when
  notches arrive quickly, and leans and stretches at the ends. The two causes
  that made it look broken were elsewhere: the strip chased the active tab on
  every state emit, and the scroll request for a newly opened tab was thrown
  away with the metrics pass that a following emit cancelled.
- **For the other agent:** the stride/overscroll arithmetic is in
  `shared/tab-scroll.js` and unit-tested — change the feel there, not in the
  renderer. Test a running Ember through the remote-debugging port; synthetic
  keyboard and mouse steal the developer's focus and are unreliable. `sync.bat`
  is a safe fast-forward-only pull for humans.

### 2026-08-24 — Claude Code — Bug pass 2: B1, B2/B13/B15, B17, B19, B10

- **Status / Branch:** pushed · `main`
- **Touches:** `src/main/{key-release,switcher-panel,floating-panel,tabs,index}.js`,
  `src/native/ember-key-watch.cs`, `src/renderer/{theme,glass,chrome}.css`,
  `src/renderer/chrome.js`, `src/renderer/pages/{newtab,switcher,conversion,upload,context-menu,snap}.*`,
  `test/key-release.test.js`, `BUGS.md`
- **Summary:** The switcher chord now ends when the OS says the modifier is up,
  because nothing inside Ember hears it. Overlay glass went back to being glass
  — blur, not opacity. The new tab search commits to a quick search on space.
  The tab strip eases instead of jumping and no longer drags itself back to the
  active tab on every state emit.
- **For the other agent:** `key-release.js` is the way to end a held chord; do
  not add another key-up listener. `tabs.select()` now focuses the selected
  page — if you need it not to, make it an option rather than removing it.
  B5 could not be reproduced; the paths already ruled out are listed in
  `BUGS.md` so they need not be retried.

### 2026-08-24 — Claude Code — Snap layouts picker

- **Status / Branch:** pushed · `main`
- **Touches:** `src/shared/snap-layouts.js`, `src/main/snap-picker.js`,
  `src/renderer/pages/snap.{html,css,js}`, `src/main/index.js` (drag handlers),
  `src/renderer/chrome.js` (double-click caption), `test/snap-layouts.test.js`
- **Summary:** Dragging to the top of a display now offers the arrangements
  rather than only maximising: a screen-anchored picker appears where Windows
  puts its own flyout, the zone under the cursor lights up, and dropping snaps
  the window to it. Double-clicking the caption toggles maximised.
- **For the other agent:** I found your in-progress `restoreUnderCursor` work
  in this shared tree and left it exactly as it was — I did not write a second
  un-maximise path. My drag changes are confined to the picker calls inside
  `WIN_DRAG_MOVE`/`WIN_DRAG_END` and sit *after* your `escaping` guard, which
  they deliberately respect: the picker does not open while a window is still
  escaping the edge it was pulled off. I could not confirm your pull-down under
  synthetic input — `ShowWindow(SW_MAXIMIZE)` does not register with Electron,
  so it has to be driven through Ember's own maximise button.

### 2026-08-24 — Claude Code — Bug pass: B1–B17

- **Status / Branch:** pushed · `main`
- **Touches:** `BUGS.md`, `src/main/{index,tabs,native-backdrop,floating-panel,switcher-panel,upload-panel}.js`,
  `src/shared/{chrome-layout,ipc}.js`, `src/renderer/{chrome.*,preload.js,brand.js,glass.css,theme.css}`,
  `src/renderer/pages/{switcher,conversion,upload,context-menu,liquid-glass-ui}.*`,
  `scripts/capture-ui.js`, `test/*`
- **Summary:** First half of the bug tracker. The window stopped being
  transparent, which is what was costing it Windows' corners, Snap and its
  minimise animation; Electron's default menu stopped stealing Ctrl+W; the
  Ctrl+Tab switcher commits on Ctrl release again; the tab strip scrolls and
  animates; and every overlay is frosted enough to read.
- **For the other agent:** the window options, the drag-snap path, the
  `focus: false` overlay contract, the `clip-path` rule for backdrop-filtered
  surfaces and the shared frost tokens are all recorded in §0. `capture-ui.js`
  gained `conversion-{dark,light}.png`. B18–B33 are still open and unclaimed.

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
