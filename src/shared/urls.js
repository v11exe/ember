const { SEARCH_URL } = require('./ipc')
const { BANG_PREFIX, bangTable, resolveBang } = require('./bangs')

// Typing the name of an internal page goes there, the way chrome://settings
// works in Chrome. Only an exact single word matches, so "settings for macbook"
// still reaches the search engine.
const KEYWORDS = new Map([
  ['settings', 'ember://settings'],
  ['preferences', 'ember://settings'],
  ['extensions', 'ember://extensions'],
  ['addons', 'ember://extensions'],
  ['history', 'ember://history'],
  ['downloads', 'ember://downloads'],
  ['newtab', 'ember://newtab'],
])

/** The internal page a bare keyword refers to, or null. */
function keywordUrl(input) {
  const word = String(input || '').trim().toLowerCase().replace(/\/+$/, '')
  return KEYWORDS.get(word) || null
}

// Building the default bang table costs a little and never changes.
let defaultTable = null

/**
 * Decide whether omnibox input is a navigable URL, an internal page, a bang or
 * a search.
 *
 * @param {string} input
 * @param {{ bangs?: Map|Array }} [options] the user's bang list, or a built table
 */
function toNavigationUrl(input, { bangs } = {}) {
  const raw = String(input || '').trim()
  if (!raw) return null
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || /^(ember|about|data|blob):/i.test(raw)) return raw

  const table = bangs instanceof Map
    ? bangs
    : (bangs ? bangTable(bangs) : (defaultTable ||= bangTable([])))
  const bang = resolveBang(raw, table)
  // An explicit ! outranks an internal page name. A bare keyword does not, so
  // typing "history" still opens Ember's own history page.
  const words = raw.split(/\s+/)
  const explicit = words[0].startsWith(BANG_PREFIX) || words.at(-1).startsWith(BANG_PREFIX)
  if (bang && explicit) return bang.url

  const keyword = keywordUrl(raw)
  if (keyword) return keyword
  if (bang) return bang.url

  if (/^localhost(:\d+)?(\/|$)/i.test(raw)) return `http://${raw}`
  // bare domain: has a dot, no spaces, plausible TLD
  if (!/\s/.test(raw) && /^[^\s/]+\.[a-z]{2,}([/:?#].*)?$/i.test(raw)) return `https://${raw}`
  return SEARCH_URL + encodeURIComponent(raw)
}

function displayUrl(url) {
  if (!url || url === 'about:blank') return ''
  if (url.startsWith('ember://')) return ''
  return url
}

module.exports = { toNavigationUrl, displayUrl, keywordUrl, KEYWORDS }
