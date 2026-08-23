// Bangs — site-specific searches typed straight into the omnibox.
//
//   yt liquid glass      -> YouTube results
//   !gh electron         -> GitHub code search
//   wiki chromium        -> Wikipedia
//   gh                   -> github.com
//
// Two conventions are merged deliberately. Safari and Orion call these Quick
// Searches and take a bare keyword; DuckDuckGo and Kagi prefix them with `!`.
// Ember accepts both, because the bare form is faster and the `!` form is what
// people paste out of habit.
//
// The template placeholder is `%s`, the Firefox/Safari spelling, rather than
// Chromium's `{searchTerms}` — shorter to type in the settings page.
//
// Everything here is pure so the whole table can be tested without a window.

const BANG_PREFIX = '!'
const PLACEHOLDER = '%s'
const MAX_CUSTOM = 200

/**
 * Aliases are deliberately narrow: no dot, slash, colon or space, so a real URL
 * can never be read as one. That is the rule that keeps `example.com` a site
 * and `gh` a bang.
 */
const ALIAS_PATTERN = /^[a-z0-9][a-z0-9_+-]{0,23}$/

/** A small, opinionated starting set. Users add their own on top. */
const DEFAULT_BANGS = [
  { alias: 'g', name: 'Google', url: 'https://www.google.com/search?q=%s' },
  { alias: 'yt', name: 'YouTube', url: 'https://www.youtube.com/results?search_query=%s' },
  { alias: 'gh', name: 'GitHub', url: 'https://github.com/search?q=%s' },
  { alias: 'wiki', name: 'Wikipedia', url: 'https://en.wikipedia.org/w/index.php?search=%s' },
  { alias: 'r', name: 'Reddit', url: 'https://www.reddit.com/search/?q=%s' },
  { alias: 'so', name: 'Stack Overflow', url: 'https://stackoverflow.com/search?q=%s' },
  { alias: 'mdn', name: 'MDN', url: 'https://developer.mozilla.org/en-US/search?q=%s' },
  { alias: 'npm', name: 'npm', url: 'https://www.npmjs.com/search?q=%s' },
  { alias: 'maps', name: 'Google Maps', url: 'https://www.google.com/maps/search/%s' },
  { alias: 'img', name: 'Google Images', url: 'https://www.google.com/search?tbm=isch&q=%s' },
  { alias: 'a', name: 'Amazon', url: 'https://www.amazon.co.uk/s?k=%s' },
  { alias: 'imdb', name: 'IMDb', url: 'https://www.imdb.com/find/?q=%s' },
  { alias: 'tr', name: 'Google Translate', url: 'https://translate.google.com/?text=%s' },
  { alias: 'x', name: 'X', url: 'https://x.com/search?q=%s' },
  { alias: 'w', name: 'Wolfram Alpha', url: 'https://www.wolframalpha.com/input?i=%s' },
  { alias: 'ddg', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
]

function normaliseAlias(value) {
  return String(value || '').trim().toLowerCase().replace(/^!+/, '')
}

function isValidAlias(value) {
  return ALIAS_PATTERN.test(normaliseAlias(value))
}

/** A template is usable only if it is an http(s) URL carrying the placeholder. */
function isValidTemplate(value) {
  const url = String(value || '').trim()
  if (!url.includes(PLACEHOLDER)) return false
  try {
    return /^https?:$/.test(new URL(url.replace(PLACEHOLDER, 'x')).protocol)
  } catch {
    return false
  }
}

/** Where a bare alias with no search term goes. */
function homeUrl(entry) {
  if (entry.home) return entry.home
  try {
    return new URL(entry.url.replace(PLACEHOLDER, '')).origin + '/'
  } catch {
    return null
  }
}

function sanitiseBang(value) {
  const alias = normaliseAlias(value?.alias)
  const url = String(value?.url || '').trim()
  if (!isValidAlias(alias)) return null
  // A removal tombstone hides a default without needing a template.
  if (value?.removed) return { alias, removed: true }
  if (!isValidTemplate(url)) return null
  const home = String(value?.home || '').trim()
  return {
    alias,
    name: String(value?.name || '').trim().slice(0, 60) || alias,
    url,
    ...(/^https?:\/\//i.test(home) ? { home } : {}),
  }
}

/** The stored user list: additions, overrides and removals, last one wins. */
function sanitiseBangs(value) {
  const list = Array.isArray(value) ? value : []
  const byAlias = new Map()
  for (const entry of list) {
    const clean = sanitiseBang(entry)
    if (clean) byAlias.set(clean.alias, clean)
  }
  return [...byAlias.values()].slice(0, MAX_CUSTOM)
}

/**
 * Defaults overlaid with the user's list. Custom entries replace a default of
 * the same alias; a tombstone removes it. Several aliases may point at the same
 * engine — nothing here deduplicates by URL.
 *
 * @returns {Map<string, { alias: string, name: string, url: string, custom: boolean }>}
 */
function bangTable(custom = [], defaults = DEFAULT_BANGS) {
  const table = new Map()
  for (const entry of defaults) table.set(entry.alias, { ...entry, custom: false })
  for (const entry of sanitiseBangs(custom)) {
    if (entry.removed) table.delete(entry.alias)
    else table.set(entry.alias, { ...entry, custom: true })
  }
  return table
}

/** The full list the settings page renders, defaults first, alphabetical. */
function listBangs(custom = [], defaults = DEFAULT_BANGS) {
  return [...bangTable(custom, defaults).values()]
    .sort((a, b) => Number(a.custom) - Number(b.custom) || a.alias.localeCompare(b.alias))
}

/**
 * Match omnibox input against the table.
 *
 * The keyword has to be the first word. DuckDuckGo also accepts a trailing
 * `!bang`, so that form is honoured too — but only with the `!`, because a
 * bare trailing word is far more likely to be part of the search.
 *
 * @returns {{ alias: string, term: string, entry: object, url: string }|null}
 */
function resolveBang(input, table) {
  const raw = String(input || '').trim()
  if (!raw || !table?.size) return null

  const words = raw.split(/\s+/)
  const head = words[0]
  const tail = words.length > 1 ? words.at(-1) : ''

  let alias = null
  let term = ''
  if (head.startsWith(BANG_PREFIX)) {
    alias = normaliseAlias(head)
    term = words.slice(1).join(' ')
  } else if (tail.startsWith(BANG_PREFIX)) {
    alias = normaliseAlias(tail)
    term = words.slice(0, -1).join(' ')
  } else {
    alias = normaliseAlias(head)
    term = words.slice(1).join(' ')
  }

  const entry = alias && table.get(alias)
  if (!entry) return null
  const url = expandBang(entry, term)
  return url ? { alias, term, entry, url } : null
}

/** Fill the template, or fall back to the site's front page. */
function expandBang(entry, term) {
  const query = String(term || '').trim()
  if (!query) return homeUrl(entry)
  return entry.url.split(PLACEHOLDER).join(encodeURIComponent(query))
}

module.exports = {
  BANG_PREFIX,
  PLACEHOLDER,
  MAX_CUSTOM,
  ALIAS_PATTERN,
  DEFAULT_BANGS,
  normaliseAlias,
  isValidAlias,
  isValidTemplate,
  homeUrl,
  sanitiseBang,
  sanitiseBangs,
  bangTable,
  listBangs,
  resolveBang,
  expandBang,
}
