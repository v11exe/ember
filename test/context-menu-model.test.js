const test = require('node:test')
const assert = require('node:assert/strict')

const { buildContextMenu, buildFavoriteContextMenu } = require('../src/main/context-menu-model')

const ids = (items) => items.filter((item) => item.type !== 'separator').map((item) => item.id)

test('builds a compact page menu with live navigation state', () => {
  const items = buildContextMenu({}, { canGoBack: true, canGoForward: false })
  assert.deepEqual(ids(items), ['back', 'forward', 'reload', 'save-page', 'print', 'view-source', 'inspect'])
  assert.equal(items.find((item) => item.id === 'back').enabled, true)
  assert.equal(items.find((item) => item.id === 'forward').enabled, false)
})

test('builds functional editable and spelling commands from Chromium flags', () => {
  const items = buildContextMenu({
    isEditable: true,
    misspelledWord: 'Embr',
    dictionarySuggestions: ['Ember', 'Embryo'],
    editFlags: { canUndo: true, canRedo: false, canCut: true, canCopy: true, canPaste: true, canDelete: true, canSelectAll: true },
  }, {})
  assert.deepEqual(ids(items).slice(0, 10), [
    'spell:Ember', 'spell:Embryo', 'dictionary-add', 'undo', 'redo', 'cut', 'copy', 'paste', 'delete', 'select-all',
  ])
  assert.equal(items.find((item) => item.id === 'redo').enabled, false)
})

test('Favorite context menu is intentionally minimal', () => {
  assert.deepEqual(buildFavoriteContextMenu(), [
    { type: 'command', id: 'favorite-remove', label: 'Remove quick site', enabled: true, shortcut: '' },
  ])
})

test('adds contextual link, image, and selection actions without duplicates', () => {
  const items = buildContextMenu({
    linkURL: 'https://ember.example/',
    mediaType: 'image',
    srcURL: 'https://ember.example/icon.png',
    selectionText: 'Ember selected text',
    editFlags: { canCopy: true },
  }, {})
  const menuIds = ids(items)
  assert.deepEqual(menuIds.slice(0, 6), ['open-link', 'copy-link', 'open-image', 'copy-image', 'copy-image-address', 'copy'])
  assert.equal(menuIds.filter((id) => id === 'copy').length, 1)
})
