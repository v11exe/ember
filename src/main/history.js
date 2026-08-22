const fs = require('node:fs')
const path = require('node:path')

// Browsing history: append-only visit log with an atomic JSON store, mirroring
// the BookmarkStore pattern (userData JSON, tmp file + rename).
//
// Kept deliberately small: history is a list, not a graph. Grouping by day and
// searching happen in the renderer against a snapshot.

const MAX_ENTRIES = 5000
const RECENTLY_CLOSED_LIMIT = 25

/** URLs that are browser furniture rather than places the user visited. */
function isRecordable(url) {
  if (!url) return false
  return /^https?:\/\//i.test(url)
}

function hostOf(url) {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

function defaultState() {
  return { version: 1, entries: [] }
}

class HistoryStore {
  constructor(file, { max = MAX_ENTRIES } = {}) {
    this.file = file
    this.max = max
    this.data = this.#read()
    this.recentlyClosed = []
    this.writing = null
  }

  #read() {
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'))
      if (data?.version !== 1 || !Array.isArray(data.entries)) return defaultState()
      return { version: 1, entries: data.entries }
    } catch (error) {
      if (error.code !== 'ENOENT') console.warn('[ember] history store could not be read:', error.message)
      return defaultState()
    }
  }

  snapshot() {
    return {
      version: 1,
      entries: structuredClone(this.data.entries),
      recentlyClosed: structuredClone(this.recentlyClosed),
    }
  }

  /**
   * Record a visit. Returns the entry, or null when the URL is not recordable.
   * Reloading or bouncing within the same page inside a short window updates the
   * existing entry instead of stacking duplicates.
   */
  record({ url, title = '', favicon = null, visitedAt = Date.now() }) {
    if (!isRecordable(url)) return null

    const previous = this.data.entries[0]
    if (previous && previous.url === url && visitedAt - previous.visitedAt < 30_000) {
      previous.visitedAt = visitedAt
      if (title) previous.title = title
      if (favicon) previous.favicon = favicon
      this.#schedulePersist()
      return previous
    }

    const entry = {
      id: `${visitedAt}-${Math.random().toString(36).slice(2, 8)}`,
      url,
      title: title || url,
      host: hostOf(url),
      favicon,
      visitedAt,
    }
    this.data.entries.unshift(entry)
    if (this.data.entries.length > this.max) this.data.entries.length = this.max
    this.#schedulePersist()
    return entry
  }

  /** Late-arriving title/favicon for a visit already recorded. */
  decorate(url, { title, favicon } = {}) {
    const entry = this.data.entries.find((candidate) => candidate.url === url)
    if (!entry) return null
    if (title) entry.title = title
    if (favicon) entry.favicon = favicon
    this.#schedulePersist()
    return entry
  }

  noteClosedTab({ url, title = '', favicon = null, closedAt = Date.now() }) {
    if (!isRecordable(url)) return null
    const item = { id: `closed-${closedAt}`, url, title: title || url, host: hostOf(url), favicon, closedAt }
    this.recentlyClosed = [item, ...this.recentlyClosed.filter((c) => c.url !== url)]
      .slice(0, RECENTLY_CLOSED_LIMIT)
    return item
  }

  async remove(ids) {
    const doomed = new Set(ids || [])
    if (!doomed.size) return this.snapshot()
    this.data.entries = this.data.entries.filter((entry) => !doomed.has(entry.id))
    await this.#persist()
    return this.snapshot()
  }

  /**
   * Clear a time range. `since` is a timestamp; omit it to clear everything.
   */
  async clear({ since } = {}) {
    this.data.entries = since ? this.data.entries.filter((entry) => entry.visitedAt < since) : []
    if (!since) this.recentlyClosed = []
    await this.#persist()
    return this.snapshot()
  }

  // Visits arrive in bursts, so coalesce writes rather than hitting disk per navigation.
  #schedulePersist() {
    if (this.writing) return
    this.writing = setTimeout(() => {
      this.writing = null
      this.#persist().catch((error) => console.warn('[ember] history write failed:', error.message))
    }, 400)
    this.writing.unref?.()
  }

  async #persist() {
    const temporary = `${this.file}.tmp-${process.pid}-${Date.now()}`
    try {
      await fs.promises.mkdir(path.dirname(this.file), { recursive: true })
      await fs.promises.writeFile(temporary, JSON.stringify(this.data, null, 2) + '\n', 'utf8')
      await fs.promises.rename(temporary, this.file)
    } catch (error) {
      await fs.promises.rm(temporary, { force: true })
      throw error
    }
  }
}

module.exports = { HistoryStore, isRecordable, hostOf, MAX_ENTRIES, RECENTLY_CLOSED_LIMIT }
