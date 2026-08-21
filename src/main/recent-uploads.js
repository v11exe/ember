const path = require('node:path')
const defaultIo = require('node:fs/promises')

class RecentUploadStore {
  constructor(file, { limit = 18, io = defaultIo, now = () => Date.now() } = {}) {
    this.file = file
    this.limit = limit
    this.io = io
    this.now = now
    this.items = []
  }

  async load() {
    try {
      const parsed = JSON.parse(await this.io.readFile(this.file, 'utf8'))
      this.items = Array.isArray(parsed?.items) ? parsed.items.slice(0, this.limit) : []
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      this.items = []
    }
    return this.snapshot()
  }

  snapshot() {
    return this.items.map((item) => ({ ...item }))
  }

  async add(paths) {
    const added = [...new Set(paths.map((filePath) => path.normalize(String(filePath))))]
    const addedKeys = new Set(added.map((filePath) => filePath.toLowerCase()))
    const next = [
      ...added.map((filePath) => ({ path: filePath, lastUsed: this.now() })),
      ...this.items.filter((item) => !addedKeys.has(item.path.toLowerCase())),
    ].slice(0, this.limit)
    await this.#persist(next)
    this.items = next
    return this.snapshot()
  }

  async #persist(items) {
    await this.io.mkdir(path.dirname(this.file), { recursive: true })
    const temporary = this.file + '.tmp'
    await this.io.writeFile(temporary, JSON.stringify({ version: 1, items }, null, 2), 'utf8')
    await this.io.rename(temporary, this.file)
  }
}

module.exports = { RecentUploadStore }
