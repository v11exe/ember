const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { BookmarkStore, BookmarkImportError, mergeBookmarkTrees, parseBookmarkHtml } = require('../src/main/bookmarks')

const CHROMIUM_EXPORT = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
  <DT><H3 ADD_DATE="1">Bookmarks bar</H3>
  <DL><p>
    <DT><A HREF="https://example.com/a?x=1&amp;y=2">Example &amp; docs</A>
    <DT><H3>Tools</H3>
    <DL><p>
      <DT><A HREF="https://github.com/v11exe/ember">Ember</A>
    </DL><p>
  </DL><p>
</DL><p>`

test('parses Chromium bookmark HTML with exact URLs and nested folders', () => {
  const items = parseBookmarkHtml(CHROMIUM_EXPORT)

  assert.deepEqual(items, [{
    type: 'folder',
    title: 'Bookmarks bar',
    children: [
      { type: 'bookmark', title: 'Example & docs', url: 'https://example.com/a?x=1&y=2' },
      {
        type: 'folder',
        title: 'Tools',
        children: [{ type: 'bookmark', title: 'Ember', url: 'https://github.com/v11exe/ember' }],
      },
    ],
  }])
})

test('rejects malformed bookmark files without returning partial data', () => {
  assert.throws(
    () => parseBookmarkHtml('<html><body>not a bookmark export</body></html>'),
    (error) => error instanceof BookmarkImportError && error.code === 'NO_BOOKMARKS'
  )
})

test('merges imported trees without replacing existing bookmarks', () => {
  const existing = [{ type: 'bookmark', title: 'Existing', url: 'https://existing.test/' }]
  const imported = [{ type: 'bookmark', title: 'Imported', url: 'https://imported.test/' }]

  assert.deepEqual(mergeBookmarkTrees(existing, imported), [...existing, ...imported])
  assert.deepEqual(existing, [{ type: 'bookmark', title: 'Existing', url: 'https://existing.test/' }])
})

test('persists imports and refreshes visibility in one bookmark store', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-bookmarks-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const file = path.join(dir, 'bookmarks.json')
  const store = new BookmarkStore(file)

  const snapshot = await store.importHtml(CHROMIUM_EXPORT)
  await store.setVisible(false)
  const reloaded = new BookmarkStore(file).snapshot()

  assert.equal(snapshot.visible, true)
  assert.equal(reloaded.visible, false)
  assert.deepEqual(reloaded.items, snapshot.items)
})

test('leaves existing bookmark storage unchanged after a malformed import', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-bookmarks-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const store = new BookmarkStore(path.join(dir, 'bookmarks.json'))
  await store.importHtml(CHROMIUM_EXPORT)
  const before = store.snapshot()

  await assert.rejects(() => store.importHtml('<p>broken</p>'), BookmarkImportError)
  assert.deepEqual(store.snapshot(), before)
})

test('keeps in-memory bookmarks unchanged when persistence fails', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-bookmarks-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const blocker = path.join(dir, 'not-a-directory')
  fs.writeFileSync(blocker, 'block')
  const store = new BookmarkStore(path.join(blocker, 'bookmarks.json'))
  const before = store.snapshot()

  await assert.rejects(() => store.importHtml(CHROMIUM_EXPORT), BookmarkImportError)
  assert.deepEqual(store.snapshot(), before)
})
