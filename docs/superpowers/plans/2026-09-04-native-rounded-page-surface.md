# Native Rounded Page Surface Implementation Plan

**Goal:** Match Ember's 12 px page corners while keeping the page inside the
existing 8 px native shell inset.

**Architecture:** Add patch 0010 on top of the compact top-chrome stack. Feed
the radius into Chromium's existing `MultiContentsView::SetBackgroundRadii()`
path so page contents, devtools, scrims and browser overlays share one native
clip. The already-painted Chromium frame behind the inset is the bounded shell
surface; fullscreen resets the radii.

### Task 1: Lock the patch contract

Extend the existing ordered-patch contract. Use the existing patch checker and
an actual native runtime capture to verify the change; source-text assertions
cannot establish that Chromium clips the composed page.

### Task 2: Generate patch 0010 mechanically

Snapshot the exact post-0009 layout file, implement the bounded radius change
in the prepared checkout, and generate the patch from exact before/after
images. Retain the current 8 px content inset and real Chromium content tree.

### Task 3: Compile and run a practical pass

Compile the affected layout object, resume the preserved native target, and
launch one fresh 900×556 profile. Capture the HWND and confirm all four page
corners are clipped, the shell inset remains visible, the page remains usable,
and shutdown is clean.

### Task 4: Record and synchronize

Update the native ledger and Work Log, run patch and focused checks,
reconcile `origin/chromium-port`, commit and push. Do not expand this slice into
fine tab-state or acrylic tuning unless the practical pass finds a blocker.
