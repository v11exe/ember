const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const { IPC } = require('../src/shared/ipc')

test('overlay preload exposes state, actions, and dismissal through named IPC', () => {
  const sent = []
  const listeners = new Map()
  let exposed
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'overlay-preload.js'), 'utf8')
  const electron = {
    contextBridge: { exposeInMainWorld: (_name, api) => { exposed = api } },
    ipcRenderer: {
      on: (channel, fn) => listeners.set(channel, fn),
      send: (...args) => sent.push(args),
    },
  }
  const sandboxRequire = (id) => {
    if (id === 'electron') return electron
    if (id === '../shared/ipc') return { IPC }
    throw new Error(`Unexpected require: ${id}`)
  }
  vm.runInNewContext(`(function(require){${source}\n})`, {})(sandboxRequire)

  let state
  exposed.onState((next) => { state = next })
  listeners.get(IPC.OVERLAY_STATE)(null, { kind: 'upload' })
  exposed.action('browse', { multiple: true })
  exposed.close()

  assert.deepEqual(state, { kind: 'upload' })
  assert.deepEqual(sent, [
    [IPC.OVERLAY_ACTION, 'browse', { multiple: true }],
    [IPC.OVERLAY_CLOSE],
  ])
})
