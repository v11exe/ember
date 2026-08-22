const fs = require('node:fs')
const path = require('node:path')

// Downloads: a persisted record of finished transfers plus live progress for
// ones still running. Same atomic JSON pattern as bookmarks and history.
//
// Electron owns the actual transfer through session 'will-download'. This module
// only mirrors it into something the renderer can list, and keeps the DownloadItem
// handles so pause/resume/cancel have something to act on.

const MAX_ENTRIES = 500

function defaultState() {
  return { version: 1, entries: [] }
}

/** DownloadItem states, normalised so the renderer has one vocabulary. */
function stateOf(item) {
  if (item.isPaused && item.isPaused()) return 'paused'
  const state = item.getState()
  if (state === 'progressing') return 'progressing'
  if (state === 'completed') return 'completed'
  if (state === 'cancelled') return 'cancelled'
  return 'interrupted'
}

function describe(item, extra = {}) {
  const received = item.getReceivedBytes()
  const total = item.getTotalBytes()
  return {
    url: item.getURL(),
    filename: item.getFilename(),
    savePath: item.getSavePath(),
    mime: item.getMimeType(),
    receivedBytes: received,
    totalBytes: total,
    state: stateOf(item),
    canResume: item.canResume ? item.canResume() : false,
    startedAt: item.getStartTime() ? Math.round(item.getStartTime() * 1000) : Date.now(),
    ...extra,
  }
}

class DownloadStore {
  constructor(file, { max = MAX_ENTRIES } = {}) {
    this.file = file
    this.max = max
    this.data = this.#read()
    this.live = new Map() // id -> Electron.DownloadItem
    this.active = new Map() // id -> progress record
    this.onChange = null
    this.writing = null
    this.nextId = 1
  }

  #read() {
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'))
      if (data?.version !== 1 || !Array.isArray(data.entries)) return defaultState()
      return { version: 1, entries: data.entries }
    } catch (error) {
      if (error.code !== 'ENOENT') console.warn('[ember] download store could not be read:', error.message)
      return defaultState()
    }
  }

  snapshot() {
    return {
      version: 1,
      // Running transfers first: they are what the user is waiting on.
      active: [...this.active.values()].map((entry) => structuredClone(entry)),
      entries: structuredClone(this.data.entries),
    }
  }

  #changed() {
    this.onChange?.(this.snapshot())
  }

  /** Attach to a live Electron DownloadItem. */
  track(item) {
    const id = `dl-${Date.now()}-${this.nextId++}`
    this.live.set(id, item)
    this.active.set(id, { id, ...describe(item) })
    this.#changed()

    item.on('updated', (_event, state) => {
      const entry = this.active.get(id)
      if (!entry) return
      Object.assign(entry, describe(item), {
        state: state === 'interrupted' ? 'interrupted' : stateOf(item),
      })
      this.#changed()
    })

    item.once('done', (_event, state) => {
      const entry = this.active.get(id) || { id }
      const finished = {
        ...entry,
        ...describe(item),
        state: state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'interrupted',
        endedAt: Date.now(),
      }
      this.active.delete(id)
      this.live.delete(id)
      this.data.entries.unshift(finished)
      if (this.data.entries.length > this.max) this.data.entries.length = this.max
      this.#schedulePersist()
      this.#changed()
    })

    return id
  }

  pause(id) { this.live.get(id)?.pause(); this.#changed() }
  resume(id) { const item = this.live.get(id); if (item?.canResume()) item.resume(); this.#changed() }
  cancel(id) { this.live.get(id)?.cancel() }

  async remove(id) {
    this.data.entries = this.data.entries.filter((entry) => entry.id !== id)
    await this.#persist()
    return this.snapshot()
  }

  /** Clears the finished list only; running transfers are left alone. */
  async clear() {
    this.data.entries = []
    await this.#persist()
    return this.snapshot()
  }

  #schedulePersist() {
    if (this.writing) return
    this.writing = setTimeout(() => {
      this.writing = null
      this.#persist().catch((error) => console.warn('[ember] download write failed:', error.message))
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

/** Human sizes; exported so the renderer contract test can check the same rules. */
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1 }
  return `${value >= 10 || Number.isInteger(value) ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

function progressOf(entry) {
  if (!entry || !entry.totalBytes || entry.totalBytes <= 0) return null
  return Math.min(1, Math.max(0, entry.receivedBytes / entry.totalBytes))
}

module.exports = { DownloadStore, formatBytes, progressOf, stateOf, describe, MAX_ENTRIES }
