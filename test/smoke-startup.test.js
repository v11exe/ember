const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

test('the smoke probe waits for the chrome callback to create an active tab', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'index.js'), 'utf8')
  const wait = source.indexOf('const active = await waitFor(() => browser?.tabs.active, 30_000)')
  const guard = source.indexOf("throw new Error('active tab did not become ready')", wait)
  const navigation = source.indexOf('await active.webContents.loadURL', wait)

  assert.ok(wait >= 0, 'the cold-start probe must await the active tab')
  assert.ok(guard > wait, 'the probe must fail clearly if readiness never arrives')
  assert.ok(navigation > guard, 'the probe must not use the tab before the readiness guard')
})
