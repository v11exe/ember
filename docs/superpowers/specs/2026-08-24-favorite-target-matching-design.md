# Favorite Target Matching Design

## Goal

Let Ember store multiple Quick Sites from one web origin, distinguish a broad
origin shortcut from a specific page shortcut, and choose the correct existing
tab when each shortcut is opened.

## Canonical targets

Each valid HTTP(S) Quick Site is classified from its normalized URL:

- **Origin target:** pathname is `/`. It matches every HTTP(S) tab sharing the
  normalized origin. Search and fragment are ignored.
- **Page target:** pathname is not `/`. It matches only tabs with the same
  normalized origin and pathname. Search and fragment are ignored.

Existing `www.` hostname normalization remains in place. A page target such as
`https://en.wikipedia.org/wiki/Ember?oldformat=true#History` therefore matches
any `https://en.wikipedia.org/wiki/Ember` tab, regardless of query or fragment.

## Opening and activity

- A page Quick Site selects an existing exact page target. If none exists, it
  opens its saved URL in a new tab. It never selects an origin-only tab.
- An origin Quick Site first selects a tab at that origin's root pathname. If
  none exists, it may select any tab at the origin. If none exists, it opens
  the saved origin URL.
- The Favorite rail uses the same target matcher for its open highlight:
  origin entries highlight for every page at their origin; page entries highlight
  only on their matching pathname.

## Persistence and duplicates

Quick Sites are no longer de-duplicated by origin or canonical target. Each
valid saved entry remains in its configured reading-order position, including
exact duplicate entries. IDs continue to be made unique so each duplicate has
its own clickable, draggable and removable tile.

`placeFavorite()` and `favoriteFromTab()` insert a new entry rather than
reordering an equal existing entry. Reordering is only initiated by dragging a
Quick Site that already has an ID.

## Scope and verification

No renderer markup, styling, grid capacity or drag UI changes. The shared
Favorite contract gains focused tests covering duplicate preservation, broad
and page-specific activity, root-preferred broad opening, page-specific opening,
and query/fragment-insensitive pathname matching.
