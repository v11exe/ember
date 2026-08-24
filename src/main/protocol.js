const path = require('node:path')
const fs = require('node:fs/promises')
const { protocol } = require('electron')

// Electron has no chrome:// pages. Internal pages live on ember:// instead,
// registered as a standard, secure scheme (AGENTS.md §0).
const SCHEME = 'ember'
const RENDERER = path.join(__dirname, '..', 'renderer')
const PAGES = path.join(RENDERER, 'pages')
const SHARED_ASSETS = new Map([
  ['/theme.css', path.join(RENDERER, 'theme.css')],
  ['/glass.css', path.join(RENDERER, 'glass.css')],
  ['/overlay-liquid-glass.css', path.join(PAGES, 'overlay-liquid-glass.css')],
  ['/overlay-liquid-glass.js', path.join(PAGES, 'overlay-liquid-glass.js')],
  ['/brand.js', path.join(RENDERER, 'brand.js')],
  ['/brand.css', path.join(RENDERER, 'brand.css')],
  ['/assets/ember-icon.png', path.join(RENDERER, 'assets', 'ember-icon.png')],
  ['/assets/Necosmic-PersonalUse.otf', path.join(RENDERER, 'assets', 'Necosmic-PersonalUse.otf')],
  ['/assets/glass-switcher-map.webp', path.join(RENDERER, 'assets', 'glass-switcher-map.webp')],
  ['/assets/liquid-glass-map.jpg', path.join(RENDERER, 'assets', 'liquid-glass-map.jpg')],
])

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json',
  '.otf': 'font/otf',
}

function registerSchemePrivileges() {
  protocol.registerSchemesAsPrivileged([
    { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
  ])
}

function handleInternalPages() {
  protocol.handle(SCHEME, async (request) => {
    const { host, pathname } = new URL(request.url)
    // pages/ is flat: ember://newtab -> newtab.html, /newtab.css -> newtab.css
    const name = !pathname || pathname === '/' ? host + '.html' : path.basename(pathname)
    const file = SHARED_ASSETS.get(pathname) || path.join(PAGES, name)

    try {
      const body = await fs.readFile(file)
      return new Response(body, {
        headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' },
      })
    } catch {
      return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } })
    }
  })
}

module.exports = { registerSchemePrivileges, handleInternalPages, SCHEME }
