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

**Stack:** Electron `^43.4.1`, CommonJS JS today, TypeScript planned (not yet
migrated). No build step yet. `npm start` → `electron .`.

**File map** (complete — the repo really is this small):

```
package.json    electron dep, "start": "electron ."
main.js         BaseWindow + one WebContentsView, hardcoded URL. Whole app.
README.md       one-line project description
.gitignore      node_modules
AGENTS.md       this file
CLAUDE.md       one line: @AGENTS.md
```

**Milestones** — 1 shell ✅ · 2 tab manager · 3 chrome UI + IPC · 4 sessions and
partitions · 5 adblock + per-site Shields · 6 history/bookmarks/downloads ·
7 GX layer (theming, network limiter, tab discarding, tab islands, sidebar) ·
8 extensions (last, partial MV3).

**Not yet set up** (don't go looking): TS config, linter, tests, CI, CODEOWNERS,
branch protection, `src/main`/`src/renderer` split, `src/shared` IPC package,
`electron-updater`.

**Decided, don't relitigate:** `WebContentsView` not `BrowserView` · adblock via
`@ghostery/adblocker-electron` · Shields keyed by eTLD+1, enforced in
`webRequest.onBeforeRequest` before the blocker · internal pages on a custom
`app://` scheme via `protocol.handle` · `better-sqlite3` + `safeStorage` + JSON
settings · no Widevine, so DRM video will not play · extensions are
unpacked-only · fingerprint randomization ships off by default.

---

## 1. Shared codebase — nobody owns a directory

Either agent may touch any file. There are no fenced-off areas, because fences
don't stop clobbering — they just make it a surprise when it happens. The rule
that actually protects the work is §2: **every push must contain the other
agent's changes as well as your own.**

Soft convention, not a fence: Claude Code tends to work the main process
(windows, tabs, sessions, adblock, storage), Codex tends to work the renderer
(chrome UI, settings, internal pages). Following it reduces collisions. Crossing
it is fine — just say so in your Work Log entry.

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

### 2026-08-21 — Claude Code — Add AGENTS.md
- **Status / Branch:** merged · `chore/agents-md`
- **Touches:** `AGENTS.md`, `CLAUDE.md`
- **Summary:** Shared agent instruction set — orientation cache, ownership map,
  coordination protocol, rules, Work Log. `CLAUDE.md` points here so both agents
  read one source of truth.
- **For the other agent:** read §0 instead of exploring the repo; add a Work Log
  entry before you start and rebase onto `origin/main` before every push.

### 2026-08-21 — Claude Code — Replace ownership model with push-time sync
- **Status / Branch:** merged · `main`
- **Touches:** `AGENTS.md`
- **Summary:** Dropped per-directory ownership; either agent may touch any file.
  Protection now comes from §2: check what landed since your last sync, keep
  both sides on conflict, verify nothing was dropped before pushing.
- **For the other agent:** you're no longer restricted to the renderer. In
  exchange, run the §2 sequence on every push and list every file you touch in
  your Work Log entry.
