# Run 6 requirements and transition checks

Source inspection: pinned Chromium 151; existing changes through 0068 preserved.
Final browser link and new-binary interaction acceptance are user-run.

| Work | Owner and implementation decision | Required evidence |
| --- | --- | --- |
| Settings | Existing Chromium Appearance and Search pages, native prefs/bookmarks/TemplateURLs; named groups without route or value migration | Searchable labels, conditional photo controls, accessible dropdowns, unchanged deep links/defaults |
| Split follower | SplitTabData stores weak source/destination WebContents; real browser delegate/window creation and navigation throttle paths | Toggle, opposite action disabled, swap/orientation identity, unsplit/replace/detach cancellation, GET/referrer/security |
| Webview fullscreen | FullscreenController plus existing FullscreenWithinTabHelper, separate browser-window expansion ownership | Default off, API entry/exit, F11 twice, Escape, previous F11, frame/document loss, pref change |
| Reading return | WebContents-local reload snapshot before network request, native bounded glass action | Exact reload/document URL, no automatic scroll, five usable seconds, hover/focus pause, bounded delayed layout and user cancellation |
| Content suggestions | Bounded local readable-text cache through isolated world; existing OpenTabProvider/acceptance | Exact tab/document, profile isolation, no drafts/internal pages, no renderer wake for queries, bangs first, stale result rejected |
| Downloads (added during run) | Existing Chromium download bubble/controller and manager, footer above Media | Orange progress, native safety/actions, unknown totals, multiple/empty/failure states, original file address copy, mutual exclusion/focus/live ownership |

Transition matrix before edits:

- Follower: off → either direction → stop; opposite disabled. Swap changes wording, never identity. Pair membership changes invalidate before dispatch. GET links route once before request; forms, POST, reload, downloads, anchors and protocols retain native behavior. Generic script-intercepted SPA routing cannot be inferred safely from arbitrary scripts; investigate and document its boundary.
- Fullscreen: windowed → content within pane → F11 window expansion → F11 restores pane content fullscreen. Escape exits content plus only the expansion owned by this feature. An already fullscreen browser remains independently owned. API exit, navigation, closure and disabling the preference clean up; renderer permissions remain upstream.
- Reload: snapshot → successful same-URL commit → toast → action/expiry/dismissal. New navigation/reload supersedes old generations. Return waits only within a bounded layout window and stops on subsequent user input.
- Search: document cache → query match → exact-tab activation → re-find/highlight. Navigation/closure invalidate; changed query cannot reuse stale asynchronous results. Sleeping tabs contribute available cache only. The renderer snapshot excludes editable ancestors and script/style text; inaccessible cross-origin/shadow content requires explicit limits.

Implementation/check results and remaining runtime limits will be recorded here
and in CHROMIUM_PORT_STATUS.md as work completes.

## Settings inventory and retained routes

| Existing owner/control | Route/group after this run | Persistence and migration |
| --- | --- | --- |
| Wide sidebar, Favorite rows, bookmark title/URL/order editing | Appearance → Ember sidebar and Favorites | Same prefs/bookmark IDs; hidden sites retained; legacy columns metadata unchanged |
| Wordmark, Unsplash enabled/topic/Access Key | Appearance → Ember New Tab | Same profile prefs/defaults; dependent photo controls remain conditional; no Secret Key |
| Conversion enabled/currency/temperature/distance/weight/volume/clock/time zone | Appearance → Ember selection conversions | Same native prefs/rules; accessible dropdown labels; cache/rate metadata stays internal |
| Quick Searches and alias/template URL editing | Existing Search Engines route, linked from Appearance | Native TemplateURLService and old route/back navigation; seeded flag remains internal |
| New content-fullscreen boolean | Appearance → Ember webpage fullscreen | Native profile boolean, OFF default, Settings allowlist |
| Sidebar open state, recent upload metadata, cached rates, migrations | Existing native owner | Existing state/defaults and private rules; no speculative new settings groups |
| Media source/gain, Snap, split arrange/following | Existing native utility/split surfaces | Transient tab/pair state stays with its genuine owner; no duplicate stores |
| Chromium security/performance/native preferences | Original native pages | No security controls removed or re-routed |

## Evidence and boundaries

- Acceptance correction 0071: user-linked Settings shows headings inside one Appearance card and duplicate toggle labels; ordinary sidebar title/content search is gated off by the controller's default false unscoped option. Separate native section cards and single native toggle labels preserve values/routes; enable the existing unscoped option and give both title/content rows exact identity, query-preserving traversal, live favicon and Open in Different Tab. Six actual Ninja production objects plus two native regression units compile. Production Settings and the focused Appearance TypeScript regression compile; full Settings test TypeScript remains blocked by 21 pre-existing About/SearchEngine fixture errors, without disabling tests. Existing-binary native-component DOM preview and HTTP isolated-world index/scroll/highlight checks pass; final 0071 native interaction acceptance remains user-run.
- Final 0071 checks: 113 runnable tests, 71 patch checks, reverse postimages in a 295-file scratch tree and 43 resources pass. The dedicated QA browser is closed with evidence/profile preserved. The stopped sequential Ninja plan exits 0 with 421 pending actions; no full browser build or reset ran, and BUILD/LOGS retain their existing command/log.
- User build correction 0070: the final 0069 popup route passed a Mojo referrer pointer to a value constructor; the late edit was not covered by the prior compilation claim. The corrected non-null-field dereference now passes the actual focused Ninja browser object target, 113 runnable tests, 70 patch checks and prepared postimages/resources. Final linking/runtime acceptance remain user-run.
- After 0070, the sequential preserved-file Ninja dry plan exits 0 with 908 pending actions. Cached GN launcher, existing incremental outputs and BUILD/LOGS handoff are preserved.
- 113 runnable checks pass: existing native repository contracts/conversions/search/Snap plus 14 page-state VM cases covering draft exclusion, mutation/route invalidation, limits, nested snapshot/restore, delayed clamp, cancellation and Unicode/cross-node highlighting.
- 31 cached native compilation commands pass (27 production objects, four test units); native executables are absent. Regression sources exercise true DOM fullscreen/F11/API/Escape, split identities/menu/routing/duplicate tab prevention, stale/foreign-profile acceptance, real reload/no-auto-jump, redirected address TestClipboard and live download rows/mutual exclusion/reopen. Compilation is not runtime acceptance.
- Settings TypeScript/WebUI and browser GRIT targets pass. Patch hunk checks pass 69/69; prepared reverse postimages pass in a 289-file scratch tree; 43 manifest destinations verify. Final diff/LF checks pass. No full browser build or incremental/profile reset ran.
- The final sequential Ninja dry plan exits 0 with 3951 pending actions, including the browser link. Response/dependency files and the cached GN Python launcher remain preserved; the full build remains user-run.
- Native source investigation confirms same-tab link attribution and validated popup paths. The throttle may follow source beforeunload; generic preventDefault/history.pushState scripts do not produce a genuine link navigation. Native explicit-gesture window.open does not expose link provenance; routing returns null and adds no opener relationship. These exact limits need representative-page QA.
- Indexing and reading anchors cover main-frame light DOM, excluding frames/shadow trees and unloaded/bounded-out text. Queries use cache, never wake sleepers, and retain exact profile/tab/document identity. Native Ctrl+F state remains untouched. Cross-node passages scroll without a fabricated highlight.
- Downloads retains warnings/blocked actions, native commands and final HTTP(S) URL after redirects; blob/data/local files expose no transferable network address. Signed URLs keep expiry/auth requirements. Progress/membership changes retain fixed primary viewport geometry and row identity; security detail pages may intentionally expand.
- User acceptance matrix remains pending after the final full link, including previous Run 5 controls/autofocus, native pointer/keyboard/focus transitions, security/permissions, resize/DPI/display changes, short windows, unknown totals and interrupted opening/closing.
