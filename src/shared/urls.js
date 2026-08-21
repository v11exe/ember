const { SEARCH_URL } = require('./ipc')

// Decide whether omnibox input is a navigable URL or a search query.
function toNavigationUrl(input) {
  const raw = String(input || '').trim()
  if (!raw) return null
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || /^(ember|about|data|blob):/i.test(raw)) return raw
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

module.exports = { toNavigationUrl, displayUrl }
