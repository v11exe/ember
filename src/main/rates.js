// Exchange rates for the selection conversion popup.
//
// The European Central Bank publishes a daily reference set; frankfurter.app
// serves it as JSON with no key and no tracking. Rates are fetched lazily —
// nothing leaves the machine until you actually select a price in a currency
// that is not your own — and then cached on disk for the rest of the day.
//
// A failed fetch is not an error worth showing anyone: the popup simply has
// nothing to say about that price.

const fs = require('node:fs')
const path = require('node:path')

const SOURCE = 'https://api.frankfurter.app/latest?from=EUR'
const BASE = 'EUR'
const MAX_AGE = 12 * 60 * 60 * 1000
const TIMEOUT = 6000

function isUsable(data) {
  return !!data && data.base === BASE && data.rates && typeof data.rates === 'object'
    && Object.keys(data.rates).length > 0
}

class RateStore {
  /**
   * @param {string} file  cache path in userData
   * @param {{ fetch?: typeof globalThis.fetch, maxAge?: number, now?: () => number }} [opts]
   */
  constructor(file, { fetch: fetchImpl, maxAge = MAX_AGE, now = Date.now } = {}) {
    this.file = file
    this.fetch = fetchImpl || ((...args) => globalThis.fetch(...args))
    this.maxAge = maxAge
    this.now = now
    this.data = this.#read()
    this.pending = null
  }

  #read() {
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'))
      return isUsable(data) ? data : null
    } catch {
      return null
    }
  }

  get fresh() {
    return !!this.data && this.now() - (this.data.fetchedAt || 0) < this.maxAge
  }

  /** The cached table, refreshing it in the background when it has gone stale. */
  snapshot() {
    if (!this.fresh) this.refresh().catch(() => {})
    return this.data
  }

  /** Resolves to a usable table, or to whatever is cached, or to null. */
  async ensure() {
    if (this.fresh) return this.data
    return (await this.refresh()) || this.data
  }

  refresh() {
    if (this.pending) return this.pending
    this.pending = this.#fetchRates().finally(() => { this.pending = null })
    return this.pending
  }

  async #fetchRates() {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT)
    try {
      const response = await this.fetch(SOURCE, { signal: controller.signal })
      if (!response.ok) return null
      const body = await response.json()
      if (!isUsable(body)) return null
      this.data = { base: body.base, date: body.date, rates: body.rates, fetchedAt: this.now() }
      await this.#persist()
      return this.data
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  async #persist() {
    const temporary = `${this.file}.tmp-${process.pid}-${Date.now()}`
    try {
      await fs.promises.mkdir(path.dirname(this.file), { recursive: true })
      await fs.promises.writeFile(temporary, JSON.stringify(this.data, null, 2) + '\n', 'utf8')
      await fs.promises.rename(temporary, this.file)
    } catch {
      await fs.promises.rm(temporary, { force: true })
    }
  }
}

module.exports = { RateStore, SOURCE, BASE, MAX_AGE }
