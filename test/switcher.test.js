const test = require('node:test')
const assert = require('node:assert/strict')

const { TabSwitcher, panelWidth, hostOf, CARD_WIDTH } = require('../src/main/switcher-panel')
const { resolveShortcut, COMMANDS } = require('../src/main/shortcuts')

const PAGE = { x: 0, y: 84, width: 1200, height: 700 }

function stubOverlay() {
  return {
    shown: [],
    patches: [],
    visible: false,
    sender: { id: 'switcher' },
    async show(options) { this.shown.push(options); this.visible = true; return true },
    patchState(partial) { this.patches.push(partial) },
    hide() { this.visible = false },
    isSender(webContents) { return webContents === this.sender },
  }
}

/** Four tabs, last used in the order c, b, d, with a active. */
function stubTabs() {
  const tabs = [
    { id: 1, title: 'Alpha', url: 'https://alpha.test/', lastActiveAt: 500, favicon: null },
    { id: 2, title: 'Beta', url: 'https://www.beta.test/x', lastActiveAt: 400, favicon: 'b.png' },
    { id: 3, title: 'Gamma', url: 'https://gamma.test/', lastActiveAt: 300, asleep: true },
    { id: 4, title: 'New tab', url: 'ember://newtab', lastActiveAt: 200 },
  ]
  return {
    tabs,
    activeId: 1,
    selected: [],
    active: { view: { getBounds: () => ({ ...PAGE }) } },
    select(id) { this.selected.push(id); this.activeId = id },
  }
}

function switcherWith(thumbnails = null) {
  const overlay = stubOverlay()
  const tabs = stubTabs()
  const switcher = new TabSwitcher({ getContentBounds: () => PAGE }, { tabs, thumbnails, overlay })
  return { switcher, overlay, tabs }
}

test('hostOf strips www and copes with nonsense', () => {
  assert.equal(hostOf('https://www.beta.test/x'), 'beta.test')
  assert.equal(hostOf('https://gamma.test/'), 'gamma.test')
  assert.equal(hostOf('not a url'), '')
})

test('the panel grows with the cards but never past the viewport', () => {
  assert.ok(panelWidth(2, 1200) < panelWidth(4, 1200))
  assert.ok(panelWidth(40, 1200) <= 1200 - 80)
  assert.ok(panelWidth(1, 400) >= CARD_WIDTH)
})

test('the first press lands on the tab you came from', async () => {
  const { switcher, overlay } = switcherWith()
  assert.equal(switcher.step(1), true)
  assert.equal(switcher.open, true)
  await Promise.resolve()
  const { state } = overlay.shown[0]
  assert.equal(state.kind, 'switcher')
  assert.equal(state.index, 1, 'the second entry is the previous tab')
  assert.deepEqual(state.tabs.map((tab) => tab.id), [1, 2, 3, 4], 'active first, then most recent')
  assert.equal(state.tabs[1].domain, 'beta.test')
})

test('shift walks the other way and wraps', async () => {
  const { switcher, overlay } = switcherWith()
  switcher.step(-1)
  await Promise.resolve()
  assert.equal(overlay.shown[0].state.index, 3, 'wraps to the end')
})

test('further presses only send the moved index, not the screenshots again', async () => {
  const { switcher, overlay } = switcherWith()
  switcher.step(1)
  await Promise.resolve()
  switcher.step(1)
  switcher.step(1)
  assert.equal(overlay.shown.length, 1, 'the payload is built once')
  assert.deepEqual(overlay.patches, [{ index: 2 }, { index: 3 }])
})

test('releasing the modifier selects whatever is highlighted', async () => {
  const { switcher, overlay, tabs } = switcherWith()
  switcher.step(1)
  switcher.step(1)
  assert.equal(switcher.commit(), true)
  assert.deepEqual(tabs.selected, [3])
  assert.equal(overlay.visible, false)
  assert.equal(switcher.open, false)
})

test('committing on the tab you are already on changes nothing', () => {
  const { switcher, tabs } = switcherWith()
  switcher.step(1)
  switcher.step(-1) // back to index 0, the active tab
  switcher.commit()
  assert.deepEqual(tabs.selected, [])
})

test('Escape leaves you where you were', () => {
  const { switcher, tabs, overlay } = switcherWith()
  switcher.step(1)
  assert.equal(switcher.cancel(), true)
  assert.deepEqual(tabs.selected, [])
  assert.equal(overlay.visible, false)
  assert.equal(switcher.cancel(), false, 'a second Escape is not the switcher business')
})

test('a lone tab has nothing to switch to', () => {
  const { switcher, tabs } = switcherWith()
  tabs.tabs.length = 1
  assert.equal(switcher.step(1), false)
  assert.equal(switcher.open, false)
})

test('sleeping tabs are listed from their cached screenshot', async () => {
  const thumbnails = { get: (id) => (id === 3 ? { dataUrl: 'data:image/png;base64,shot' } : null) }
  const { switcher, overlay } = switcherWith(thumbnails)
  switcher.step(1)
  await Promise.resolve()
  const gamma = overlay.shown[0].state.tabs.find((tab) => tab.id === 3)
  assert.equal(gamma.asleep, true)
  assert.equal(gamma.thumbnail, 'data:image/png;base64,shot')
  assert.equal(overlay.shown[0].state.tabs[0].thumbnail, null, 'no screenshot yet is fine')
})

test('clicking a card picks it', async () => {
  const { switcher, overlay, tabs } = switcherWith()
  switcher.step(1)
  assert.equal(switcher.handleAction(overlay.sender, 'switch-pick', { id: 4 }), true)
  assert.deepEqual(tabs.selected, [4])
})

test('actions from anything but the switcher are ignored', () => {
  const { switcher, tabs } = switcherWith()
  switcher.step(1)
  assert.equal(switcher.handleAction({ id: 'elsewhere' }, 'switch-pick', { id: 4 }), false)
  assert.deepEqual(tabs.selected, [])
})

// ---- the keys that drive it ----

test('Ctrl+Tab drives the switcher and Ctrl+PageDown still cycles the strip', () => {
  assert.deepEqual(resolveShortcut({ type: 'keyDown', key: 'Tab', control: true }), { command: COMMANDS.NEXT_TAB })
  assert.deepEqual(resolveShortcut({ type: 'keyDown', key: 'Tab', control: true, shift: true }),
    { command: COMMANDS.PREVIOUS_TAB })
  assert.deepEqual(resolveShortcut({ type: 'keyDown', key: 'PageDown', control: true }),
    { command: COMMANDS.NEXT_TAB_STRIP })
  assert.deepEqual(resolveShortcut({ type: 'keyDown', key: 'PageUp', control: true }),
    { command: COMMANDS.PREVIOUS_TAB_STRIP })
})

test('letting go of the modifier is its own command', () => {
  assert.deepEqual(resolveShortcut({ type: 'keyUp', key: 'Control' }), { command: COMMANDS.END_SWITCH })
  assert.deepEqual(resolveShortcut({ type: 'keyUp', key: 'Meta' }), { command: COMMANDS.END_SWITCH })
  assert.equal(resolveShortcut({ type: 'keyUp', key: 'Tab' }), null)
  assert.equal(resolveShortcut({ type: 'char', key: 'a' }), null)
})
