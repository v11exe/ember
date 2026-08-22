const fs = require('node:fs')
const path = require('node:path')

// Saved browsing session: the tabs that were open when Ember last closed, so
// they can be reopened on the next launch (Opera's "continue where you left
// off", Chrome's "restore pages").
//
// Only URL, title and which tab was active are stored. No page content, no form
// data, nothing that would make this file sensitive beyond the URL list itself.

const MAX_TABS = 100

function isRestorable(url) {
  if (!url) return false
  // A blank new tab restores nothing, with or without the trailing slash.
  if (/^ember:\/\/newtab\/?$/i.test(url)) return false
  if (/^ember:\/\/$/i.test(url)) return false
  return /^(https?|ember):/i.test(url)
}

function defaultState() {
  return { version: 1, savedAt: 0, tabs: [] }
}

/** Reduce live tabs to the minimum worth persisting. */
function serialiseTabs(tabs = [], activeId = null) {
  const restorable = tabs.filter((tab) => isRestorable(tab.url))
  return restorable.slice(0, MAX_TABS).map((tab) => ({
    url: tab.url,
    title: tab.title || tab.url,
    active: tab.id === activeId,
  }))
}

class SessionStore {
  constructor(file) {
    this.file = file
    this.data = this.#read()
  }

  #read() {
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'))
      if (data?.version !== 1 || !Array.isArray(data.tabs)) return defaultState()
      return { version: 1, savedAt: data.savedAt || 0, tabs: data.tabs.filter((tab) => isRestorable(tab.url)) }
    } catch (error) {
      if (error.code !== 'ENOENT') console.warn('[ember] session could not be read:', error.message)
      return defaultState()
    }
  }

  snapshot() { return structuredClone(this.data) }

  get count() { return this.data.tabs.length }

  hasSession() { return this.data.tabs.length > 0 }

  /** Write synchronously: this runs while the window is closing. */
  saveSync(tabs, activeId) {
    const next = { version: 1, savedAt: Date.now(), tabs: serialiseTabs(tabs, activeId) }
    this.data = next
    const temporary = `${this.file}.tmp-${process.pid}-${Date.now()}`
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      fs.writeFileSync(temporary, JSON.stringify(next, null, 2) + '\n', 'utf8')
      fs.renameSync(temporary, this.file)
    } catch (error) {
      try { fs.rmSync(temporary, { force: true }) } catch { /* nothing to clean */ }
      console.warn('[ember] session could not be saved:', error.message)
      return false
    }
    return true
  }

  clearSync() {
    this.data = defaultState()
    try { fs.rmSync(this.file, { force: true }) } catch { /* already gone */ }
  }
}

module.exports = { SessionStore, serialiseTabs, isRestorable, MAX_TABS }
