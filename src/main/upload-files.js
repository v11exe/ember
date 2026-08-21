const fs = require('node:fs/promises')
const path = require('node:path')
const { mimeForPath } = require('../shared/file-selection')

async function payloadFromPath(filePath, io = fs) {
  const [data, stat] = await Promise.all([io.readFile(filePath), io.stat(filePath)])
  if (!stat.isFile()) throw new Error('Selected upload is not a file.')
  return {
    name: path.basename(filePath),
    type: mimeForPath(filePath),
    lastModified: Math.round(stat.mtimeMs),
    data,
  }
}

function payloadFromClipboardImage(image, now = new Date()) {
  if (!image || image.isEmpty()) return null
  const stamp = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
  return {
    name: `clipboard-${stamp}.png`,
    type: 'image/png',
    lastModified: now.getTime(),
    data: image.toPNG(),
  }
}

module.exports = { payloadFromPath, payloadFromClipboardImage }
