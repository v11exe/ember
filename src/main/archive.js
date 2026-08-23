// Asks the Wayback Machine whether it has a copy of a page.
//
// Only ever called because someone clicked "View archived version" — Ember
// never checks in the background, so browsing history is not handed to
// archive.org as a side effect of a dead link.

const { availabilityUrl, pickSnapshot, isArchivable } = require('../shared/archive')

const TIMEOUT = 8000
const MAX_CACHE = 60

class ArchiveLookup {
  constructor({ fetch: fetchImpl, timeout = TIMEOUT, max = MAX_CACHE } = {}) {
    this.fetch = fetchImpl || ((...args) => globalThis.fetch(...args))
    this.timeout = timeout
    this.max = max
    this.cache = new Map() // url -> { url, timestamp } | null
    this.pending = new Map()
  }

  /**
   * @param {string} url
   * @returns {Promise<{ url: string, timestamp: string }|null>}
   */
  async find(url) {
    const key = String(url || '')
    if (!isArchivable(key)) return null
    if (this.cache.has(key)) return this.cache.get(key)
    if (this.pending.has(key)) return this.pending.get(key)

    const lookup = this.#request(key).finally(() => this.pending.delete(key))
    this.pending.set(key, lookup)
    return lookup
  }

  async #request(url) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)
    try {
      const response = await this.fetch(availabilityUrl(url), { signal: controller.signal })
      if (!response.ok) return null
      const snapshot = pickSnapshot(await response.json())
      this.#remember(url, snapshot)
      return snapshot
    } catch {
      // A lookup that fails is not cached: the next attempt should try again.
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  #remember(url, snapshot) {
    this.cache.delete(url)
    this.cache.set(url, snapshot)
    while (this.cache.size > this.max) this.cache.delete(this.cache.keys().next().value)
  }
}

module.exports = { ArchiveLookup, TIMEOUT }
