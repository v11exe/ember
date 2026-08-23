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

/** What the omnibox decided the input was. */
const INPUT = {
  URL: 'url',         // already a full address
  KEYWORD: 'keyword', // one of Ember's own pages
  BANG: 'bang',       // a quick search
  SITE: 'site',       // a bare host, or localhost
  SEARCH: 'search',   // none of the above
}

/** The internal page a bare keyword refers to, or null. */
function keywordUrl(input) {
  const word = String(input || '').trim().toLowerCase().replace(/\/+$/, '')
  return KEYWORDS.get(word) || null
}

const EXPLICIT_URL = /^[a-z][a-z0-9+.-]*:\/\//i
const EMBER_SCHEME = /^(ember|about|data|blob):/i
const LOCALHOST = /^localhost(:\d+)?(\/|$)/i
// bare domain: has a dot, no spaces, plausible TLD
const BARE_DOMAIN = /^[^\s/]+\.[a-z]{2,}([/:?#].*)?$/i

// Building a table costs a little and the same list is asked about on every
// keystroke, so hold on to the last one rather than rebuilding it each time.
let defaultTable = null
let cachedSource = null
let cachedTable = null

function tableFor(bangs) {
  if (bangs instanceof Map) return bangs
  if (!bangs || !bangs.length) return (defaultTable ||= bangTable([]))
  if (bangs === cachedSource) return cachedTable
  cachedSource = bangs
  cachedTable = bangTable(bangs)
  return cachedTable
}

/**
 * Work out what omnibox input means, without acting on it.
 *
 * The omnibox uses this to show what pressing Enter will do while you are
 * still typing, and the main process uses it to actually navigate — one
 * function, so the preview can never disagree with the outcome.
 *
 * @param {string} input
 * @param {{ bangs?: Map|Array }} [options] the user's bang list, or a built table
 * @returns {{ kind: string, url: string, input: string, alias?: string, term?: string, name?: string }|null}
 */
function resolveInput(input, { bangs } = {}) {
  const raw = String(input || '').trim()
  if (!raw) return null
  if (EXPLICIT_URL.test(raw) || EMBER_SCHEME.test(raw)) return { kind: INPUT.URL, url: raw, input: raw }

  const bang = resolveBang(raw, tableFor(bangs))
  const asBang = () => ({
    kind: INPUT.BANG,
    url: bang.url,
    input: raw,
    alias: bang.alias,
    term: bang.term,
    name: bang.entry.name || bang.alias,
  })

  // An explicit ! outranks an internal page name. A bare keyword does not, so
  // typing "history" still opens Ember's own history page.
  const words = raw.split(/\s+/)
  if (bang && (words[0].startsWith(BANG_PREFIX) || words.at(-1).startsWith(BANG_PREFIX))) return asBang()

  const keyword = keywordUrl(raw)
  if (keyword) return { kind: INPUT.KEYWORD, url: keyword, input: raw }

  // A host Ember can actually reach beats a shortcut someone named after it.
  if (LOCALHOST.test(raw)) return { kind: INPUT.SITE, url: `http://${raw}`, input: raw }

  if (bang) return asBang()

  if (!/\s/.test(raw) && BARE_DOMAIN.test(raw)) return { kind: INPUT.SITE, url: `https://${raw}`, input: raw }
  return { kind: INPUT.SEARCH, url: SEARCH_URL + encodeURIComponent(raw), input: raw }
}

/** Where omnibox input should navigate to, or null when there is nothing to do. */
function toNavigationUrl(input, options = {}) {
  return resolveInput(input, options)?.url || null
}

function displayUrl(url) {
  if (!url || url === 'about:blank') return ''
  if (url.startsWith('ember://')) return ''
  return url
}

module.exports = { resolveInput, toNavigationUrl, displayUrl, keywordUrl, KEYWORDS, INPUT }
