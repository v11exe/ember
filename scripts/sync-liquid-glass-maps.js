const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')

const SOURCE = 'https://gist.githubusercontent.com/zaidebrahim/43590be1ddc925163fe05e1654451c70/raw/bc1afc0c8297555ffac6e23b08fc371ea83a54dc/index.html'
const EXPECTED_SHA256 = '6475a2bf80d1dad57b98ffe7bb38acd62eac3386abdca245e73dd9f36287813d'
const OUTPUTS = ['glass-switcher-map.webp', 'glass-toggler-map.webp']

async function main() {
  const response = await fetch(SOURCE)
  if (!response.ok) throw new Error(`map source returned ${response.status}`)
  const source = await response.text()
  const maps = [...source.matchAll(/data:image\/webp;base64,([^"']+)/g)]
  if (maps.length !== OUTPUTS.length) throw new Error(`expected two maps, found ${maps.length}`)
  const directory = path.join(__dirname, '..', 'src', 'renderer', 'assets')
  await fs.mkdir(directory, { recursive: true })
  for (let index = 0; index < maps.length; index += 1) {
    const bytes = Buffer.from(maps[index][1], 'base64')
    const hash = crypto.createHash('sha256').update(bytes).digest('hex')
    if (hash !== EXPECTED_SHA256) throw new Error(`unexpected map hash at index ${index}: ${hash}`)
    await fs.writeFile(path.join(directory, OUTPUTS[index]), bytes)
  }
  console.log(`Pinned ${maps.length} canonical liquid-glass maps (${EXPECTED_SHA256}).`)
}

main().catch((error) => {
  console.error(error?.stack || error)
  process.exitCode = 1
})
