# Native browser-chrome repair design

## Scope

Repair Ember's existing Chromium Views chrome without changing the accepted
32-DIP top row, sidebar, page insets, tab width policy, or privacy blocking.
This is a parity/polish slice, not completion of the full ROADMAP #9 Split View
feature.

## Findings

- The close control retained a 28-DIP accessible target, but patch 0012 painted
  that entire target as an opaque rounded background. Its visibility also
  changed the title's available width during hover.
- Favicons are sized after their Y origin is chosen, so the icon view starts at
  the content box top instead of being centered inside it.
- Ordinary tabs use Ember's pill path, while split tabs fall through to
  Chromium's shoulder path. The strip's global -8-DIP overlap becomes an
  8-DIP gutter between split partners, and hover is propagated to both halves.
- The new-tab control is centered by Views, but its ink-drop colors still come
  from Chromium's tab-strip control palette, producing the blue surface.
- The sidebar formatter edits `url.spec()` as text. It happens to handle common
  examples but does not express a parsed presentation contract, and the
  unfocused text field can retain a tail-scrolled caret.
- Forward already owns the real `IDC_FORWARD` command and enabled state, but a
  profile preference is allowed to hide it in Ember's normal toolbar.
- ungoogled-Chromium domain substitution rewrites the Web Store launch
  constants to `*.qjz9zk`; its fail-safe URLRequest policy then returns
  `ERR_BLOCKED_BY_CLIENT`. That policy is working as designed.

## Design

1. Keep the close button's 28-DIP hit target, remove its permanent background,
   and inset only the ink-drop/focus geometry to a compact 16-DIP surface.
   Reserve the close lane independently of visibility so title and icon bounds
   do not change on hover.
2. Center icon view bounds from their final preferred size. Use the same content
   box calculation for ordinary, active, hovered, and split tabs.
3. Make split partners adjacency-aware in layout: zero gutter only between two
   consecutive members with the same split id; retain Ember's eight-DIP gutter
   everywhere else. Paint each half as a flat-inner/rounded-outer segment.
   The group shares active/inactive treatment, a one-pixel seam plus tiny
   two-pane glyph marks the join, and only the directly hovered/focused pane
   receives the internal lift. Removing the split id naturally restores the
   ordinary pill.
4. Keep the 28-DIP new-tab bounds and centered image container, but give its
   ink drop neutral Ember tab colors and a matching compact rounded path.
5. Replace string deletion with `url_formatter::FormatUrl` using explicit HTTP,
   HTTPS, and trivial-subdomain omission flags. Keep non-web schemes and the
   underlying `GURL` untouched. Focus and copy continue to read `url.spec()`;
   blur also returns selection/caret to the start so the compact value opens at
   its security-relevant host.
6. Force Forward visible only for Ember's normal browser toolbar. Preserve the
   existing Chromium command, icon, enabled-state updates, and alternate toolbar
   modes.
7. Restore only the Web Store *launch* constants to their real public hosts.
   Leave substituted update/API endpoints and the global qjz9zk request block
   intact, so navigation works without claiming built-in installation/update
   support that this ungoogled build does not provide.

## Verification

Add patch-stack contracts first, including privacy guardrails. Add focused
native layout and URL tests where the production ownership allows it. Build the
affected objects and `chrome`, launch the pinned binary on PL288H through CDP,
capture the actual HWND for visual comparison, and exercise navigation, URL
focus/blur/copy, split lifecycle, and Web Store loading. Finish with the full
repository gates and a fresh patch-stack integrity check.
