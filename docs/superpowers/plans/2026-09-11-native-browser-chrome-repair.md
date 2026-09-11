# Native browser-chrome repair implementation plan

> Execute on `chromium-port` against the pinned external Chromium checkout.

**Goal:** Deliver one coherent Ember-native repair for tab/split chrome,
address/navigation behavior, and Web Store navigation while preserving the
accepted shell geometry and ungoogled privacy boundary.

**Architecture:** Add one ordered patch after 0021. Keep behavior in its current
owners: tab geometry and paint in Views tab classes, split adjacency in the tab
layout solver, URL presentation in BrowserView through Chromium's formatter,
navigation visibility in ToolbarView, and Web Store launch identity in
`extension_urls`. Patch-stack tests protect both requirements and non-goals.

### Task 1: Lock contracts red

**Files:** `test/chromium-port.test.js`

1. Add a 0022 contract covering compact close visuals with stable content
   bounds, centered favicons, joined split layout/paint, pane-local hover/focus,
   neutral new-tab ink drop, parsed URL formatting, canonical focus/copy,
   always-visible command-driven Forward, real Web Store launch URLs, and
   retained qjz9zk/update/API blocking.
2. Run the focused Node test and confirm it fails because 0022 does not exist.

### Task 2: Implement and test native behavior

**Files:** external pinned Chromium sources listed by the failing contract,
focused native unit tests, `chromium/patches/ember/0022-*.patch`,
`chromium/patches/series`

1. Snapshot exact preimages of every external source file.
2. Implement close/favicons/stable tab content.
3. Implement adjacency-aware split layout and Ember segment painting.
4. Make split hover pane-local and add seam/two-pane affordance.
5. Neutralize and verify new-tab ink-drop styling.
6. Implement parsed compact URL presentation and reset display caret/scroll.
7. Keep Forward visible with real command state.
8. Restore only public Web Store launch URLs.
9. Add native tests for split adjacency, URL presentation, and Web Store launch
   endpoints; run the smallest owning targets.
10. Generate ordered patch 0022 from preimages, append the series, and make the
    Node contract green.

### Task 3: Build and real-app QA

**Files:** `artifacts/browser-chrome-repair/2026-09-11/**`

1. Build affected object/test targets, then `chrome`.
2. Launch a clean-profile Ember window at `-1920,224,1920x1080` display bounds
   using CDP; never send OS-level synthetic keys.
3. Capture normal, hover/close, split active/inactive/focused/hover/collapse,
   new-tab, address idle/focus/blur, navigation history, and Web Store states.
4. Use CDP for page navigation and clipboard/runtime assertions; use focused
   Views tests for chrome states CDP cannot address.
5. Fix observed regressions and repeat the affected captures/tests.

### Task 4: Verify and record

**Files:** `CHROMIUM_PORT_STATUS.md`, `AGENTS.md`

1. Run patch hunk checks, focused Node/native tests, incremental `chrome`,
   `npm test`, and `npm run smoke` with fresh output.
2. Self-review the complete diff because multi-agent review is not authorized
   for this task.
3. Record exact evidence, limitations, and next state in the port ledger; mark
   the Work Log entry complete without changing ROADMAP #9's planned status.
