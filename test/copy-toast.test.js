const test = require('node:test')
const assert = require('node:assert/strict')

const { CopyToast, TOAST_EXIT_DURATION, TOAST_HEIGHT, TOAST_LIFETIME, TOAST_WIDTH } = require('../src/main/copy-toast')

test('copy toast opens beside the open sidebar then closes when its lifetime ends', async () => {
  const calls = []
  const overlay = {
    open: false,
    async show(options) { calls.push(['show', options]); this.open = true; return true },
    patchState(state) { calls.push(['state', state]) },
    hide() { calls.push(['hide']); this.open = false },
    setBounds(bounds) { calls.push(['layout', bounds]) },
  }
  let scheduled
  const toast = new CopyToast({}, {
    tabs: { sidebarOpen: true },
    overlay,
    schedule: (fn, delay) => { scheduled = { fn, delay }; return 'timer' },
    cancel: (timer) => calls.push(['cancel', timer]),
  })

  assert.equal(await toast.show(), true)
  const show = calls.find(([kind]) => kind === 'show')
  assert.deepEqual(show[1].bounds, { x: 176, y: 35, width: TOAST_WIDTH, height: TOAST_HEIGHT })
  assert.equal(show[1].state.lifetime, TOAST_LIFETIME)
  assert.equal(scheduled.delay, TOAST_LIFETIME)
  scheduled.fn()
  assert.deepEqual(calls.at(-1), ['state', { closing: true }])
  assert.equal(scheduled.delay, TOAST_EXIT_DURATION)
  scheduled.fn()
  assert.deepEqual(calls.at(-1), ['hide'])
})
