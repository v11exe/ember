const fs = require('node:fs')
const path = require('node:path')

const { HIBERNATION_DEFAULTS, sanitiseHibernation } = require('./hibernation')
const { sanitiseBangs } = require('../shared/bangs')

// Small preference store. Same atomic JSON pattern as bookmarks/history/downloads.
//
// Only settings that must survive a restart belong here. Anything derivable at
// runtime does not.

const SESSION_RESTORE = { ASK: 'ask', ALWAYS: 'always', NEVER: 'never' }

function defaults() {
  return {
    version: 1,
    // 'ask' shows the prompt on close; the prompt's third button writes
    // 'always' or 'never' so it stops asking.
    sessionRestore: SESSION_RESTORE.ASK,
    // Remembered window geometry, so Ember reopens where it was left.
    window: null,
    // Idle background tabs lose their renderer; see hibernation.js.
    hibernation: { ...HIBERNATION_DEFAULTS },
    // Omnibox quick searches the user added, overrode or removed.
    bangs: [],
  }
}

function sanitiseBounds(bounds) {
  if (!bounds) return null
  const { x, y, width, height, maximized } = bounds
  if (![width, height].every((value) => Number.isFinite(value) && value > 200)) return null
  return {
    x: Number.isFinite(x) ? Math.round(x) : undefined,
    y: Number.isFinite(y) ? Math.round(y) : undefined,
    width: Math.round(width),
    height: Math.round(height),
    maximized: !!maximized,
  }
}

class SettingsStore {
  constructor(file) {
    this.file = file
    this.data = this.#read()
    this.writing = null
  }

  #read() {
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'))
      if (data?.version !== 1) return defaults()
      const restore = Object.values(SESSION_RESTORE).includes(data.sessionRestore)
        ? data.sessionRestore
        : SESSION_RESTORE.ASK
      return {
        version: 1,
        sessionRestore: restore,
        window: sanitiseBounds(data.window),
        hibernation: sanitiseHibernation(data.hibernation),
        bangs: sanitiseBangs(data.bangs),
      }
    } catch (error) {
      if (error.code !== 'ENOENT') console.warn('[ember] settings could not be read:', error.message)
      return defaults()
    }
  }

  get(key) { return this.data[key] }

  snapshot() { return structuredClone(this.data) }

  async set(key, value) {
    if (key === 'window') this.data.window = sanitiseBounds(value)
    else if (key === 'hibernation') {
      // Partial updates are the norm here — the settings page sends one field.
      this.data.hibernation = sanitiseHibernation({ ...this.data.hibernation, ...(value || {}) })
    } else if (key === 'bangs') {
      // The page always sends the whole list, so this is a straight replace.
      this.data.bangs = sanitiseBangs(value)
    } else if (key === 'sessionRestore') {
      if (!Object.values(SESSION_RESTORE).includes(value)) return this.snapshot()
      this.data.sessionRestore = value
    } else return this.snapshot()
    await this.#persist()
    return this.snapshot()
  }

  /** Window geometry changes constantly while dragging, so coalesce writes. */
  rememberWindow(bounds) {
    this.data.window = sanitiseBounds(bounds)
    if (this.writing) return
    this.writing = setTimeout(() => {
      this.writing = null
      this.#persist().catch((error) => console.warn('[ember] settings write failed:', error.message))
    }, 500)
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

module.exports = { SettingsStore, SESSION_RESTORE, sanitiseBounds }
