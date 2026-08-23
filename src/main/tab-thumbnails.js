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

class ThumbnailCache {
  constructor({ max = MAX_ENTRIES, width = THUMBNAIL_WIDTH } = {}) {
    this.max = max
    this.width = width
    this.entries = new Map() // id -> { dataUrl, width, height, capturedAt }
  }

  /**
   * Screenshot a live tab. Resolves to the stored entry, or null when there was
   * nothing to capture — in which case any earlier entry is left untouched.
   */
  async capture(id, webContents) {
    if (!webContents || webContents.isDestroyed?.() || typeof webContents.capturePage !== 'function') return null
    try {
      const image = await webContents.capturePage()
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

module.exports = { ThumbnailCache, MAX_ENTRIES, THUMBNAIL_WIDTH }
