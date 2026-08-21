const test = require('node:test')
const assert = require('node:assert/strict')

const { ContextMenuPanel, menuHeight } = require('../src/main/context-menu-panel')

function harness() {
  const sender = {}
  const shown = []
  const relayouts = []
  let hides = 0
  const overlay = {
    show: async (state) => shown.push(state),
    hide: () => { hides += 1 },
    isSender: (value) => value === sender,
    setBounds: () => {},
    relayout: async (state) => relayouts.push(state),
  }
  const calls = []
  const navigationHistory = {
    canGoBack: () => true, canGoForward: () => false,
    goBack: () => calls.push('back'), goForward: () => calls.push('forward'),
  }
  const webContents = {
    navigationHistory,
    getURL: () => 'https://ember.example/page',
    getTitle: () => 'Ember page',
    reload: () => calls.push('reload'),
    copy: () => calls.push('copy'), paste: () => calls.push('paste'),
    cut: () => calls.push('cut'), delete: () => calls.push('delete'),
    undo: () => calls.push('undo'), redo: () => calls.push('redo'),
    selectAll: () => calls.push('select-all'),
    replaceMisspelling: (word) => calls.push(['spell', word]),
    copyImageAt: (x, y) => calls.push(['copy-image', x, y]),
    inspectElement: (x, y) => calls.push(['inspect', x, y]),
    print: () => calls.push('print'),
    savePage: async (file, type) => calls.push(['save', file, type]),
    session: { addWordToSpellCheckerDictionary: (word) => calls.push(['dictionary', word]) },
  }
  const tab = {
    view: { getBounds: () => ({ x: 0, y: 84, width: 900, height: 556 }) },
    webContents,
  }
  const createTab = (url) => calls.push(['tab', url])
  const clipboard = { writeText: (text) => calls.push(['clipboard', text]) }
  const dialog = { showSaveDialog: async () => ({ canceled: false, filePath: 'C:\\saved\\page.html' }) }
  const panel = new ContextMenuPanel({}, { overlay, createTab, clipboard, dialog })
  return { panel, sender, shown, relayouts, get hides() { return hides }, calls, tab }
}

test('opens clamped to the page and exposes enabled navigation commands', async () => {
  const h = harness()
  await h.panel.open({ tab: h.tab, params: { x: 895, y: 550 } })
  const shown = h.shown[0]
  assert.equal(shown.bounds.x + shown.bounds.width <= 900, true)
  assert.equal(shown.bounds.y + shown.bounds.height <= 640, true)
  assert.equal(shown.captureBleed, 40)
  assert.equal(shown.state.items.find((item) => item.id === 'back').enabled, true)
  assert.equal(shown.state.items.find((item) => item.id === 'forward').enabled, false)
})

test('menuHeight includes shell padding and both border pixels', () => {
  assert.equal(menuHeight([{ id: 'reload' }]), 54)
})

test('constrains a command-rich menu to the usable page height', async () => {
  const h = harness()
  await h.panel.open({
    tab: h.tab,
    params: {
      x: 20, y: 20, isEditable: true, selectionText: 'Ember',
      misspelledWord: 'Embr', dictionarySuggestions: ['Ember', 'Embers', 'Amber'],
      linkURL: 'https://link.example/', mediaType: 'image', srcURL: 'https://link.example/a.png',
      editFlags: { canUndo: true, canRedo: true, canCut: true, canCopy: true, canPaste: true, canDelete: true, canSelectAll: true },
    },
  })
  assert.equal(h.shown[0].bounds.height <= 540, true)
})

test('layout refreshes the captured texture with the same bleed contract', async () => {
  const h = harness()
  await h.panel.open({ tab: h.tab, params: { x: 20, y: 20 } })
  h.panel.layout()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(h.relayouts[0].captureBleed, 40)
  assert.equal(h.relayouts[0].targetView, h.tab.view)
})

test('routes contextual, editing, spelling, navigation, and inspect actions', async () => {
  const h = harness()
  await h.panel.open({
    tab: h.tab,
    params: {
      x: 14, y: 22, linkURL: 'https://link.example/', mediaType: 'image',
      srcURL: 'https://link.example/a.png', selectionText: 'Ember',
      misspelledWord: 'Embr', dictionarySuggestions: ['Ember'], editFlags: { canCopy: true },
    },
  })
  for (const action of ['open-link', 'copy-image-address', 'copy', 'spell:Ember', 'dictionary-add', 'back', 'inspect']) {
    await h.panel.handleAction(h.sender, action)
    if (action !== 'inspect') await h.panel.open({
      tab: h.tab,
      params: {
        x: 14, y: 22, linkURL: 'https://link.example/', mediaType: 'image',
        srcURL: 'https://link.example/a.png', selectionText: 'Ember',
        misspelledWord: 'Embr', dictionarySuggestions: ['Ember'], editFlags: { canCopy: true },
      },
    })
  }
  assert.deepEqual(h.calls, [
    ['tab', 'https://link.example/'],
    ['clipboard', 'https://link.example/a.png'],
    'copy',
    ['spell', 'Ember'],
    ['dictionary', 'Embr'],
    'back',
    ['inspect', 14, 22],
  ])
})

test('saves through a real save dialog and HTMLComplete', async () => {
  const h = harness()
  await h.panel.open({ tab: h.tab, params: { x: 1, y: 1 } })
  await h.panel.handleAction(h.sender, 'save-page')
  assert.deepEqual(h.calls, [['save', 'C:\\saved\\page.html', 'HTMLComplete']])
  assert.equal(h.hides, 1)
})
