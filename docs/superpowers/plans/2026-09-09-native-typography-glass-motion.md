# Native typography and glass motion implementation plan

**Goal:** Apply browser-scoped Inter and the approved spring geometry to every existing native Ember glass surface.
**Architecture:** Bundle Inter with its license; select it only in browser UI font providers and explicitly owned WebUI. Share analytic position/velocity springs between native panels and bubble adapters. Keep content at final size, animate the shell and reveal clip, retain cached material and native lifecycle.
**Order:** Full implementation, then build and comprehensive verification, then fix/retest.

- [x] Bundle canonical Inter and semantic native/WebUI typography; preserve sizes and content isolation.
- [x] Add EmberGlassTransition with independent 190/.84 width, 220/.80 height, 200/.84 corner springs; 85ms opacity; 165/.92 close with 125ms opacity and 190ms cleanup. Retarget from current position/velocity; reduced motion exact state.
- [x] Integrate shell drawing and child clipping in EmberGlassView; final-size children, floating point geometry, exact final bounds.
- [x] Migrate page/tab/New Tab/extension-action menus, independently anchored submenu children, Ctrl+Tab and both Extensions bubble implementations.
- [x] Generate ordered native patch(es), synchronize resource overlay, preserve pinned external preimages and existing work.
- [x] Build complete chrome target. Focused/native contracts and Electron regression gates are deferred to the separate verifier.
- [x] Run visible PL288H typography/motion and page-isolation QA at 100% DPI, including menu and Ctrl+Tab captures; rapid interruption, edge anchoring and other scale factors remain uncovered.
- [x] Correct the startup resource fallback, rebuild, update the port ledger and Work Log.
