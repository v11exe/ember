// Cached page screenshots, keyed by tab id.
//
// One store, several consumers. Hibernation writes here immediately before it
// destroys a renderer; the Ctrl+Tab switcher, hover previews and saved sessions
// read from it. Nothing else should call capturePage() for a preview — a
// sleeping tab has no renderer left to ask.
//
// A hidden WebContentsView often has no live frame to capture, so the useful
// moment is while a tab is still on screen: TabManager captures the outgoing
// tab as it deselects it. The capture at sleep time is a best-effort refresh
// that keeps the previous entry when it comes back empty.

const MAX_ENTRIES = 60
const THUMBNAIL_WIDTH = 480
const RETRY_DELAY = 150
const ATTEMPT_TIMEOUT = 1200

class ThumbnailCache {
  constructor({ max = MAX_ENTRIES, width = THUMBNAIL_WIDTH, retryDelay = RETRY_DELAY, attemptTimeout = ATTEMPT_TIMEOUT } = {}) {
    this.max = max
    this.width = width
    this.retryDelay = retryDelay
    this.attemptTimeout = attemptTimeout
    this.entries = new Map() // id -> { dataUrl, width, height, capturedAt }
  }

  /**
   * Screenshot a live tab. Resolves to the stored entry, or null when there was
   * nothing to capture — in which case any earlier entry is left untouched.
   */
  async capture(id, webContents, { rect = null } = {}) {
    if (!webContents || webContents.isDestroyed?.() || typeof webContents.capturePage !== 'function') return null
    try {
      const image = await this.#frame(webContents, rect)
      if (!image || image.isEmpty()) return null
      const size = image.getSize()
      const scaled = size.width > this.width ? image.resize({ width: this.width, quality: 'good' }) : image
      const scaledSize = scaled.getSize()
      return this.set(id, {
        dataUrl: scaled.toDataURL(),
        width: scaledSize.width,
        height: scaledSize.height,
        capturedAt: Date.now(),
      })
    } catch {
      return null
    }
  }

  /**
   * Chromium stops compositing a window it believes is occluded — another app
   * in front of Ember is enough — and capturePage() then answers with an empty
   * image. Asking for a repaint first, and giving it one more go, turns most
   * of those misses into real screenshots.
   */
  async #frame(webContents, rect) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (webContents.isDestroyed?.()) return null
      try { webContents.invalidate?.() } catch { /* not every view can be nudged */ }
      // Ask for an explicit rect. The whole-page form takes a different path
      // inside Electron that answers "display surface not available" — or
      // UnknownVizError — for a WebContentsView the compositor is not
      // currently presenting, which is most of the time for a background tab.
      //
      // It can also simply never answer, and neither failure may hold up a
      // caller waiting to hide a view or discard a renderer.
      const image = await Promise.race([
        webContents.capturePage(rect || undefined).catch(() => null),
        new Promise((resolve) => { setTimeout(() => resolve(null), this.attemptTimeout).unref?.() }),
      ])
      if (image && !image.isEmpty()) return image
      if (attempt === 0) await new Promise((resolve) => { setTimeout(resolve, this.retryDelay).unref?.() })
    }
    return null
  }

  /** Insert or refresh an entry, evicting the least recently written one. */
  set(id, entry) {
    this.entries.delete(id)
    this.entries.set(id, entry)
    while (this.entries.size > this.max) {
      this.entries.delete(this.entries.keys().next().value)
    }
    return entry
  }

  get(id) { return this.entries.get(id) || null }
  has(id) { return this.entries.has(id) }
  forget(id) { this.entries.delete(id) }
  clear() { this.entries.clear() }
  get size() { return this.entries.size }
}

module.exports = { ThumbnailCache, MAX_ENTRIES, THUMBNAIL_WIDTH, RETRY_DELAY, ATTEMPT_TIMEOUT }
