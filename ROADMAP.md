# Ember Roadmap

This is the numbered source of truth for Ember feature work. Feature numbers are stable references for coding agents.

**Status:** ✅ Completed · ⬜ Planned

## Global UI rule

The **sidebar is reserved for actual browser features and utilities, not tabs**. Do not turn it into Arc/Zen-style vertical tab storage.

Good sidebar candidates:

- Instant/Favorite site buttons
- Global tab search
- Media controls
- Recent files / Library
- Downloads/history/bookmarks controls where useful
- Workspace/profile controls
- Other browser utilities

Tab-specific features should modify Ember's actual tab UI rather than adding another permanent tab list to the sidebar.

---

# Highest priority — features explicitly singled out

## 1. Aggressive automatic tab hibernation / offloading

**Source:** Edge / Vivaldi / extensions  
**Priority:** BIG MUST

**Status:** ✅ Completed

Inactive tabs should be genuinely unloaded from memory rather than merely visually marked as sleeping.

Behavior:

- After a configurable inactivity period, destroy/offload the tab renderer.
- Keep only enough serialized browser state to reconstruct it.
- Clicking the tab recreates it and restores the URL and whatever recoverable navigation state Ember can preserve.
- Sleeping tabs should consume essentially no renderer resources.
- Indicate sleeping state subtly in the tab UI.

Never automatically hibernate:

- Active tab
- Visible Split View tabs
- Floating tabs
- Follower tabs currently being used
- Tabs playing audio/video
- Tabs using camera/microphone
- Downloads in progress
- Tabs with an obvious unsaved-form risk
- Explicitly protected/locked tabs

Allow:

- `Sleep tab now`
- `Never sleep this tab`
- `Never sleep this domain`
- Configurable timeout

This should work together with saved sessions so Ember can be extremely aggressive about not keeping unnecessary Chromium renderers alive.

### Completion / compatibility guardrails

Implemented on `main` with true renderer destruction, state restoration, cached thumbnails, configurable timeout, per-tab/per-domain opt-outs, and safety blockers for active/media/capture/download/dirty-form cases.

Keep these guarantees when later roadmap features land:

- Future Split View (#9), Follower Tabs (#10), and floating webpages (#11) must mark any currently visible/actively used tab as non-discardable.
- Workspaces (#12), named sessions (#15), universal tab search (#14), and hibernation integration (#17) must treat a sleeping tab as a valid tab record whose renderer is simply absent.
- Ctrl+Tab (#5) and hover previews (#27) must use the cached thumbnail without waking the tab merely to draw a preview.
- Protected tabs (#29), PiP/media (#18–20), and future unsaved-state detection must remain hard sleep blockers where appropriate.

---

## 2. Bangs / custom Quick Searches

**Source:** Orion / Kagi / DuckDuckGo-style bangs  
**Priority:** BIG ONE

**Status:** ✅ Completed

The omnibox should support extremely fast site-specific searches.

Examples:

```text
yt liquid glass
gh electron transparency
wiki chromium
r ember browser
maps london
```

Optionally also support:

```text
!yt liquid glass
!gh electron transparency
```

Each keyword maps to a URL containing a search placeholder.

Example:

```text
yt -> https://www.youtube.com/results?search_query=%s
gh -> https://github.com/search?q=%s
```

Requirements:

- Built-in useful defaults.
- Completely user-configurable.
- Add/delete/rename aliases.
- Multiple aliases may point to the same engine.
- Can target any URL using `%s`.
- Omnibox should immediately recognise the alias before performing the normal default search.
- Alias matching should be effectively instantaneous.
- Normal URLs must never be mistaken for aliases.

Also allow searches without a search term where appropriate:

```text
gh
```

could simply open GitHub.

This should become a core part of Ember's omnibox rather than a separate feature panel.

### Completion / compatibility guardrails

Implemented on `main` as a core omnibox path with built-in defaults, editable aliases, `%s` templates, bare aliases and `!` aliases.

The omnibox recognises the alias visibly, not just internally: typing `yt liquid glass`
raises a chip naming the engine before Enter, and `Tab` on a bare keyword commits the
omnibox to that search, drops the keyword and leaves only the query. `Backspace` on an
empty query steps back out, `Escape` leaves the engine. The new-tab search field shows
the same chip. `ember://settings` lists every shortcut, built-in ones included, editable
in place, with a restore that undoes changes to Ember's own list while keeping the
reader's own additions.

Preserve these rules:

- Alias resolution must happen before the normal default search.
- URL-like input must never be mistaken for an alias; dots, slashes, colons and spaces remain disallowed inside aliases.
- Explicit `!alias` may outrank an internal-page keyword, while a bare keyword must not unexpectedly steal an Ember internal command.
- A reachable host outranks an alias named after it: `localhost` and `localhost:3000` reach the dev server even when a bang is named `localhost`.
- `resolveInput()` in `shared/urls.js` is the only place that decides what omnibox text means. Preview and navigation must keep calling it, so a chip can never promise something Enter will not do. New input kinds belong there, not in a renderer.
- Matching must stay effectively instantaneous. The chrome preload holds the list and resolves synchronously; sandboxed `ember://` pages ask main over `omnibox:resolve` and must ignore out-of-order answers.
- Future workspace/profile work (#12–13) must not silently change alias semantics; any per-profile/per-workspace scoping must be explicit.
- Future omnibox work — #14 universal tab search, #25 duplicate detection ("Already open") — shares this input path. Add kinds to `resolveInput()` and decide precedence against `bang` explicitly rather than intercepting keystrokes upstream of it.
- #21/#22 compact and edge-hover chrome must keep the chip visible whenever the omnibox itself is visible; it is part of the field, not a separate surface.

---

## 3. Smart selection conversions

**Source:** Opera  
**Priority:** BIG/HUGE GOOD FEATURE

**Status:** ✅ Completed

When text on a webpage is selected, Ember should recognise useful values automatically.

Examples:

- `$79.99` → GBP
- `€120` → GBP
- `15 miles` → kilometres
- `32°F` → Celsius
- `5 ft 11` → centimetres
- `4:30 PM PST` → local time
- `August 24 at 8 PM EST` → local date/time
- `10 lb` → kilograms
- `250 ml` → litres/fl oz where useful

The result should appear in a **small Ember liquid-glass popup using the same visual language as the custom right-click menu**.

Keep it extremely compact.

Example:

```text
$79.99
≈ £59.34

Copy
```

For time conversions:

```text
4:30 PM PDT
00:30 BST
Sunday, 23 August
```

The popup should disappear naturally when the selection is cleared.

No giant conversion sidebar or separate page.

Settings should define preferred:

- Currency
- Temperature unit
- Distance
- Weight
- Volume
- Time zone
- 12/24-hour clock

### Completion / compatibility guardrails

Implemented on `main` with compact selection popups, user unit preferences, local unit/time arithmetic, and lazy cached exchange-rate lookup for currencies.

Preserve these rules:

- Selected text stays local except when a currency conversion actually requires a rate lookup.
- Translation (#33) should share the same selection-popup family/orchestration rather than spawning a competing overlay on top of conversions.
- Future page annotation (#37), Peek (#6), floating pages (#11), and Split View (#9) must route selection geometry to the correct focused page/pane.
- Conversion settings remain user preferences, not hard-coded UK assumptions.

---

## 4. Internet Archive fallback

**Source:** Orion  
**Priority:** BIG GOOD FEATURE

**Status:** ✅ Completed

When a page cannot be accessed, Ember should intelligently expose an archived version.

Trigger on:

- HTTP 404
- HTTP 410
- DNS failure
- Connection failure
- Dead domain where appropriate

Error page:

```text
This page couldn't be reached

Retry
View archived version
```

`View archived version` should attempt to find the URL through the Internet Archive / Wayback Machine.

Also add:

```text
Right click page → View archived version
```

and possibly an omnibox/site-controls action.

Do not redirect automatically. The current dead page should remain the default until the user chooses the archived copy.

### Completion / compatibility guardrails

Implemented on `main` with Ember's unreachable-page flow, 404/410 handling, a click-only Wayback lookup and a context/toolbar archive action.

Preserve these rules:

- Never auto-redirect to an archive.
- Never send ordinary browsing URLs to the Internet Archive in the background; lookup remains user-triggered.
- Future workspace routing (#16), profiles (#13), site controls (#32), and Peek (#6) must not bypass the failed-page/archive state or open the archive in the wrong browsing context.

---

## 5. Arc-style Ctrl+Tab visual tab switcher

**Source:** Arc / Windows Alt+Tab concept  
**Priority:** HIGH

**Status:** ✅ Completed

`Ctrl+Tab` should behave much more like Windows `Alt+Tab` than Chromium's normal blind tab cycling.

Press:

```text
Ctrl+Tab
```

and immediately show a floating visual switcher containing the most relevant open tabs.

Each entry should show:

- Live or recently cached tab thumbnail
- Page title
- Domain
- Favicon
- Enough visual information to recognise the page without reading the title

Interaction:

1. Press and hold `Ctrl`.
2. Press `Tab` to open the switcher and select the next tab.
3. Continue pressing `Tab` while holding `Ctrl` to cycle forward.
4. `Shift+Tab` while holding `Ctrl` cycles backward.
5. Release `Ctrl` to activate the selected tab.
6. `Esc` cancels and stays on the current tab.

Ordering should primarily use **most recently used order**, not physical tab-strip order.

Example:

```text
Current tab
    ↓
previously used tab
    ↓
tab used before that
    ↓
...
```

This makes repeatedly pressing `Ctrl+Tab` useful for rapidly bouncing between the same two or three pages.

Integration requirements:

- Sleeping/hibernated tabs remain eligible.
- Hibernated tabs use their last cached screenshot rather than waking merely to populate the switcher.
- Selecting a sleeping tab wakes it normally.
- Custom tab names should appear when present.
- Protected tabs behave normally.
- Workspaces should be respected.
- It should be possible for the switcher to search across other workspaces later if explicitly configured, but the default should favour the current workspace.
- Split panes should be represented intelligently rather than generating confusing duplicate entries.
- Floating tabs should also be switchable where appropriate.

The UI itself should be compact, fast and transient. It should feel like a native browser equivalent of `Alt+Tab`, not like opening a tab-management page.

### Completion / compatibility guardrails

Implemented on `main` as a most-recently-used visual switcher with cached thumbnails, `Shift+Tab` reverse cycling, release-to-commit and Escape-to-cancel.

Preserve these rules:

- Sleeping tabs stay eligible and use cached thumbnails without being woken just to populate the switcher.
- Future custom tab names (#28) should be the displayed title when present.
- Workspaces (#12), Split View (#9), Follower Tabs (#10), and floating webpages (#11) must define how their entries appear without creating confusing duplicates.
- The switcher remains transient and MRU-based; physical strip order is not its primary order.

---

## 6. Arc-style Link Peek

**Source:** Arc  
**Priority:** HIGH — not yet implemented

**Status:** ⬜ Planned

Allow links to be temporarily previewed without committing them to a permanent tab.

A Peek should appear as a lightweight webpage overlay above the original page while keeping the originating page visible underneath.

Typical flow:

1. Open a search/results/index page.
2. Trigger Peek on a link.
3. The destination loads in an overlay.
4. Read or interact with it.
5. Close it to immediately return to the original page.
6. Promote it into a normal tab if it turns out to be worth keeping.

The underlying page must remain exactly where it was:

- Same scroll position
- Same form state
- Same selected content
- Same navigation state

Peek controls should remain minimal:

- Close
- Open as full tab
- Copy URL where useful
- Possibly Back/Forward if navigation occurred inside the Peek

Peek should support normal webpage interaction rather than being a static preview.

Opening a Peek should not:

- Permanently clutter the tab UI
- Replace the original page
- Create an unnecessary normal tab immediately

If the page attempts to open another page while inside Peek, Ember should handle this consistently rather than allowing uncontrolled popup/tab creation.

This should work especially well for:

- Search results
- Reddit
- GitHub
- Documentation
- News/articles
- Shopping
- Reference links

It should visually fit Ember's existing glass UI but remain primarily a webpage surface rather than covering the content with excessive custom chrome.

---

## 7. Arc-style Instant / Favorite sidebar buttons

**Source:** Arc Favorites  
**Priority:** HIGH

**Status:** ✅ Completed

The Ember sidebar is reserved for actual features and utilities rather than becoming a vertical tab strip. Compact favorite-site buttons fit that design.

Allow the user to pin a small set of frequently used sites as persistent icons.

Examples:

```text
Gmail
YouTube
Calendar
GitHub
ChatGPT
Spotify
```

Each Favorite should:

- Use the site's favicon by default.
- Allow a custom icon later.
- Open its assigned site immediately.
- Reuse the appropriate existing Favorite tab where possible rather than constantly creating duplicates.
- Remain visually distinct from ordinary tabs.
- Stay accessible regardless of the currently active workspace if configured as global.
- Optionally be workspace-specific.
- Preserve the site's session state where practical.
- Integrate with hibernation so an unused Favorite does not need to consume a renderer permanently.

Most importantly, the buttons should **automatically adapt to sidebar size**.

When the sidebar becomes narrower:

- Icons reflow/rescale appropriately.
- Spacing reduces naturally.
- They remain usable.
- No ugly clipping or horizontal scrollbar appears.

When expanded:

- Ember may expose labels/tooltips or additional state without fundamentally changing the button.

Potential live states can later include:

- Unread Gmail count
- Calendar event indicator
- Playing-media state
- GitHub notification badge

but those should remain subtle.

Favorites should feel like persistent shortcuts to important browser applications rather than permanent tab entries.

### Completion / compatibility guardrails

Implemented with Ember's Arc-calibrated 32px shell, a collapsible 168px feature rail,
ordered persistent Favorites, settings-based add/edit/reorder/remove/reset, and
existing-tab reuse that also wakes hibernated Favorite tabs without making them
permanent renderer consumers.

Preserve these rules:

- Favorites are feature shortcuts, never a second tab strip. Their selected
  appearance derives from the active tab's site while the real tab remains in
  Ember's horizontal tab system.
- Shell and page geometry come from `shared/chrome-layout.js`. Top chrome,
  Favorite rail and 8px perimeter gradients are separate bounded views; none
  sits beneath the transparent page. Four anti-aliased 12px radial overlays clip
  page corners reliably on Windows, where native View radius clipping is not
  effective for WebContents pixels.
- Collapse keeps an 8px Ember rail and interpolates sidebar, page and frame
  bounds together for 210ms. Blank top-row dragging uses a pointer-captured IPC
  bridge because CSS caption regions on child WebContentsViews expose only a
  narrow strip through BaseWindow on Windows.
- Sidebar open/closed state and Favorite order are user preferences. A Favorite
  resolves by stored tab id first, then same-site reuse, then creation, so a
  sleeping match wakes through normal `tabs.select()` lifecycle behavior.
- Future Workspaces (#12) may add explicit workspace-scoped Favorites, but the
  current list remains global until a real scope model exists. Profiles (#13)
  must resolve Favorite reuse inside the correct browsing session.
- Split View (#9), Follower Tabs (#10), floating pages (#11), compact chrome
  (#21), edge-hover chrome (#22), tab search (#14), and recent files (#31) must
  consume the shared shell geometry instead of maintaining competing insets or
  placing ordinary tabs in the sidebar.

---

## 8. Arc-style Copy Link button

**Source:** Arc  
**Priority:** HIGH — not yet implemented

**Status:** ⬜ Planned

Add a dedicated compact Copy Link button directly around Ember's address/URL area.

The purpose is to eliminate the normal sequence:

```text
Click omnibox
Ctrl+A
Ctrl+C
```

or:

```text
Right click
Copy URL
```

A single click should copy the active page's canonical/current URL.

Behavior:

1. Click the small link icon.
2. Ember writes the current page URL to the clipboard.
3. The button gives immediate visual confirmation.
4. It returns to its normal state automatically.

For example:

```text
[link icon]
```

briefly becomes:

```text
[check]
```

or shows the existing small Ember-style tooltip:

```text
Copy Link (Ctrl+Shift+C)
```

followed by:

```text
Copied
```

Requirements:

- One-click operation.
- No need to focus the omnibox.
- No text selection.
- No disruptive toast in the middle of the webpage.
- Works on normal HTTP/HTTPS pages.
- Handles special/internal pages sensibly.
- Copies the actual current URL after navigation.
- Uses the active split pane when Split View is active.
- Uses the source currently considered active when a floating page or Peek is focused.

A keyboard shortcut such as:

```text
Ctrl+Shift+C
```

can invoke the same browser-level action when it does not conflict with an important existing command.

The button should remain extremely small because this is intended as a constant one-click QOL action, not a major browser feature.

---

# Core browsing experience

## 9. Arc-style Split View

**Status:** ⬜ Planned

**Current main-branch verification:** no Split View implementation is present yet; treat this feature as upcoming until it is implemented and tested.

Small Split View button in the top-right browser chrome.

Opening it exposes the compact Ember/Windows-style menu:

- Add Right Split
- Add Left Split
- Add Top Split
- Add Bottom Split

Creating a split should allow:

- Entering a URL
- Performing a search
- Selecting an already-open tab

Every pane gets minimal controls:

- Close pane
- Change split orientation/position
- Swap panes
- Resize using draggable separators

The controls should stay visually unobtrusive until hovered.

---

## 10. Follower Tab

**Source:** Vivaldi, heavily modified for Ember

**Status:** ⬜ Planned

Right-click a normal tab:

```text
Open Follower Tab
```

This creates a follower associated with that source tab.

Normal usage:

1. Main tab contains a list/search/results page.
2. Clicking links sends their destination into the follower.
3. The original page remains untouched.
4. Clicking another result replaces the follower's page.

Follower-specific rules:

- `Ctrl+W` while focused on the follower **must not close the follower**.
- Links inside the follower that attempt to open a new tab/window should instead load into the existing follower.
- `target="_blank"`, `window.open()`, middle-click behaviour where appropriate, etc. should be intercepted.
- The follower therefore acts like a reusable destination viewport rather than producing tab spam.
- Give it an explicit close control when the user actually wants to destroy it.
- Visually show which primary tab it follows.
- Closing the source tab can either detach or explicitly close its follower according to Ember's chosen behaviour.

This is particularly useful for:

- Google
- GitHub issues
- Reddit
- Documentation
- YouTube results
- Shopping/search pages

---

## 11. In-window floating web tabs

**Status:** ⬜ Planned

**Merged version of features 34 + 60**

Do **not** create a separate operating-system/browser popup window.

Instead, convert an existing Ember tab into a movable floating webpage **inside the existing Ember window**.

Example:

```text
Right click tab → Float Tab
```

The webpage becomes an overlay containing the real live page.

Capabilities:

- Drag anywhere inside Ember.
- Resize freely.
- Minimise/collapse.
- Snap to corners.
- Restore to normal tab.
- Keep above the main webpage.
- Optional transparency.
- Optional click-through mode if useful.
- Retains its page state while moving between normal/floating modes.
- Does not create another Windows taskbar entry.
- Does not require managing another `BrowserWindow`.
- Does not escape outside the Ember window.

Use cases:

- Calculator
- ChatGPT
- Documentation
- Music player
- Video
- Reference material
- Small live dashboards

Essentially Picture-in-Picture, but for **any webpage**.

---

## 12. Workspaces / Spaces

**Source:** Arc / Zen / Opera / Vivaldi

**Status:** ⬜ Planned

Create separate browsing contexts such as:

```text
Personal
School
Development
Research
```

Each workspace maintains its own:

- Open tabs
- Tab groups
- Splits
- Follower relationships
- Saved layout

Workspace controls can live in the sidebar because **the workspace selector itself is a feature**, but its tabs should not permanently live there.

The completed global Favorite rail (#7) must remain available across workspaces
unless the user explicitly chooses a future workspace-specific Favorite scope.
Favorite tab reuse must stay inside the workspace/profile browsing context that
owns the page.

Switching workspace should be instantaneous.

---

## 13. Profiles attached to Workspaces

**Source:** Arc / Safari

**Status:** ⬜ Planned

Allow a workspace to optionally use its own browsing identity.

Separate:

- Cookies
- Logins
- Local storage
- Site permissions
- History where appropriate
- Session state

Example:

```text
Personal Workspace → Personal Google account
School Workspace → School Google account
Development Workspace → Development accounts
```

Workspaces and Profiles should remain separate concepts so multiple workspaces can optionally share one profile.

---

## 14. Universal tab search from the sidebar

**Source:** Vivaldi / Workona concept

**Status:** ⬜ Planned

Add a sidebar utility button that opens a search panel.

It searches:

- Currently open tabs
- Other windows
- Other workspaces
- Sleeping tabs
- Recently closed tabs
- Saved sessions

Typing:

```text
github ember
```

should immediately show matching pages.

Selecting an existing tab switches to it instead of opening another duplicate.

Important: this is **a sidebar search tool**, not a permanent sidebar tab list.

---

## 15. Named fully-offloaded Sessions

**Source:** Session Buddy / Tab Session Manager, made more aggressive

**Status:** ⬜ Planned

Allow:

```text
Save Session
```

Example:

```text
Ember Development
Physics Research
Shopping
```

A saved session should preserve every piece of **browser-controlled state Ember can safely serialize**, including:

- Tabs
- URLs
- Tab ordering
- Groups/hierarchy
- Workspaces
- Split layouts
- Follower relationships
- Floating tabs
- Custom tab names
- Protected state
- Active tab
- Window arrangement where relevant

Then **offload everything belonging exclusively to that session**.

Meaning:

- Destroy its renderers.
- Stop its webpages.
- Free their memory.
- Do not leave hidden Chromium tabs running behind the scenes.
- Keep only serialized session metadata.

Restoring the session recreates everything.

Arbitrary live JavaScript/application memory cannot always be perfectly serialized, so Ember should restore browser state rather than pretending a destroyed web process never stopped.

---

## 16. Automatic workspace routing / Air Traffic Control

**Source:** Arc

**Status:** ⬜ Planned

Rules such as:

```text
github.com/*      → Development
localhost:*       → Development
calendar.google   → Personal
physicsandmath... → School
```

When an external link or new navigation qualifies, Ember routes it into the correct workspace automatically.

Rules should support:

- Exact domains
- Subdomains
- URL patterns
- Default destination
- Ask-each-time option

---

## 17. Automatic tab hibernation awareness throughout Ember

**Status:** ⬜ Planned

Feature #1 should not behave as an isolated optimisation.

Every tab-related feature needs to understand sleeping tabs:

- Tab search finds them.
- Sessions can contain them.
- Workspaces preserve them.
- Duplicate detection still recognises them.
- Ctrl+Tab can show their last thumbnail.
- Hover previews can use cached thumbnails.
- Selecting one transparently wakes it.

The browser UI should treat a sleeping tab as a normal tab whose renderer simply does not currently exist.

---

## 18. Picture-in-Picture / persistent mini-player

**Source:** Arc / Firefox / Opera

**Status:** ⬜ Planned

When leaving a video tab, allow the video to continue in a compact floating player.

Controls:

- Play/pause
- Seek
- Mute
- Volume
- Return to source tab
- Close PiP

It should coexist cleanly with Ember's broader floating-webpage system but remain a specialised lightweight mode for video.

---

## 19. Full media controls in the sidebar

**Status:** ⬜ Planned

The sidebar gets a dedicated media control button/panel.

When media is active, show:

```text
[Artwork / favicon]

Video or track title

⏮   ▶/❚❚   ⏭

──────●────────
1:42       5:13

Volume
──────●───────
```

Core controls:

- Play
- Pause
- Seek bar / scrubber
- Current position
- Duration
- Volume slider
- Mute
- Source tab
- Jump to source
- PiP where supported

If several tabs are producing media, allow switching between them inside the panel.

The sidebar remains a **media controller**, not a tab list.

---

## 20. Per-tab sidebar audio indicator

**Status:** ⬜ Planned

Any tab producing sound receives a small speaker indicator in its normal tab UI.

Click:

- Mute
- Unmute

The sidebar media panel provides the expanded controls.

Do not require switching to the offending tab simply to stop its audio.

---

## 21. In-window Compact / Frameless Mode

**Source:** Zen / Orion / Helium

**Status:** ⬜ Planned

Temporarily remove almost all browser chrome so the webpage dominates the window.

Hide:

- Tab UI
- Omnibox
- Sidebar
- Navigation controls

The underlying interfaces still exist and can be temporarily revealed.

Useful for:

- Videos
- Reading
- Web apps
- Coding tools
- Remote desktops

---

## 22. Edge-hover UI reveal

**Source:** Zen

**Status:** ⬜ Planned

While Compact Mode is active:

Move pointer to top edge:  
→ reveal navigation/omnibox.

Move pointer to sidebar edge:  
→ reveal Ember feature sidebar.

Move away:  
→ hide again.

Use small delays/hysteresis so controls do not constantly appear from accidental pointer contact.

---

## 23. Adaptive browser chrome

**Source:** Helium

**Status:** ⬜ Planned

Allow Ember's chrome to adapt to what is actually happening.

Examples:

- One tab → dramatically simplify tab UI.
- Multiple tabs → reveal full controls.
- Fullscreen media → hide unnecessary chrome.
- Split view → expose split controls.
- Compact mode → edge-triggered UI only.

Keep this subtle rather than constantly rearranging the browser.

---

## 24. Tree relationships between tabs

**Source:** Orion / Sidebery / SigmaOS concept

**Status:** ⬜ Planned

Do not create a permanent sidebar tree.

Instead, Ember's actual tab system should know parent/child relationships.

Example:

```text
Google Search
 ├─ GitHub
 │   └─ Issue #72
 └─ Stack Overflow
```

Opening a page from another tab records where it originated.

Possible UI:

- Small indentation where suitable
- Expand/collapse groups
- Relationship indicator
- `Close child tabs`
- `Return to parent`

The underlying relationship is more important than making the UI look like a file tree.

---

## 25. Duplicate tab detection

**Status:** ⬜ Planned

Detect tabs pointing to the same or effectively equivalent URL.

Useful actions:

```text
Switch to existing tab
Close duplicate
Close all duplicates
```

The omnibox could also show:

```text
Already open
```

before creating another instance.

Must detect duplicates across:

- Current window
- Workspaces
- Sleeping tabs

while respecting separate profiles where duplicate pages may be intentional.

The "Already open" hint shares the omnibox input path completed in #2. Add it as a
kind returned by `resolveInput()` in `shared/urls.js` and decide its precedence
against `bang` explicitly, so the chip and the navigation keep coming from one
decision. Do not intercept omnibox keystrokes ahead of that resolver.

---

## 26. Tab Traces / recency indicators

**Source:** Opera

**Status:** ⬜ Planned

Recently used tabs receive a subtle visual trace.

The most recently visited tabs should be easiest to identify, with the visual indication fading with time.

Do not use large colours or badges.

Purpose:

- Quickly visually reconstruct your recent navigation path.
- Complement Ctrl+Tab rather than replace it.

---

## 27. Hover tab thumbnails

**Source:** Safari / Vivaldi

**Status:** ⬜ Planned

Hovering a normal tab briefly displays a cached/live preview.

Include:

- Page thumbnail
- Title
- Domain

Sleeping tabs should show their last cached thumbnail without waking.

Small hover delay prevents the interface becoming noisy.

---

## 28. Rename tabs

**Status:** ⬜ Planned

Double-click or context menu:

```text
Rename Tab
```

Example:

```text
Issues · v11exe/ember · GitHub
```

becomes:

```text
Ember Issues
```

The custom name remains until cleared.

The actual webpage title remains internally available and can still appear in tooltips/search metadata.

---

## 29. Protected / locked tabs

**Status:** ⬜ Planned

Context menu:

```text
Protect Tab
```

Protected tab:

- Cannot accidentally be closed with ordinary `Ctrl+W`.
- Cannot be removed by mass-close operations.
- Never auto-archives.
- Should normally be exempt from aggressive sleeping if explicitly configured that way.

Explicitly unlock/close it when wanted.

---

## 30. Mouse gestures — Back and Forward only

**Source:** Vivaldi / Gesturefy

**Status:** ⬜ Planned

Keep this intentionally tiny.

Hold right mouse button and make a short gesture:

```text
← = Back
→ = Forward
```

No enormous configurable gesture system is necessary.

There should be enough movement threshold that normal right-clicking never accidentally triggers navigation.

---

## 31. Recent Files / Library sidebar panel

**Source:** Arc concept

**Status:** ⬜ Planned

Add a proper browser content utility to the sidebar.

Show recent:

- Downloads
- Images
- Screenshots
- PDFs
- Other downloaded/opened files
- Relevant clipboard image where Ember already tracks it

Allow files to be:

- Opened
- Revealed in Explorer
- Copied
- Dragged directly from Ember into webpages
- Removed from recent history

This complements the recent-file upload UI already being developed.

**Existing related work:** Ember already has a recent-file/clipboard-aware upload picker. That does **not** complete this feature; #31 remains planned until there is a real reusable sidebar Library panel with the actions listed above.

---

## 32. Per-site control panel

**Source:** Orion

**Status:** ⬜ Planned

Compact control beside the address/identity area.

Per-domain settings such as:

- JavaScript
- Cookies
- Popups
- Autoplay
- Camera
- Microphone
- Notifications
- Location
- Zoom
- User-agent override
- Darkening/theme override where implemented

Changes persist specifically for that site.

Keep advanced controls tucked away rather than permanently exposing them.

---

## 33. Built-in translation

**Status:** ⬜ Planned

Detect foreign-language pages and expose a small translation action.

Support:

- Translate whole page
- Translate selected text
- Return to original

Selection translation could use the same Ember popup family as Smart Conversions.

No giant translation toolbar unless necessary.

---

## 34. Per-tab volume booster

**Source:** Opera

**Status:** ⬜ Planned

Beyond ordinary 0–100% volume control, optionally allow boosting unusually quiet media.

Example:

```text
100%
150%
200%
300%
```

Keep this under the media controls rather than creating another major UI surface.

Apply per tab/media session, not globally unless explicitly selected.

---

## 35. Mirrored tabs/state across Ember windows

**Source:** Zen concept

**Status:** ⬜ Planned

When the same Ember session/workspace is visible in more than one Ember window, avoid blindly duplicating everything.

Where technically practical, treat the second appearance as another view onto the same underlying browser state.

Synchronise:

- Current URL
- Tab title
- Tab ordering/state
- Navigation
- Workspace changes
- Relevant tab metadata

The goal is preventing multiple windows from turning into multiple completely separate copies of the same session.

This should not put tabs in the sidebar.

---

# Lower priority / later additions

## 36. Page-aware browser tinting

**Source:** Safari  
**Priority:** Later, because tab UI is still changing

**Status:** ⬜ Planned

Allow the active webpage's colour to subtly influence Ember's surrounding chrome.

Potentially tint:

- Top chrome
- Sidebar glass
- Border/accent illumination

It must remain subtle and should not compromise text contrast.

This should be built only after the primary tab/chrome design stabilises.

---

## 37. Freeze Page + Draw mode

**Status:** ⬜ Planned

**Inspired by browser screenshot/annotation tools**  
**Priority:** Later

Do not build a large screenshot editor.

One button:

```text
Annotate Page
```

Behavior:

1. Freeze the webpage visually in its current state.
2. Prevent page interactions.
3. Overlay a drawing canvas over exactly what is displayed.
4. Allow quick annotation.

Basic tools only:

- Pen
- Highlighter
- Eraser
- Thickness
- Undo
- Clear
- Copy/save result
- Exit

It should feel like temporarily drawing directly on the webpage rather than launching an external editor.

---

# Combined priority order

1. Automatic tab hibernation / true renderer offloading ✅
2. Bangs / custom Quick Searches ✅
3. Smart selection conversions ✅
4. Internet Archive fallback ✅
5. Ctrl+Tab visual switcher ✅
6. Link Peek
7. Instant/Favorite sidebar buttons
8. Copy Link
9. Split View
10. Follower Tabs
11. In-window floating webpages
12. Workspaces
13. Workspace Profiles
14. Universal sidebar tab search
15. Fully-offloaded named Sessions
16. Automatic workspace routing
17. Hibernation integration across the entire tab system
18. Picture-in-Picture
19. Sidebar media controls
20. Per-tab audio controls
21. Compact / Frameless Mode
22. Edge-hover UI reveal
23. Adaptive chrome
24. Parent/child tab relationships
25. Duplicate-tab detection
26. Tab Traces
27. Hover tab previews
28. Tab renaming
29. Protected tabs
30. Back/Forward mouse gestures
31. Recent Files / Library sidebar
32. Per-site controls
33. Translation
34. Volume booster
35. Cross-window state mirroring
36. Page-aware browser tinting
37. Freeze + Draw annotation mode
