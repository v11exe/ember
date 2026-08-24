const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const { ModifierWatch, VK_CONTROL, POLL_MS } = require('../src/main/key-release')
const { TabSwitcher } = require('../src/main/switcher-panel')

test('the watch asks the OS about the control key, and only on Windows', async () => {
  const asked = []
  const watch = new ModifierWatch({
    userDataPath: '.', platform: 'win32', run: (args) => { asked.push(args); return true },
  })
  let released = 0
  assert.equal(await watch.start(() => { released += 1 }), true)
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(asked[0].slice(0, 2), [String(VK_CONTROL), String(POLL_MS)])
  assert.equal(released, 1)

  const elsewhere = new ModifierWatch({ userDataPath: '.', platform: 'darwin', run: () => true })
  assert.equal(await elsewhere.start(() => { throw new Error('should not fire') }), false)
})

test('a watch that has been stood down does not report a release', async () => {
  let settle = null
  const watch = new ModifierWatch({
    userDataPath: '.',
    platform: 'win32',
    run: () => new Promise((resolve) => { settle = resolve }),
  })
  let released = 0
  await watch.start(() => { released += 1 })
  // The chord ended some other way — Escape, or a card being clicked.
  watch.stop()
  settle(true)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(released, 0, 'a cancelled watch still fired')
})

test('the switcher watches while it is open and stands the watch down when it closes', async () => {
  const calls = []
  const watch = {
    start: (fn) => { calls.push('start'); watch.release = fn; return true },
    stop: () => calls.push('stop'),
  }
  const tabs = {
    tabs: [{ id: 1, lastActiveAt: 2 }, { id: 2, lastActiveAt: 1 }],
    activeId: 1,
    select(id) { this.activeId = id },
  }
  const overlay = {
    show: async () => true, hide() {}, patchState() {}, isSender: () => false, warm() {},
  }
  const win = { getContentBounds: () => ({ width: 1200, height: 700 }) }
  const switcher = new TabSwitcher(win, { tabs, overlay, modifierWatch: watch })

  switcher.step(1)
  assert.deepEqual(calls, ['start'])
  // The OS says the modifier came up: that is the commit.
  watch.release()
  assert.equal(tabs.activeId, 2, 'releasing the modifier did not switch tab')
  assert.equal(switcher.open, false)
  assert.ok(calls.includes('stop'), 'the watch was left running after the switcher closed')
})

test('the key watcher source asks Windows for the live key state', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'native', 'ember-key-watch.cs'), 'utf8')
  assert.match(source, /GetAsyncKeyState/)
  // Reading the state before the first sleep matters: the chord can end between
  // Ember deciding to watch and the watcher starting.
  assert.match(source, /while \(waited < timeout\)[\s\S]*?if \(!Down\(key\)\)[\s\S]*?Thread\.Sleep/)
})
