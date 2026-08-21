const fs = require('node:fs')
const path = require('node:path')

class BookmarkImportError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'BookmarkImportError'
    this.code = code
  }
}

function decodeHtml(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
  return String(value || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1].toLowerCase() === 'x'
      const number = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10)
      return Number.isFinite(number) ? String.fromCodePoint(number) : match
    }
    return named[entity.toLowerCase()] ?? match
  })
}

function textContent(markup) {
  return decodeHtml(String(markup || '').replace(/<[^>]*>/g, '')).trim()
}

function attribute(markup, name) {
  const match = String(markup).match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  return decodeHtml(match ? (match[1] ?? match[2] ?? match[3] ?? '') : '')
}

function parseBookmarkHtml(html) {
  if (typeof html !== 'string' || !html.trim()) {
    throw new BookmarkImportError('EMPTY_FILE', 'The selected bookmark file is empty.')
  }

  const root = []
  const stack = [root]
  let pendingFolder = null
  const tokens = html.match(/<\/?DL\b[^>]*>|<H3\b[^>]*>[\s\S]*?<\/H3>|<A\b[^>]*>[\s\S]*?<\/A>/gi) || []

  for (const token of tokens) {
    if (/^<H3\b/i.test(token)) {
      const folder = {
        type: 'folder',
        title: textContent(token.replace(/^<H3\b[^>]*>|<\/H3>$/gi, '')) || 'Untitled folder',
        children: [],
      }
      stack.at(-1).push(folder)
      pendingFolder = folder
      continue
    }

    if (/^<A\b/i.test(token)) {
      const url = attribute(token, 'HREF').trim()
      if (!url || !/^[a-z][a-z0-9+.-]*:/i.test(url)) continue
      const bookmark = {
        type: 'bookmark',
        title: textContent(token.replace(/^<A\b[^>]*>|<\/A>$/gi, '')) || url,
        url,
      }
      const icon = attribute(token, 'ICON_URI') || attribute(token, 'ICON')
      if (icon) bookmark.icon = icon
      stack.at(-1).push(bookmark)
      pendingFolder = null
      continue
    }

    if (/^<DL\b/i.test(token)) {
      if (pendingFolder) {
        stack.push(pendingFolder.children)
        pendingFolder = null
      }
      continue
    }

    if (/^<\/DL\b/i.test(token) && stack.length > 1) {
      stack.pop()
      pendingFolder = null
    }
  }

  const bookmarkCount = JSON.stringify(root).match(/"type":"bookmark"/g)?.length || 0
  if (!bookmarkCount) {
    throw new BookmarkImportError('NO_BOOKMARKS', 'No valid bookmarks were found in this HTML file.')
  }
  return root
}

function mergeBookmarkTrees(existing, imported) {
  return structuredClone([...(existing || []), ...(imported || [])])
}

function defaultState() {
  return { version: 1, visible: false, items: [] }
}

class BookmarkStore {
  constructor(file) {
    this.file = file
    this.data = this.#read()
  }

  #read() {
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'))
      if (data?.version !== 1 || !Array.isArray(data.items)) return defaultState()
      return { version: 1, visible: !!data.visible, items: data.items }
    } catch (error) {
      if (error.code !== 'ENOENT') console.warn('[ember] bookmark store could not be read:', error.message)
      return defaultState()
    }
  }

  snapshot() {
    return structuredClone(this.data)
  }

  async importHtml(html) {
    const imported = parseBookmarkHtml(html)
    const next = {
      version: 1,
      visible: true,
      items: mergeBookmarkTrees(this.data.items, imported),
    }
    await this.#persist(next)
    this.data = next
    return this.snapshot()
  }

  async setVisible(visible) {
    const next = { ...this.data, visible: !!visible }
    await this.#persist(next)
    this.data = next
    return this.snapshot()
  }

  async #persist(data) {
    const temporary = `${this.file}.tmp-${process.pid}-${Date.now()}`
    try {
      await fs.promises.mkdir(path.dirname(this.file), { recursive: true })
      await fs.promises.writeFile(temporary, JSON.stringify(data, null, 2) + '\n', 'utf8')
      await fs.promises.rename(temporary, this.file)
    } catch (error) {
      await fs.promises.rm(temporary, { force: true })
      throw new BookmarkImportError('WRITE_FAILED', `Bookmarks could not be saved: ${error.message}`)
    }
  }
}

module.exports = { BookmarkStore, BookmarkImportError, mergeBookmarkTrees, parseBookmarkHtml }
