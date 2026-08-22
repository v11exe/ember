const { SEARCH_URL } = require('./ipc')

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

// Decide whether omnibox input is a navigable URL, an internal page or a search.
function toNavigationUrl(input) {
  const raw = String(input || '').trim()
  if (!raw) return null
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || /^(ember|about|data|blob):/i.test(raw)) return raw

  const keyword = keywordUrl(raw)
  if (keyword) return keyword

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
