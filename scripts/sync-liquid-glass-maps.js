const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')

const SOURCE = 'https://gist.githubusercontent.com/zaidebrahim/43590be1ddc925163fe05e1654451c70/raw/bc1afc0c8297555ffac6e23b08fc371ea83a54dc/index.html'
const EXPECTED_SHA256 = '6475a2bf80d1dad57b98ffe7bb38acd62eac3386abdca245e73dd9f36287813d'
const OUTPUT = 'glass-switcher-map.webp'

async function main() {
  const response = await fetch(SOURCE)
  if (!response.ok) throw new Error(`map source returned ${response.status}`)
  const source = await response.text()
  const maps = [...source.matchAll(/data:image\/webp;base64,([^"']+)/g)]
  if (!maps.length) throw new Error('canonical map not found')
  const candidates = maps.map((match) => Buffer.from(match[1], 'base64'))
  const hashes = candidates.map((bytes) => crypto.createHash('sha256').update(bytes).digest('hex'))
  const uniqueHashes = new Set(hashes)
  if (uniqueHashes.size !== 1 || !uniqueHashes.has(EXPECTED_SHA256)) {
    throw new Error(`unexpected canonical map hashes: ${[...uniqueHashes].join(', ')}`)
  }
  const directory = path.join(__dirname, '..', 'src', 'renderer', 'assets')
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(path.join(directory, OUTPUT), candidates[0])
  console.log(`Pinned one canonical liquid-glass map (${EXPECTED_SHA256}); ${maps.length} source occurrences agree.`)
}

main().catch((error) => {
  console.error(error?.stack || error)
  process.exitCode = 1
})
