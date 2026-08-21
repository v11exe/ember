const path = require('node:path')

const MIME_BY_EXTENSION = new Map(Object.entries({
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml', '.avif': 'image/avif', '.pdf': 'application/pdf',
  '.txt': 'text/plain', '.csv': 'text/csv', '.json': 'application/json',
  '.zip': 'application/zip', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
}))

const EXTENSIONS_BY_WILDCARD = {
  'image/*': ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'],
  'audio/*': ['mp3', 'wav'],
  'video/*': ['mp4', 'webm'],
}

function acceptTokens(accept) {
  return String(accept || '').split(',').map((token) => token.trim().toLowerCase()).filter(Boolean)
}

function matchesAccept(file, accept) {
  const tokens = acceptTokens(accept)
  if (!tokens.length || tokens.includes('*/*')) return true
  const name = String(file?.name || '').toLowerCase()
  const type = String(file?.type || '').toLowerCase()
  return tokens.some((token) => {
    if (token.startsWith('.')) return name.endsWith(token)
    if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1))
    return type === token
  })
}

function dialogFiltersForAccept(accept) {
  const tokens = acceptTokens(accept)
  if (!tokens.length || tokens.includes('*/*')) return []
  const extensions = []
  for (const token of tokens) {
    if (token.startsWith('.')) extensions.push(token.slice(1))
    else if (EXTENSIONS_BY_WILDCARD[token]) extensions.push(...EXTENSIONS_BY_WILDCARD[token])
    else {
      for (const [extension, mime] of MIME_BY_EXTENSION) {
        if (mime === token) extensions.push(extension.slice(1))
      }
    }
  }
  const unique = [...new Set(extensions)]
  if (!unique.length) return []
  return [
    { name: 'Accepted files', extensions: unique },
    { name: 'All files', extensions: ['*'] },
  ]
}

function mimeForPath(filePath) {
  return MIME_BY_EXTENSION.get(path.extname(String(filePath)).toLowerCase()) || 'application/octet-stream'
}

module.exports = { acceptTokens, matchesAccept, dialogFiltersForAccept, mimeForPath }
