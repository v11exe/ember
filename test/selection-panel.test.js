const test = require('node:test')
const assert = require('node:assert/strict')

const { SelectionPanel, PANEL_WIDTH } = require('../src/main/selection-panel')
const { RateStore } = require('../src/main/rates')
const { CONVERSION_DEFAULTS } = require('../src/shared/conversions')

const PAGE = { x: 0, y: 84, width: 1000, height: 700 }

function stubOverlay() {
  return {
    shown: [],
    visible: false,
    sender: { id: 'overlay' },
    async show(options) { this.shown.push(options); this.visible = true; return true },
    async relayout(options) { this.shown.push({ ...options, relayout: true }); return true },
    hide() { this.visible = false },
    isSender(webContents) { return webContents === this.sender },
  }
}

function stubTab() {
  return { id: 1, view: { getBounds: () => ({ ...PAGE }) } }
}

function panelWith(overrides = {}) {
  const overlay = stubOverlay()
  const copied = []
  const panel = new SelectionPanel({}, {
    overlay,
    clipboard: { writeText: (value) => copied.push(value) },
    prefs: () => ({ ...CONVERSION_DEFAULTS, timeZone: 'Europe/London' }),
    ...overrides,
  })
  return { panel, overlay, copied }
}

test('a recognised selection opens the popup above it', async () => {
  const { panel, overlay } = panelWith()
  const opened = await panel.update({ tab: stubTab(), text: '15 miles', rect: { x: 120, y: 200, width: 70, height: 18 } })

  assert.equal(opened, true)
  assert.equal(overlay.shown.length, 1)
  const { bounds, state } = overlay.shown[0]
  assert.equal(state.kind, 'conversion')
  assert.equal(state.from, '15 mi')
  assert.equal(state.to, '24.1 km')
  assert.equal(bounds.width, PANEL_WIDTH)
  assert.equal(bounds.x, 120)
  assert.equal(bounds.y + bounds.height, PAGE.y + 200 - 8, 'sits just above the selection')
})

test('a selection at the very top drops below rather than off the page', async () => {
  const { panel, overlay } = panelWith()
  await panel.update({ tab: stubTab(), text: '15 miles', rect: { x: 10, y: 2, width: 70, height: 18 } })
  const { bounds } = overlay.shown[0]
  assert.ok(bounds.y >= PAGE.y + 2 + 18, 'clear of the selection, not on top of it')
  assert.ok(bounds.y + bounds.height <= PAGE.y + PAGE.height)
})

test('the popup is clamped inside the page view', async () => {
  const { panel, overlay } = panelWith()
  await panel.update({ tab: stubTab(), text: '15 miles', rect: { x: 980, y: 200, width: 40, height: 18 } })
  const { bounds } = overlay.shown[0]
  assert.ok(bounds.x + bounds.width <= PAGE.x + PAGE.width)
})

test('an unrecognised or empty selection closes whatever is open', async () => {
  const { panel, overlay } = panelWith()
  await panel.update({ tab: stubTab(), text: '15 miles', rect: { x: 10, y: 10, width: 40, height: 18 } })
  assert.equal(overlay.visible, true)

  await panel.update({ tab: stubTab(), text: 'the quick brown fox', rect: { x: 10, y: 10, width: 40, height: 18 } })
  assert.equal(overlay.visible, false)
  assert.equal(panel.open, false)
})

test('conversions switched off never open the popup', async () => {
  const { panel, overlay } = panelWith({ prefs: () => ({ ...CONVERSION_DEFAULTS, enabled: false }) })
  await panel.update({ tab: stubTab(), text: '15 miles', rect: { x: 10, y: 10, width: 40, height: 18 } })
  assert.equal(overlay.shown.length, 0)
})

test('only a currency selection reaches for exchange rates', async () => {
  let asked = 0
  const rates = { ensure: async () => { asked += 1; return { base: 'EUR', date: '2026-08-21', rates: { USD: 1.1, GBP: 0.85 } } } }
  const { panel, overlay } = panelWith({ rates })

  await panel.update({ tab: stubTab(), text: '15 miles', rect: { x: 10, y: 10, width: 40, height: 18 } })
  assert.equal(asked, 0, 'a distance needs no network')

  await panel.update({ tab: stubTab(), text: '$79.99', rect: { x: 10, y: 10, width: 40, height: 18 } })
  assert.equal(asked, 1)
  assert.equal(overlay.shown.at(-1).state.to, '£61.81')
})

test('copy puts the converted value on the clipboard and closes', async () => {
  const { panel, overlay, copied } = panelWith()
  await panel.update({ tab: stubTab(), text: '15 miles', rect: { x: 10, y: 10, width: 40, height: 18 } })
  assert.equal(panel.handleAction(overlay.sender, 'copy'), true)
  assert.deepEqual(copied, ['24.1 km'])
  assert.equal(panel.open, false)
})

test('actions from anything but the popup are ignored', async () => {
  const { panel, overlay, copied } = panelWith()
  await panel.update({ tab: stubTab(), text: '15 miles', rect: { x: 10, y: 10, width: 40, height: 18 } })
  assert.equal(panel.handleAction({ id: 'somewhere else' }, 'copy'), false)
  assert.deepEqual(copied, [])
})

test('a stale selection loses to the one that replaced it', async () => {
  let release
  const gate = new Promise((resolve) => { release = resolve })
  const rates = { ensure: () => gate.then(() => ({ base: 'EUR', rates: { USD: 1.1, GBP: 0.85 } })) }
  const { panel, overlay } = panelWith({ rates })

  const slow = panel.update({ tab: stubTab(), text: '$10', rect: { x: 10, y: 10, width: 40, height: 18 } })
  await panel.update({ tab: stubTab(), text: '15 miles', rect: { x: 10, y: 10, width: 40, height: 18 } })
  release()
  assert.equal(await slow, false, 'the overtaken currency lookup gives up')
  assert.equal(overlay.shown.length, 1)
  assert.equal(overlay.shown[0].state.to, '24.1 km')
})

// ---- rates ----

function rateStore(responses, { now = () => 1_000_000 } = {}) {
  let call = 0
  const fetches = []
  const store = new RateStore(require('node:path').join(require('node:os').tmpdir(), `ember-rates-${process.pid}-${Math.random()}.json`), {
    now,
    fetch: async (url) => { fetches.push(url); return responses[Math.min(call++, responses.length - 1)] },
  })
  return { store, fetches }
}

const OK = {
  ok: true,
  json: async () => ({ amount: 1, base: 'EUR', date: '2026-08-21', rates: { GBP: 0.85, USD: 1.1 } }),
}

test('rates are fetched once and then served from memory', async () => {
  const { store, fetches } = rateStore([OK])
  const first = await store.ensure()
  assert.equal(first.base, 'EUR')
  assert.equal(first.rates.GBP, 0.85)
  await store.ensure()
  assert.equal(fetches.length, 1)
})

test('concurrent lookups share one request', async () => {
  const { store, fetches } = rateStore([OK])
  await Promise.all([store.ensure(), store.ensure(), store.ensure()])
  assert.equal(fetches.length, 1)
})

test('a failed fetch leaves the popup with nothing rather than throwing', async () => {
  const { store } = rateStore([{ ok: false, json: async () => ({}) }])
  assert.equal(await store.ensure(), null)

  const { store: broken } = rateStore([{ ok: true, json: async () => ({ base: 'EUR' }) }])
  assert.equal(await broken.ensure(), null)
})

test('a stale cache is refreshed', async () => {
  let clock = 1_000_000
  const { store, fetches } = rateStore([OK], { now: () => clock })
  await store.ensure()
  clock += 13 * 60 * 60 * 1000
  assert.equal(store.fresh, false)
  await store.ensure()
  assert.equal(fetches.length, 2)
})
