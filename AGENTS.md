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

## 1. Who owns what

| Person | Agent | Area |
| --- | --- | --- |
| duvvy8 | Claude Code | `src/main` — windows, tabs, sessions, adblock, proxy, storage, native modules |
| co-owner | Codex | `src/renderer` — chrome UI, settings pages, internal pages |

| Path | Owner | Rule |
| --- | --- | --- |
| `src/main/**` | Claude Code | other agent edits only with a Work Log entry |
| `src/renderer/**` | Codex | other agent edits only with a Work Log entry |
| `src/shared/**` | both | IPC names + schemas. Reviewed PR only, never unreviewed |
| `AGENTS.md`, `CLAUDE.md` | both | Work Log is append-at-top; rule changes need both humans |
| `package.json`, lockfile | both | adding a dep is fine; removing/bumping someone else's is not |

The `src/main` / `src/renderer` split does not exist yet — code is flat in the
root. Whoever does the split must announce it in the Work Log first; it moves
every file and will conflict with everything in flight.

---

## 2. Coordination protocol

### Before starting

1. `git fetch origin && git status`.
2. Read the Work Log (§4). It says what the other agent is doing *right now*.
3. If an `in-progress` entry touches your files: stop, tell your human. Do not
   "just fix it too."
4. Add your own Work Log entry **before** writing code; commit it first.

### Before pushing — always integrate their work first

```bash
git fetch origin
git rebase origin/main
npm start          # smoke: window boots, no console errors
git push
```

Never push a branch that has not been rebased onto current `origin/main`.

Conflict rules:
- In **their** area → keep **their** side.
- In **shared** files (`src/shared`, `package.json`, `AGENTS.md`) → keep
  **both**, merge by hand, never resolve by deleting their lines.
- In **your** area → resolve normally.

Then read `git diff origin/main` and confirm every hunk is intentional. If the
rebase dropped something they added, restore it before pushing.

### Never

Force-push `main` · commit directly to `main` · revert/rewrite/"clean up" the
other agent's commits · edit outside your area without a Work Log entry · end a
session with a dirty tree without saying so.

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
One PR per Work Log entry, kept inside your own area where possible. Gates
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
- **Status / Branch / Area:** in-progress · `feat/tab-manager` · src/main
- **Touches:** `src/main/tabs.ts`, `src/shared/ipc.ts`
- **Summary:** one or two sentences: what and why.
- **For the other agent:** new IPC channels, renamed files, contracts they must
  implement against. `none` if none.
```

### 2026-08-21 — Claude Code — Add AGENTS.md
- **Status / Branch / Area:** merged · `chore/agents-md` · repo root
- **Touches:** `AGENTS.md`, `CLAUDE.md`
- **Summary:** Shared agent instruction set — orientation cache, ownership map,
  coordination protocol, rules, Work Log. `CLAUDE.md` points here so both agents
  read one source of truth.
- **For the other agent:** read §0 instead of exploring the repo; add a Work Log
  entry before you start and rebase onto `origin/main` before every push.
