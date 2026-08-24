@echo off
rem ---------------------------------------------------------------------------
rem  Ember — safe sync with origin/main.
rem
rem  Pulls only when that cannot lose anything:
rem    up to date  -> nothing to do
rem    behind      -> fast-forward to origin/main
rem    ahead       -> refuse, you have commits GitHub does not
rem    diverged    -> refuse, both sides moved
rem    dirty       -> refuse, uncommitted work would be at risk
rem
rem  It never merges, rebases, resets or force-pulls, so it cannot overwrite
rem  local work. When it refuses, it says what to do instead.
rem ---------------------------------------------------------------------------
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo   Ember sync
echo   ----------

git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
  echo   [ERROR] This folder is not a git repository.
  goto :fail
)

for /f "delims=" %%B in ('git rev-parse --abbrev-ref HEAD') do set "BRANCH=%%B"
if not "!BRANCH!"=="main" (
  echo   [ERROR] You are on branch "!BRANCH!", not main.
  echo           Switch with:  git switch main
  goto :fail
)

rem --- uncommitted work is exactly what must not be put at risk ---------------
for /f "delims=" %%S in ('git status --porcelain') do set "DIRTY=1"
if defined DIRTY (
  echo   [ERROR] You have uncommitted changes. Nothing was synced.
  echo           Commit them, or stash with:  git stash
  echo.
  git status --short
  goto :fail
)

echo   Fetching origin/main...
git fetch --quiet origin main
if errorlevel 1 (
  echo   [ERROR] Could not reach GitHub.
  goto :fail
)

for /f "delims=" %%L in ('git rev-parse HEAD') do set "LOCAL=%%L"
for /f "delims=" %%R in ('git rev-parse origin/main') do set "REMOTE=%%R"
for /f "delims=" %%M in ('git merge-base HEAD origin/main') do set "BASE=%%M"

if "!LOCAL!"=="!REMOTE!" (
  echo   Already up to date with origin/main.
  goto :done
)

if "!LOCAL!"=="!BASE!" (
  rem Local is a strict ancestor of the remote: fast-forward is always safe.
  for /f "delims=" %%N in ('git rev-list --count HEAD..origin/main') do set "COUNT=%%N"
  echo   Behind by !COUNT! commit^(s^). Fast-forwarding...
  echo.
  git --no-pager log --oneline HEAD..origin/main
  echo.
  git merge --ff-only origin/main
  if errorlevel 1 (
    echo   [ERROR] Fast-forward failed. Nothing was changed.
    goto :fail
  )
  echo   Synced to origin/main.
  goto :done
)

if "!REMOTE!"=="!BASE!" (
  for /f "delims=" %%N in ('git rev-list --count origin/main..HEAD') do set "COUNT=%%N"
  echo   [ERROR] You are AHEAD of origin/main by !COUNT! commit^(s^).
  echo           Nothing was synced, so your work is untouched.
  echo.
  git --no-pager log --oneline origin/main..HEAD
  echo.
  echo           Push them when you are ready:  git push origin main
  goto :fail
)

rem Neither side is an ancestor of the other.
for /f "delims=" %%A in ('git rev-list --count origin/main..HEAD') do set "MINE=%%A"
for /f "delims=" %%B in ('git rev-list --count HEAD..origin/main') do set "THEIRS=%%B"
echo   [ERROR] Branches have DIVERGED: !MINE! commit^(s^) here, !THEIRS! on GitHub.
echo           Nothing was synced, so your work is untouched.
echo.
echo           Yours:
git --no-pager log --oneline origin/main..HEAD
echo.
echo           Theirs:
git --no-pager log --oneline HEAD..origin/main
echo.
echo           Reconcile with:  git rebase origin/main
goto :fail

:done
echo.
pause
exit /b 0

:fail
echo.
pause
exit /b 1
