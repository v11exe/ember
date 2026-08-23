const test = require('node:test')
const assert = require('node:assert/strict')

const {
  HibernationManager, HIBERNATION_DEFAULTS, MAX_MINUTES, PROBE_CLEAR, PROBE_UNAVAILABLE,
  hostnameOf, sanitiseHibernation, isSleepableUrl, sleepBlockers, shouldHibernate,
  scrollRestoreScript,
} = require('../src/main/hibernation')
const { readHistory, MAX_HISTORY_ENTRIES } = require('../src/main/tabs')
const { buildTabContextMenu } = require('../src/main/context-menu-model')

const MINUTE = 60_000
const NOW = 1_800_000_000_000

/** An idle background tab with nothing holding it awake. */
function idleTab(overrides = {}) {
  return {
    id: 1,
    url: 'https://example.com/page',
    lastActiveAt: NOW - 60 * MINUTE,
    asleep: false,
    active: false,
    ...overrides,
  }
}

const context = { now: NOW, timeoutMs: 30 * MINUTE, enabled: true, neverDomains: [] }

test('hostnameOf drops www and lowercases', () => {
  assert.equal(hostnameOf('https://WWW.Example.com/a?b=c'), 'example.com')
  assert.equal(hostnameOf('https://docs.example.com/'), 'docs.example.com')
  assert.equal(hostnameOf('not a url'), '')
  assert.equal(hostnameOf(undefined), '')
})

test('only http(s) pages are sleepable', () => {
  assert.ok(isSleepableUrl('https://example.com'))
  assert.ok(isSleepableUrl('http://localhost:3000/x'))
  assert.ok(!isSleepableUrl('ember://history'))
  assert.ok(!isSleepableUrl('about:blank'))
  assert.ok(!isSleepableUrl(''))
})

test('an idle background tab hibernates', () => {
  assert.deepEqual(sleepBlockers(idleTab(), context), [])
  assert.ok(shouldHibernate(idleTab(), context))
})

test('a tab younger than the timeout stays awake', () => {
  const tab = idleTab({ lastActiveAt: NOW - 29 * MINUTE })
  assert.deepEqual(sleepBlockers(tab, context), ['recent'])
})

test('every protected category blocks hibernation', () => {
  const cases = {
    active: { active: true },
    visible: { visible: true },
    'never-sleep': { neverSleep: true },
    protected: { protected: true },
    loading: { loading: true },
    audio: { audible: true },
    media: { playingMedia: true },
    capture: { capturing: true },
    download: { downloading: true },
    'unsaved-form': { dirtyForm: true },
    internal: { url: 'ember://history' },
    asleep: { asleep: true },
  }
  for (const [reason, overrides] of Object.entries(cases)) {
    const blockers = sleepBlockers(idleTab(overrides), context)
    assert.ok(blockers.includes(reason), `${reason} should block, got ${blockers.join()}`)
    assert.ok(!shouldHibernate(idleTab(overrides), context))
  }
})

test('the never-sleep domain list matches on the registered host', () => {
  const withDomain = { ...context, neverDomains: ['example.com'] }
  assert.ok(!shouldHibernate(idleTab(), withDomain))
  assert.ok(shouldHibernate(idleTab({ url: 'https://other.test/x' }), withDomain))
  // www is stripped on both sides, subdomains are their own entry
  assert.ok(!shouldHibernate(idleTab({ url: 'https://www.example.com/' }), withDomain))
  assert.ok(shouldHibernate(idleTab({ url: 'https://docs.example.com/' }), withDomain))
})

test('disabling hibernation blocks everything', () => {
  assert.deepEqual(sleepBlockers(idleTab(), { ...context, enabled: false }), ['disabled'])
})

test('settings are clamped and de-duplicated', () => {
  assert.deepEqual(sanitiseHibernation(undefined), HIBERNATION_DEFAULTS)
  assert.equal(sanitiseHibernation({ minutes: 0 }).minutes, 1)
  assert.equal(sanitiseHibernation({ minutes: 10_000 }).minutes, MAX_MINUTES)
  assert.equal(sanitiseHibernation({ minutes: 'nonsense' }).minutes, HIBERNATION_DEFAULTS.minutes)
  assert.equal(sanitiseHibernation({ enabled: false }).enabled, false)
  assert.deepEqual(
    sanitiseHibernation({ neverDomains: [' WWW.Example.com ', 'example.com', '', null] }).neverDomains,
    ['example.com']
  )
  assert.deepEqual(sanitiseHibernation({ neverDomains: 'nope' }).neverDomains, [])
})

// ---- the sweep ----

/** Minimal TabManager stand-in: records what the sweep asked it to discard. */
function stubTabs(tabs, activeId = null) {
  return {
    tabs,
    activeId,
    slept: [],
    async hibernate(id) {
      const tab = tabs.find((candidate) => candidate.id === id)
      if (!tab || tab.asleep) return false
      tab.asleep = true
      this.slept.push(id)
      return true
    },
  }
}

function probingContents(result) {
  return {
    isDestroyed: () => false,
    isCurrentlyAudible: () => false,
    executeJavaScript: async () => result,
  }
}

const CLEAN_PROBE = { playingMedia: false, capturing: false, dirtyForm: false }

test('the sweep discards idle tabs and leaves the active one alone', async () => {
  const tabs = stubTabs([
    { id: 1, url: 'https://a.test/', lastActiveAt: NOW, webContents: probingContents(CLEAN_PROBE) },
    { id: 2, url: 'https://b.test/', lastActiveAt: NOW - 60 * MINUTE, webContents: probingContents(CLEAN_PROBE) },
    { id: 3, url: 'ember://history', lastActiveAt: 0, webContents: probingContents(CLEAN_PROBE) },
  ], 1)
  const manager = new HibernationManager(tabs, { config: () => ({ enabled: true, minutes: 30 }) })
  assert.deepEqual(await manager.sweep(NOW), [2])
})

test('the sweep respects a live probe even when the pure pass allows it', async () => {
  const tabs = stubTabs([
    { id: 1, url: 'https://a.test/', lastActiveAt: 0, webContents: probingContents({ ...CLEAN_PROBE, dirtyForm: true }) },
    { id: 2, url: 'https://b.test/', lastActiveAt: 0, webContents: probingContents({ ...CLEAN_PROBE, capturing: true }) },
    { id: 3, url: 'https://c.test/', lastActiveAt: 0, webContents: probingContents({ ...CLEAN_PROBE, playingMedia: true }) },
  ])
  const manager = new HibernationManager(tabs, { config: () => HIBERNATION_DEFAULTS })
  assert.deepEqual(await manager.sweep(NOW), [])
})

test('an audible tab is never discarded', async () => {
  const tabs = stubTabs([{
    id: 1,
    url: 'https://a.test/',
    lastActiveAt: 0,
    webContents: { ...probingContents(CLEAN_PROBE), isCurrentlyAudible: () => true },
  }])
  const manager = new HibernationManager(tabs, { config: () => HIBERNATION_DEFAULTS })
  assert.deepEqual(await manager.sweep(NOW), [])
})

test('a tab with a download running underneath it is never discarded', async () => {
  const tabs = stubTabs([{ id: 1, url: 'https://a.test/', lastActiveAt: 0, webContents: probingContents(CLEAN_PROBE) }])
  const manager = new HibernationManager(tabs, {
    config: () => HIBERNATION_DEFAULTS,
    isDownloading: () => true,
  })
  assert.deepEqual(await manager.sweep(NOW), [])
})

test('a page that cannot be probed is left alone', async () => {
  const tabs = stubTabs([{
    id: 1,
    url: 'https://a.test/',
    lastActiveAt: 0,
    webContents: { isDestroyed: () => false, isCurrentlyAudible: () => false, executeJavaScript: async () => { throw new Error('gone') } },
  }])
  const manager = new HibernationManager(tabs, { config: () => HIBERNATION_DEFAULTS })
  assert.deepEqual(await manager.sweep(NOW), [])
})

test('the sweep does nothing while hibernation is off', async () => {
  const tabs = stubTabs([{ id: 1, url: 'https://a.test/', lastActiveAt: 0, webContents: probingContents(CLEAN_PROBE) }])
  const manager = new HibernationManager(tabs, { config: () => ({ enabled: false }) })
  assert.deepEqual(await manager.sweep(NOW), [])
})

// ---- the tab context menu ----

test('the tab menu offers sleep controls and toggles their wording', () => {
  const awake = buildTabContextMenu(
    { asleep: false, neverSleep: false, url: 'https://example.com/' },
    { domain: 'example.com', canSleep: true, hasOtherTabs: true }
  )
  const ids = awake.filter((item) => item.type === 'command').map((item) => item.id)
  assert.deepEqual(ids, [
    'tab-reload', 'tab-duplicate', 'tab-sleep', 'tab-never-sleep',
    'tab-never-sleep-domain', 'tab-close-others', 'tab-close',
  ])
  assert.equal(awake.find((item) => item.id === 'tab-never-sleep-domain').label, 'Never sleep example.com')

  const pinned = buildTabContextMenu(
    { asleep: true, neverSleep: true, url: 'https://example.com/' },
    { domain: 'example.com', domainNeverSleeps: true, canSleep: false, hasOtherTabs: false }
  )
  assert.ok(pinned.some((item) => item.id === 'tab-allow-sleep'))
  assert.equal(pinned.find((item) => item.id === 'tab-allow-domain').label, 'Allow example.com to sleep')
  assert.equal(pinned.find((item) => item.id === 'tab-sleep').enabled, false)
  assert.equal(pinned.find((item) => item.id === 'tab-reload').enabled, false)
  assert.equal(pinned.find((item) => item.id === 'tab-close-others').enabled, false)
})

test('the tab menu drops the domain row for an internal page', () => {
  const items = buildTabContextMenu({ url: 'ember://history' }, { domain: '', canSleep: false })
  assert.ok(!items.some((item) => item.id === 'tab-never-sleep-domain' || item.id === 'tab-allow-domain'))
  assert.ok(items.some((item) => item.id === 'tab-close'))
})

// ---- what the page probe reports, and what it blocks ----

test('a page that warns before unloading is treated as unsaved work', () => {
  assert.deepEqual(sleepBlockers(idleTab({ warnsOnExit: true }), context), ['warns-on-exit'])
})

test('picture-in-picture and fullscreen keep a background tab awake', () => {
  assert.deepEqual(sleepBlockers(idleTab({ pictureInPicture: true }), context), ['picture-in-picture'])
  assert.deepEqual(sleepBlockers(idleTab({ fullscreen: true }), context), ['fullscreen'])
})

test('the unavailable probe blocks on every count, the clear one on none', () => {
  assert.deepEqual(sleepBlockers({ ...idleTab(), ...PROBE_CLEAR }, context), [])
  const blocked = sleepBlockers({ ...idleTab(), ...PROBE_UNAVAILABLE }, context)
  for (const reason of ['media', 'picture-in-picture', 'fullscreen', 'capture', 'unsaved-form', 'warns-on-exit']) {
    assert.ok(blocked.includes(reason), `${reason} should be assumed`)
  }
})

test('a page that never answers the probe cannot wedge the sweep', async () => {
  const tabs = stubTabs([{
    id: 1,
    url: 'https://a.test/',
    lastActiveAt: 0,
    webContents: {
      isDestroyed: () => false,
      isCurrentlyAudible: () => false,
      executeJavaScript: () => new Promise(() => {}), // never settles
    },
  }])
  const manager = new HibernationManager(tabs, { config: () => HIBERNATION_DEFAULTS, probeTimeout: 30 })
  assert.deepEqual(await manager.sweep(NOW), [], 'the hung page is left alone')
  assert.equal(manager.sweeping, false, 'and the sweep is free to run again')
  // The very next sweep still works, which is the point of the timeout.
  tabs.tabs[0].webContents.executeJavaScript = async () => CLEAN_PROBE
  assert.deepEqual(await manager.sweep(NOW), [1])
})

// ---- putting the reader back where they were ----

test('the scroll script targets the remembered offset and gives up eventually', () => {
  const script = scrollRestoreScript(0, 1500, { timeout: 4000 })
  assert.match(script, /targetY = 1500/)
  assert.match(script, /window\.scrollTo\(targetX, targetY\)/)
  assert.match(script, /performance\.now\(\) > deadline/, 'it stops rather than looping forever')
  for (const event of ['wheel', 'touchstart', 'keydown', 'mousedown']) {
    assert.ok(script.includes(`'${event}'`), `${event} should call the restore off`)
  }
})

test('a zero offset produces a script that does nothing expensive', () => {
  const script = scrollRestoreScript(0, 0)
  assert.match(script, /targetX = 0, targetY = 0/)
})

test('history is captured whole when it is short, and windowed when it is long', () => {
  const historyOf = (count, active) => ({
    getAllEntries: () => Array.from({ length: count }, (_x, i) => ({ url: `https://a.test/${i}`, pageState: 'x' })),
    getActiveIndex: () => active,
  })

  const short = readHistory({ navigationHistory: historyOf(4, 2) })
  assert.equal(short.entries.length, 4)
  assert.equal(short.index, 2)

  const long = readHistory({ navigationHistory: historyOf(120, 100) })
  assert.equal(long.entries.length, MAX_HISTORY_ENTRIES)
  assert.equal(long.entries[long.index].url, 'https://a.test/100', 'the reader stays on their own entry')

  const atTheEnd = readHistory({ navigationHistory: historyOf(120, 119) })
  assert.equal(atTheEnd.entries[atTheEnd.index].url, 'https://a.test/119')
})

test('a tab with no history, or one that throws, simply has none', () => {
  assert.equal(readHistory({ navigationHistory: { getAllEntries: () => [], getActiveIndex: () => 0 } }), null)
  assert.equal(readHistory({ navigationHistory: { getAllEntries: () => { throw new Error('gone') } } }), null)
  assert.equal(readHistory({}), null)
})
