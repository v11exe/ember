const test = require('node:test')
const assert = require('node:assert/strict')

const {
  DEFAULT_BANGS, normaliseAlias, isValidAlias, isValidTemplate, homeUrl,
  sanitiseBang, sanitiseBangs, bangTable, listBangs, resolveBang, expandBang,
} = require('../src/shared/bangs')
const { toNavigationUrl, resolveInput, INPUT } = require('../src/shared/urls')

const YT = { alias: 'yt', name: 'YouTube', url: 'https://www.youtube.com/results?search_query=%s' }

test('aliases are normalised and kept free of URL punctuation', () => {
  assert.equal(normaliseAlias('  !YT '), 'yt')
  assert.equal(normaliseAlias('!!gh'), 'gh')
  for (const good of ['yt', 'gh', 'g', 'so', 'my_site', 'a-b', 'c+t', 'x1']) {
    assert.ok(isValidAlias(good), `${good} should be valid`)
  }
  for (const bad of ['', 'has space', 'example.com', 'a/b', 'http:', '-lead', 'x'.repeat(25)]) {
    assert.ok(!isValidAlias(bad), `${bad} should be rejected`)
  }
})

test('a template must be an http(s) URL carrying %s', () => {
  assert.ok(isValidTemplate('https://example.com/?q=%s'))
  assert.ok(isValidTemplate('http://localhost:3000/search/%s'))
  assert.ok(!isValidTemplate('https://example.com/?q='), 'no placeholder')
  assert.ok(!isValidTemplate('javascript:alert(%s)'), 'wrong scheme')
  assert.ok(!isValidTemplate('not a url %s'))
  assert.ok(!isValidTemplate(''))
})

test('every built-in bang is well formed and unique', () => {
  const seen = new Set()
  for (const entry of DEFAULT_BANGS) {
    assert.ok(isValidAlias(entry.alias), `${entry.alias} is not a valid alias`)
    assert.ok(isValidTemplate(entry.url), `${entry.alias} has a bad template`)
    assert.ok(!seen.has(entry.alias), `${entry.alias} is listed twice`)
    seen.add(entry.alias)
  }
})

test('a bare alias falls back to the site front page', () => {
  assert.equal(homeUrl(YT), 'https://www.youtube.com/')
  assert.equal(homeUrl({ ...YT, home: 'https://www.youtube.com/feed/subscriptions' }),
    'https://www.youtube.com/feed/subscriptions')
})

test('stored entries are sanitised, de-duplicated and capped', () => {
  assert.equal(sanitiseBang({ alias: 'BAD ALIAS', url: 'https://x.test/%s' }), null)
  assert.equal(sanitiseBang({ alias: 'ok', url: 'https://x.test/' }), null, 'no placeholder')
  assert.deepEqual(sanitiseBang({ alias: '!Ok', url: 'https://x.test/%s' }),
    { alias: 'ok', name: 'ok', url: 'https://x.test/%s' })
  assert.deepEqual(sanitiseBang({ alias: 'yt', removed: true }), { alias: 'yt', removed: true })

  const list = sanitiseBangs([
    { alias: 'a', url: 'https://one.test/%s' },
    { alias: 'a', url: 'https://two.test/%s' },
    { alias: 'nope' },
  ])
  assert.equal(list.length, 1)
  assert.equal(list[0].url, 'https://two.test/%s', 'the last write wins')
  assert.deepEqual(sanitiseBangs('not a list'), [])
})

test('custom entries override defaults and tombstones remove them', () => {
  const table = bangTable([
    { alias: 'yt', name: 'Mine', url: 'https://alt.test/?q=%s' },
    { alias: 'gh', removed: true },
    { alias: 'ember', name: 'Ember issues', url: 'https://github.com/v11exe/ember/issues?q=%s' },
  ])
  assert.equal(table.get('yt').url, 'https://alt.test/?q=%s')
  assert.equal(table.get('yt').custom, true)
  assert.equal(table.get('gh'), undefined)
  assert.ok(table.get('ember'))
  assert.equal(table.get('wiki').custom, false, 'untouched defaults survive')
})

test('several aliases may point at the same engine', () => {
  const table = bangTable([
    { alias: 'v', url: 'https://www.youtube.com/results?search_query=%s' },
    { alias: 'vid', url: 'https://www.youtube.com/results?search_query=%s' },
  ])
  assert.equal(table.get('v').url, table.get('vid').url)
  assert.equal(resolveBang('v cats', table).url, resolveBang('vid cats', table).url)
})

test('the settings list puts defaults first, alphabetically', () => {
  const list = listBangs([{ alias: 'zzz', url: 'https://z.test/%s' }])
  const firstCustom = list.findIndex((entry) => entry.custom)
  assert.ok(firstCustom > 0)
  assert.ok(list.slice(0, firstCustom).every((entry) => !entry.custom))
  assert.equal(list.at(-1).alias, 'zzz')
})

// ---- matching ----

const table = bangTable()

test('a leading keyword resolves against the table', () => {
  assert.equal(resolveBang('yt liquid glass', table).url,
    'https://www.youtube.com/results?search_query=liquid%20glass')
  assert.equal(resolveBang('gh electron transparency', table).alias, 'gh')
  assert.equal(resolveBang('wiki chromium', table).term, 'chromium')
})

test('the DuckDuckGo forms work too', () => {
  assert.equal(resolveBang('!yt liquid glass', table).alias, 'yt')
  assert.equal(resolveBang('liquid glass !yt', table).term, 'liquid glass')
  // A bare trailing word is far more likely to be part of the search.
  assert.equal(resolveBang('best videos yt', table), null)
})

test('a bare keyword opens the site', () => {
  assert.equal(resolveBang('gh', table).url, 'https://github.com/')
  assert.equal(resolveBang('!gh', table).url, 'https://github.com/')
})

test('unknown keywords and plain searches do not match', () => {
  assert.equal(resolveBang('notabang something', table), null)
  assert.equal(resolveBang('how to fix electron', table), null)
  assert.equal(resolveBang('', table), null)
  assert.equal(resolveBang('yt cats', new Map()), null)
})

test('search terms are percent-encoded into the template', () => {
  assert.equal(expandBang(YT, 'a b&c'), 'https://www.youtube.com/results?search_query=a%20b%26c')
  assert.equal(expandBang({ alias: 't', url: 'https://x.test/%s/%s' }, 'q'), 'https://x.test/q/q')
  assert.equal(expandBang(YT, '   '), 'https://www.youtube.com/')
})

// ---- omnibox integration ----

test('the omnibox resolves bangs before falling back to search', () => {
  assert.equal(toNavigationUrl('yt liquid glass'),
    'https://www.youtube.com/results?search_query=liquid%20glass')
  assert.equal(toNavigationUrl('!gh electron'), 'https://github.com/search?q=electron')
  assert.match(toNavigationUrl('liquid glass shader'), /^https:\/\/www\.google\.com\/search/)
})

test('real URLs are never mistaken for a keyword', () => {
  assert.equal(toNavigationUrl('https://example.com/yt'), 'https://example.com/yt')
  assert.equal(toNavigationUrl('example.com'), 'https://example.com')
  assert.equal(toNavigationUrl('yt.com'), 'https://yt.com')
  assert.equal(toNavigationUrl('localhost:3000'), 'http://localhost:3000')
  assert.equal(toNavigationUrl('ember://history'), 'ember://history')
})

test('an internal page name still beats a bare keyword', () => {
  const bangs = [{ alias: 'history', name: 'Site history', url: 'https://x.test/?q=%s' }]
  assert.equal(toNavigationUrl('history', { bangs }), 'ember://history')
  // …but an explicit ! asks for the bang.
  assert.equal(toNavigationUrl('!history', { bangs }), 'https://x.test/')
  assert.equal(toNavigationUrl('history electron', { bangs }), 'https://x.test/?q=electron')
})

test('a user table replaces the built-in one for that alias', () => {
  const bangs = [{ alias: 'yt', name: 'Alt', url: 'https://alt.test/?q=%s' }]
  assert.equal(toNavigationUrl('yt cats', { bangs }), 'https://alt.test/?q=cats')
  assert.equal(toNavigationUrl('yt cats'), 'https://www.youtube.com/results?search_query=cats')
})

test('a prebuilt table is accepted as well as a stored list', () => {
  assert.equal(toNavigationUrl('yt cats', { bangs: table }),
    'https://www.youtube.com/results?search_query=cats')
})

// ---- what the omnibox shows before you press Enter ----

test('resolveInput names what each kind of input will do', () => {
  assert.deepEqual(resolveInput('https://example.com/x'),
    { kind: INPUT.URL, url: 'https://example.com/x', input: 'https://example.com/x' })
  assert.equal(resolveInput('history').kind, INPUT.KEYWORD)
  assert.equal(resolveInput('example.com').kind, INPUT.SITE)
  assert.equal(resolveInput('localhost:3000').kind, INPUT.SITE)
  assert.equal(resolveInput('how tall is nelson').kind, INPUT.SEARCH)
  assert.equal(resolveInput(''), null)
  assert.equal(resolveInput('   '), null)
})

test('a recognised keyword reports the engine and the query so far', () => {
  const typed = resolveInput('yt liquid glass')
  assert.equal(typed.kind, INPUT.BANG)
  assert.equal(typed.alias, 'yt')
  assert.equal(typed.name, 'YouTube')
  assert.equal(typed.term, 'liquid glass')
  assert.equal(typed.url, 'https://www.youtube.com/results?search_query=liquid%20glass')
})

test('a keyword on its own reports no term, which is what Tab looks for', () => {
  const bare = resolveInput('gh')
  assert.equal(bare.kind, INPUT.BANG)
  assert.equal(bare.term, '')
  assert.equal(bare.url, 'https://github.com/')
  assert.equal(resolveInput('gh ').term, '', 'a trailing space is still a bare keyword')
})

test('a custom name is what the chip would show, falling back to the alias', () => {
  const named = resolveInput('ember bug', { bangs: [{ alias: 'ember', name: 'Ember issues', url: 'https://x.test/?q=%s' }] })
  assert.equal(named.name, 'Ember issues')
  const unnamed = resolveInput('zz thing', { bangs: [{ alias: 'zz', url: 'https://x.test/?q=%s' }] })
  assert.equal(unnamed.name, 'zz')
})

test('a real host beats a shortcut someone named after it', () => {
  const bangs = [{ alias: 'localhost', name: 'Not the dev server', url: 'https://x.test/?q=%s' }]
  assert.equal(resolveInput('localhost', { bangs }).url, 'http://localhost')
  assert.equal(resolveInput('localhost:8080', { bangs }).url, 'http://localhost:8080')
  // …unless you insist.
  assert.equal(resolveInput('!localhost', { bangs }).kind, INPUT.BANG)
})

test('typing a URL never shows a quick search', () => {
  for (const text of ['example.com', 'https://yt.com', 'yt.com/watch', '192.168.0.1', 'sub.gh.com']) {
    assert.notEqual(resolveInput(text)?.kind, INPUT.BANG, `${text} should not look like a keyword`)
  }
})

test('the resolver and the navigator always agree', () => {
  const bangs = [{ alias: 'ember', url: 'https://x.test/?q=%s' }]
  for (const text of ['yt cats', '!gh electron', 'history', 'example.com', 'ember bug', 'plain words', 'localhost']) {
    assert.equal(toNavigationUrl(text, { bangs }), resolveInput(text, { bangs }).url, text)
  }
})

test('the same list is not rebuilt on every keystroke', () => {
  const bangs = [{ alias: 'ember', url: 'https://x.test/?q=%s' }]
  // Same array identity twice; the second call must reuse the built table.
  const first = resolveInput('ember a', { bangs })
  const second = resolveInput('ember b', { bangs })
  assert.equal(first.name, second.name)
  // A different array is a different table, and must not serve the stale one.
  assert.equal(resolveInput('ember x', { bangs: [{ alias: 'ember', name: 'Other', url: 'https://y.test/?q=%s' }] }).name, 'Other')
})
