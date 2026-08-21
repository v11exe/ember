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

**Stack:** Electron `^43.4.1`, CommonJS JS (TypeScript still planned, not
started). No build step. `npm start` runs it, `npm run smoke` boots it headless
and exits non-zero on failure — that is the pre-push gate.

**File map** (complete):

```
src/main/index.js        app bootstrap, BaseWindow, IPC handlers, lifecycle
src/main/tabs.js         TabManager — create/close/select/layout, CHROME_HEIGHT=84
src/main/extensions.js   Chrome Web Store install + chrome.* APIs + "Add to Ember"
src/main/protocol.js     ember:// scheme, serves src/renderer/pages flat
src/main/page-preload.js sandboxed preload; ember:// pages only, nav verbs only
src/renderer/preload.js  chrome UI bridge (contextBridge "ember"), browser-action
src/renderer/chrome.*    tab strip + toolbar (html/css/js)
src/renderer/theme.css   the palette — every colour is defined here, once
src/renderer/pages/      internal pages, flat dir: newtab.html/.css/.js
src/shared/ipc.js        channel names, SEARCH_URL, NEW_TAB_URL
src/shared/urls.js       toNavigationUrl() — URL vs Google search
scripts/smoke.js         boot check
```

**Milestones** — 1 shell ✅ · 2 tab manager ✅ · 3 chrome UI + IPC ✅ ·
8 extensions ✅ (built early, out of order) · 4 sessions and partitions ·
5 adblock + per-site Shields · 6 history/bookmarks/downloads · 7 GX layer
(theming partly done via `theme.css`; network limiter, tab discarding, tab
islands, sidebar outstanding).

**Not yet set up** (don't go looking): TS config, linter, unit tests, CI,
CODEOWNERS, branch protection, `electron-updater`, tab reordering/drag,
history/bookmarks persistence, private windows, settings page.

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

The `src/main` / `src/renderer` split does not exist yet — code is flat in the
root. Whoever does it must announce it in the Work Log first; it moves every
file and will conflict with everything in flight.

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

### 2026-08-21 — Claude Code — Browser shell: chrome UI, theme, CWS extensions
- **Status / Branch:** merged · `main`
- **Touches:** `src/main/*`, `src/renderer/*`, `src/shared/*`, `scripts/smoke.js`,
  `package.json`, `README.md`, `AGENTS.md`; deleted root `main.js`
- **Summary:** Milestones 2, 3 and 8. Tab manager, frameless chrome UI (tab strip,
  omnibox, window controls), ember:// internal pages, Ember-themed new tab page
  with Google search, and Chrome Web Store installs rebranded to "Add to Ember".
- **For the other agent:** the flat root layout is gone — code now lives in
  `src/main`, `src/renderer`, `src/shared`, and `package.json` main points at
  `src/main/index.js`. Rebase before you touch anything. All colours come from
  `src/renderer/theme.css`; don't hardcode hex values elsewhere. Channel names
  are in `src/shared/ipc.js` — the sandboxed `page-preload.js` inlines three of
  them by necessity and says so.

### 2026-08-21 — Claude Code — Add AGENTS.md
- **Status / Branch:** merged · `main`
- **Touches:** `AGENTS.md`, `CLAUDE.md`
- **Summary:** Shared instruction set for both agents — orientation cache (§0),
  sync protocol (§2), rules, this log. No per-directory ownership: either agent
  may touch any file, and the humans decide who works on what.
- **For the other agent:** read §0 instead of exploring the repo, add an entry
  here before you start, and run the §2 sequence on every push.
