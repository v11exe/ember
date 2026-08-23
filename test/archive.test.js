const test = require('node:test')
const assert = require('node:assert/strict')

const {
  ABORTED, isDeadStatus, isNetworkFailure, describeFailure, isArchivable,
  availabilityUrl, pickSnapshot, describeTimestamp,
} = require('../src/shared/archive')
const { ArchiveLookup } = require('../src/main/archive')
const { buildContextMenu } = require('../src/main/context-menu-model')

test('only a genuinely gone status counts as dead', () => {
  assert.ok(isDeadStatus(404))
  assert.ok(isDeadStatus(410))
  for (const status of [200, 204, 301, 403, 500, 503, undefined]) {
    assert.ok(!isDeadStatus(status), `${status} should not be treated as gone`)
  }
})

test('an aborted load is not a failure worth replacing', () => {
  assert.ok(isNetworkFailure(-105))
  assert.ok(isNetworkFailure(-106))
  assert.ok(!isNetworkFailure(ABORTED), 'the reader cancelled it')
  assert.ok(!isNetworkFailure(0))
  assert.ok(!isNetworkFailure(undefined))
})

test('failures are described in plain English, with a fallback', () => {
  assert.match(describeFailure(-105), /address could not be found/i)
  assert.equal(describeFailure(-9999, 'ERR_MADE_UP'), 'ERR_MADE_UP')
  assert.match(describeFailure(-9999), /could not be reached/i)
})

test('only public web pages have archived copies', () => {
  assert.ok(isArchivable('https://example.com/page'))
  assert.ok(isArchivable('http://news.example.co.uk/'))
  for (const url of [
    'ember://history', 'file:///c:/tmp/x.html', 'about:blank',
    'http://localhost:3000/', 'http://127.0.0.1/', 'http://192.168.1.4/',
    'https://intranet/', 'not a url', '',
  ]) {
    assert.ok(!isArchivable(url), `${url} should not be looked up`)
  }
})

test('the availability query carries the url and an optional timestamp', () => {
  const plain = new URL(availabilityUrl('https://example.com/a b'))
  assert.equal(plain.origin + plain.pathname, 'https://archive.org/wayback/available')
  assert.equal(plain.searchParams.get('url'), 'https://example.com/a b')
  assert.equal(plain.searchParams.get('timestamp'), null)
  assert.equal(new URL(availabilityUrl('https://example.com', '20200101')).searchParams.get('timestamp'), '20200101')
})

test('a usable snapshot is recognised, and an unusable one is not', () => {
  const good = pickSnapshot({
    archived_snapshots: {
      closest: { available: true, url: 'http://web.archive.org/web/20260101/https://example.com', timestamp: '20260101120000', status: '200' },
    },
  })
  assert.equal(good.url, 'https://web.archive.org/web/20260101/https://example.com', 'upgraded to https')
  assert.equal(good.timestamp, '20260101120000')

  assert.equal(pickSnapshot({ archived_snapshots: {} }), null)
  assert.equal(pickSnapshot({ archived_snapshots: { closest: { available: false } } }), null)
  assert.equal(pickSnapshot({
    archived_snapshots: { closest: { available: true, url: 'https://web.archive.org/web/1/x', status: '404' } },
  }), null, 'the archive records failed captures too')
  assert.equal(pickSnapshot({
    archived_snapshots: { closest: { available: true, url: 'https://elsewhere.test/x' } },
  }), null, 'only web.archive.org counts')
  assert.equal(pickSnapshot(null), null)
})

test('a snapshot timestamp reads as a date', () => {
  assert.equal(describeTimestamp('20260821143000'), '21 August 2026')
  assert.equal(describeTimestamp('nonsense'), '')
  assert.equal(describeTimestamp(''), '')
})

test('the page menu offers the archive only for archivable pages', () => {
  const offered = buildContextMenu({}, { archivable: true })
  assert.ok(offered.some((item) => item.id === 'view-archived'))
  const withheld = buildContextMenu({}, { archivable: false })
  assert.ok(!withheld.some((item) => item.id === 'view-archived'))
})

// ---- the lookup ----

function lookupWith(responses) {
  const calls = []
  let index = 0
  const archive = new ArchiveLookup({
    fetch: async (url) => { calls.push(url); return responses[Math.min(index++, responses.length - 1)] },
  })
  return { archive, calls }
}

const FOUND = {
  ok: true,
  json: async () => ({
    archived_snapshots: {
      closest: { available: true, url: 'https://web.archive.org/web/20260101/https://example.com', timestamp: '20260101', status: '200' },
    },
  }),
}
const MISSING = { ok: true, json: async () => ({ archived_snapshots: {} }) }

test('a found snapshot is returned and remembered', async () => {
  const { archive, calls } = lookupWith([FOUND])
  const first = await archive.find('https://example.com')
  assert.equal(first.url, 'https://web.archive.org/web/20260101/https://example.com')
  await archive.find('https://example.com')
  assert.equal(calls.length, 1, 'the second ask comes from the cache')
})

test('a missing snapshot is remembered too, so we stop asking', async () => {
  const { archive, calls } = lookupWith([MISSING])
  assert.equal(await archive.find('https://example.com'), null)
  assert.equal(await archive.find('https://example.com'), null)
  assert.equal(calls.length, 1)
})

test('concurrent lookups of the same page share one request', async () => {
  const { archive, calls } = lookupWith([FOUND])
  await Promise.all([archive.find('https://example.com'), archive.find('https://example.com')])
  assert.equal(calls.length, 1)
})

test('a page that was never crawlable is not looked up at all', async () => {
  const { archive, calls } = lookupWith([FOUND])
  assert.equal(await archive.find('http://localhost:3000/'), null)
  assert.equal(await archive.find('ember://history'), null)
  assert.deepEqual(calls, [])
})

test('a failed request is not cached, so the next attempt tries again', async () => {
  let attempt = 0
  const archive = new ArchiveLookup({
    fetch: async () => {
      attempt += 1
      if (attempt === 1) throw new Error('offline')
      return FOUND
    },
  })
  assert.equal(await archive.find('https://example.com'), null)
  assert.ok(await archive.find('https://example.com'))
  assert.equal(attempt, 2)
})
