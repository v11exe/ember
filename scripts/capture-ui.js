const fs = require('node:fs/promises')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { app, BrowserWindow, ipcMain, nativeImage } = require('electron')

const { registerSchemePrivileges, handleInternalPages } = require('../src/main/protocol')
const { IPC } = require('../src/shared/ipc')
const { buildContextMenu } = require('../src/main/context-menu-model')
const { menuSize } = require('../src/main/context-menu-panel')

registerSchemePrivileges()

const output = path.resolve(process.argv[2] || 'visual-qa')
const sizes = [
  { name: 'wide', width: 1570, height: 796 },
  { name: 'medium', width: 900, height: 556 },
  { name: 'compact', width: 620, height: 336 },
]

app.on('window-all-closed', () => {})

async function screenshot(win, file) {
  console.log(`[capture] fonts ${file}`)
  await win.webContents.executeJavaScript('document.fonts.ready')
  console.log(`[capture] paint ${file}`)
  const image = await new Promise((resolve, reject) => {
    let latest = null
    const onPaint = (_event, _dirty, next) => {
      if (next.isEmpty()) return
      latest = next
    }
    win.webContents.on('paint', onPaint)
    win.webContents.invalidate()
    setTimeout(() => {
      win.webContents.off('paint', onPaint)
      if (latest) resolve(latest)
      else reject(new Error(`paint timed out: ${file}`))
    }, 300)
  })
  console.log(`[capture] write ${file}`)
  await fs.writeFile(path.join(output, file), image.toPNG())
}

async function captureNewTab(size) {
  console.log(`[capture] newtab ${size.name}`)
  const win = new BrowserWindow({
    show: false,
    width: size.width,
    height: size.height,
    frame: false,
    webPreferences: { offscreen: true },
  })
  await win.loadURL('ember://newtab')
  const metrics = await win.webContents.executeJavaScript(`(() => {
    const hero = document.querySelector('.hero').getBoundingClientRect()
    const search = document.querySelector('.liquid-glass-root').getBoundingClientRect()
    return {
      viewport: [innerWidth, innerHeight],
      scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      hero: [hero.left, hero.top, hero.right, hero.bottom],
      search: [search.left, search.top, search.right, search.bottom],
    }
  })()`)
  await screenshot(win, `newtab-${size.name}.png`)
  win.destroy()
  return metrics
}

async function captureChrome(size) {
  console.log(`[capture] chrome ${size.name}`)
  const win = new BrowserWindow({
    show: false,
    width: size.width,
    height: size.height,
    frame: false,
    webPreferences: {
      offscreen: true,
    },
  })
  const renderer = path.join(__dirname, '..', 'src', 'renderer')
  const source = await fs.readFile(path.join(renderer, 'chrome.html'), 'utf8')
  const preview = source
    .replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]+>/, '')
    .replace('<head>', `<head><base href="${pathToFileURL(renderer + path.sep).href}">`)
    .replace('<script src="chrome.js"></script>', '')
  const previewFile = path.join(output, 'chrome-preview.html')
  await fs.writeFile(previewFile, preview, 'utf8')
  await win.loadFile(previewFile)
  await win.webContents.executeJavaScript(`(() => {
    EmberBrand.mountChromeIcon(document.getElementById('chrome-brand'))

    const page = document.createElement('div')
    page.className = 'qa-page'
    page.style.cssText = 'position:fixed;left:168px;top:32px;right:8px;bottom:8px;border-radius:12px;background:radial-gradient(circle at 18% 20%,#6b1e10,transparent 29%),radial-gradient(circle at 65% 55%,#3e2630,transparent 34%),linear-gradient(135deg,#100b0b,#050506);box-shadow:inset 0 0 120px #000;'
    document.body.prepend(page)

    const sidebar = document.createElement('aside')
    sidebar.className = 'qa-sidebar'
    sidebar.style.cssText = 'position:fixed;z-index:1;inset:0 auto 0 0;width:168px;padding:34px 9px 8px;display:grid;grid-template-columns:repeat(2,69px);grid-auto-rows:43px;align-content:start;gap:10px;border-radius:12px 0 0 12px;background:radial-gradient(ellipse 245px 205px at 0 0,rgba(255,96,0,.4),transparent 74%),linear-gradient(180deg,transparent,rgba(10,8,8,.8)),linear-gradient(100deg,#542006,#29150d);'
    document.body.prepend(sidebar)

    const favorites = [
      ['Google', 'https://www.google.com/favicon.ico'],
      ['YouTube', 'https://www.youtube.com/favicon.ico'],
      ['Calendar', 'https://calendar.google.com/favicon.ico'],
    ]
    for (const [title, icon] of favorites) {
      const button = document.createElement('button')
      button.className = 'favorite'
      button.title = title
      button.style.cssText = 'width:69px;height:43px;display:grid;place-items:center;padding:0;border:1px solid rgba(255,255,255,.025);border-radius:7px;background:rgba(255,255,255,.075);'
      button.innerHTML = '<img alt="" src="' + icon + '">'
      sidebar.append(button)
    }

    const tabs = [
      ['YouTube', 'https://www.youtube.com/favicon.ico', 'asleep'],
      ['New Tab', '/assets/icon-white-stroke.png', 'active'],
      ['GitHub', 'https://github.com/favicon.ico', ''],
      ['Google', 'https://www.google.com/favicon.ico', ''],
      ['Google - Google Search', 'https://www.google.com/favicon.ico', ''],
    ]
    for (const [title, icon, state] of tabs) {
      const tab = document.createElement('button')
      tab.className = 'tab ' + state
      tab.innerHTML = '<img class="tab-favicon" alt="" src="' + icon + '">' +
        '<span class="tab-title">' + title + '</span>' +
        (state === 'asleep' ? '<span class="tab-sleep"></span>' : '') +
        '<span class="tab-close">×</span>'
      document.getElementById('tabs').append(tab)
    }
  })()`)
  const metrics = await win.webContents.executeJavaScript(`(() => {
    const sidebar = document.querySelector('.qa-sidebar').getBoundingClientRect()
    const top = document.getElementById('top-chrome').getBoundingClientRect()
    const page = document.querySelector('.qa-page').getBoundingClientRect()
    return {
      viewport: [innerWidth, innerHeight],
      scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      sidebar: [sidebar.left, sidebar.top, sidebar.right, sidebar.bottom],
      top: [top.left, top.top, top.right, top.bottom],
      page: [page.left, page.top, page.right, page.bottom],
    }
  })()`)
  await screenshot(win, `chrome-${size.name}.png`)
  win.destroy()
  return metrics
}

/** The same quick-search chip on the new tab search field. */
async function captureNewTabChip(size) {
  console.log('[capture] newtab chip')
  const win = new BrowserWindow({
    show: false,
    width: size.width,
    height: size.height,
    frame: false,
    webPreferences: { offscreen: true },
  })
  await win.loadURL('ember://newtab')
  await win.webContents.executeJavaScript(`(() => {
    const box = document.getElementById('q')
    const chip = document.getElementById('q-chip')
    box.value = 'yt liquid glass'
    chip.hidden = false
    chip.textContent = 'YouTube'
  })()`)
  await screenshot(win, 'newtab-chip.png')
  win.destroy()
}

/**
 * The omnibox quick-search chip, in both states. chrome.js is stripped from
 * the preview, so the DOM is posed by hand — this shows the styling, and the
 * smoke gate proves the behaviour that drives it.
 */
async function captureOmnibox(size, { engaged }) {
  const label = engaged ? 'engaged' : 'hint'
  console.log(`[capture] omnibox ${label}`)
  const win = new BrowserWindow({
    show: false,
    width: size.width,
    height: size.height,
    frame: false,
    webPreferences: { offscreen: true },
  })
  await win.loadFile(path.join(output, 'chrome-preview.html'))
  await win.webContents.executeJavaScript(`(() => {
    EmberBrand.mountChromeIcon(document.getElementById('chrome-brand'))
    const box = document.getElementById('omnibox')
    const chip = document.getElementById('bang-chip')
    const tip = document.getElementById('bang-tip')
    chip.hidden = false
    chip.textContent = 'YouTube'
    if (${JSON.stringify(!!engaged)}) {
      chip.classList.add('engaged')
      box.value = 'liquid glass'
      box.placeholder = 'Search YouTube'
    } else {
      box.value = 'yt liquid glass'
    }
    tip.hidden = true
    document.querySelector('.omnibox').classList.add('preview-focus')
  })()`)
  await screenshot(win, `omnibox-${label}.png`)
  win.destroy()
}

async function captureOverlay(name, page, size, state, activePosition = null, hoverSelector = null) {
  console.log(`[capture] overlay ${name}`)
  const win = new BrowserWindow({
    show: false,
    width: size.width,
    height: size.height,
    frame: false,
    transparent: true,
    webPreferences: {
      offscreen: true,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, '..', 'src', 'renderer', 'overlay-preload.js'),
    },
  })
  await win.loadURL(`ember://${page}`)
  win.webContents.send(IPC.OVERLAY_STATE, state)
  await win.webContents.executeJavaScript(`new Promise((resolve) => {
    const started = performance.now()
    const check = () => {
      const ready = document.getElementById('menu-shell')?.dataset.opticsReady
      if (${JSON.stringify(page)} !== 'context-menu' || ready || performance.now() - started > 1200) resolve()
      else requestAnimationFrame(check)
    }
    check()
  })`)
  await new Promise((resolve) => setTimeout(resolve, page === 'upload' ? 500 : 150))
  if (activePosition) {
    await win.webContents.executeJavaScript(`(() => {
      const items = [...document.querySelectorAll('.menu-item:not(:disabled)')]
      const index = ${JSON.stringify(activePosition)} === 'first' ? 0
        : ${JSON.stringify(activePosition)} === 'bottom' ? items.length - 1 : Math.floor(items.length / 2)
      items[index].dispatchEvent(new PointerEvent('pointerenter'))
    })()`)
    await new Promise((resolve) => setTimeout(resolve, 220))
  }
  if (hoverSelector) {
    await win.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(hoverSelector)})?.dispatchEvent(new PointerEvent('pointerenter'))`)
    await new Promise((resolve) => setTimeout(resolve, 220))
  }
  const metrics = await win.webContents.executeJavaScript(`({
    viewport: [innerWidth, innerHeight],
    scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
    optics: document.getElementById('menu-shell')?.dataset.opticsReady || null,
    lens: (() => { const r = document.getElementById('selector-lens')?.getBoundingClientRect(); return r && [r.x, r.y, r.width, r.height] })(),
    uploadLens: (() => { const r = document.getElementById('upload-hover-lens')?.getBoundingClientRect(); return r && [r.x, r.y, r.width, r.height] })(),
    lensVisible: document.getElementById('selector-lens')?.dataset.visible || null,
  })`)
  await screenshot(win, `${name}.png`)
  win.destroy()
  return metrics
}

function svgBackdrop(body, width, height) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${body}
  </svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function contrastBackdrop(tone, width, height) {
  const light = tone === 'light'
  const background = light ? '#f3e9df' : '#060608'
  const foreground = light ? '#181114' : '#fff4e8'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="${background}"/>
    <path d="M-70 40L450 560M-130 0L390 520M10 -30L430 390" stroke="#ff5a1f" stroke-width="32"/>
    <circle cx="82" cy="142" r="62" fill="${foreground}"/><circle cx="330" cy="330" r="96" fill="${foreground}"/>
    <path d="M0 238H${width}M0 276H${width}" stroke="#ffc93c" stroke-width="12"/>
  </svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function colourBackdrop(width, height) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="50%" height="50%" fill="#20d96b"/><rect x="50%" width="50%" height="50%" fill="#f2e929"/>
    <rect y="50%" width="50%" height="50%" fill="#ff7a18"/><rect x="50%" y="50%" width="50%" height="50%" fill="#e62f2f"/>
    <path d="M0 90H${width}M0 260H${width}M160 0V${height}M460 0V${height}" stroke="#111" stroke-width="4"/>
  </svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function gridBackdrop(width, height) {
  let grid = ''
  for (let x = 0; x <= width; x += 16) grid += `<path d="M${x} 0V${height}" stroke="${x % 64 ? '#43506a' : '#dce7ff'}" stroke-width="${x % 64 ? 1 : 2}"/>`
  for (let y = 0; y <= height; y += 16) grid += `<path d="M0 ${y}H${width}" stroke="${y % 64 ? '#43506a' : '#dce7ff'}" stroke-width="${y % 64 ? 1 : 2}"/>`
  return svgBackdrop(`<rect width="100%" height="100%" fill="#101624"/>${grid}
    <text x="18" y="42" fill="#fff" font-family="Arial" font-size="22">HORIZONTAL / VERTICAL / CHECKER</text>`, width, height)
}

function saturatedBackdrop(width, height) {
  return svgBackdrop(`<rect width="50%" height="50%" fill="#20d96b"/><rect x="50%" width="50%" height="50%" fill="#f2e929"/>
    <rect y="50%" width="50%" height="50%" fill="#ff7a18"/><rect x="50%" y="50%" width="50%" height="50%" fill="#e62f2f"/>
    <path d="M0 70H${width}M0 170H${width}M80 0V${height}M210 0V${height}" stroke="#111" stroke-width="3"/>
    <text x="18" y="42" fill="#101010" font-family="Arial" font-weight="700" font-size="19">GREEN · YELLOW · ORANGE · RED</text>`, width, height)
}

function typeContrastBackdrop(width, height) {
  return svgBackdrop(`<rect width="100%" height="50%" fill="#000"/><rect y="50%" width="100%" height="50%" fill="#fff"/>
    <text x="14" y="58" fill="#fff" font-family="Arial" font-weight="700" font-size="24">WHITE ON BLACK 012345</text>
    <text x="14" y="${Math.round(height / 2) + 58}" fill="#000" font-family="Arial" font-weight="700" font-size="24">BLACK ON WHITE 012345</text>
    <path d="M0 ${Math.round(height / 2)}H${width}" stroke="#ff5a1f" stroke-width="4"/>`, width, height)
}

async function photographicBackdrop(width, height) {
  try {
    const response = await fetch('https://images.unsplash.com/photo-1706720094773-d91e070e4b90?auto=format&fit=crop&w=900&q=85')
    if (!response.ok) throw new Error(`photo returned ${response.status}`)
    const image = nativeImage.createFromBuffer(Buffer.from(await response.arrayBuffer()))
    if (image.isEmpty()) throw new Error('photo decoded empty')
    return image.resize({ width, height }).toDataURL()
  } catch {
    return gridBackdrop(width, height)
  }
}

app.whenReady().then(async () => {
  await fs.mkdir(output, { recursive: true })
  handleInternalPages()
  ipcMain.handle(IPC.BOOKMARKS_GET, () => ({ version: 1, visible: false, items: [] }))
  ipcMain.handle(IPC.BOOKMARKS_IMPORT, () => ({ ok: false, canceled: true }))
  const results = {}
  for (const size of sizes) {
    results[`newtab-${size.name}`] = await captureNewTab(size)
    results[`chrome-${size.name}`] = await captureChrome(size)
    if (size.name === 'wide') {
      await captureOmnibox(size, { engaged: false })
      await captureOmnibox(size, { engaged: true })
      await captureNewTabChip(size)
    }
  }
  const brandIcon = nativeImage.createFromPath(path.join(__dirname, '..', 'src', 'renderer', 'assets', 'ember-icon.png'))
    .resize({ width: 180 }).toDataURL()
  const backdrop = nativeImage.createFromPath(path.join(output, 'newtab-wide.png')).resize({ width: 650 }).toDataURL()
  const uploadBackdropRect = { x: -40, y: -40, width: 730, height: 510 }
  const uploadState = (uploadBackdrop) => ({
    kind: 'upload', origin: 'uploads.example', accept: 'image/*', multiple: false,
    backdrop: uploadBackdrop, backdropRect: uploadBackdropRect, openSequence: 1,
    clipboard: { name: 'clipboard-20260821.png', type: 'image/png', thumbnail: brandIcon },
    recents: [
      { name: 'ember-icon.png', path: 'icon', thumbnail: brandIcon },
      { name: 'meteor-reference.png', path: 'meteor', thumbnail: brandIcon },
      { name: 'campaign-cover.png', path: 'cover', thumbnail: null },
      { name: 'product-shot.png', path: 'product', thumbnail: brandIcon },
      { name: 'visual-reference.png', path: 'reference', thumbnail: brandIcon },
    ],
  })
  results['upload-wide'] = await captureOverlay('upload-wide', 'upload', { width: 650, height: 430 }, uploadState(backdrop))
  results['upload-compact'] = await captureOverlay('upload-compact', 'upload', { width: 596, height: 312 }, uploadState(backdrop))
  results['upload-contrast'] = await captureOverlay('upload-contrast', 'upload', { width: 650, height: 430 }, uploadState(contrastBackdrop('light', 730, 510)))
  results['upload-colour'] = await captureOverlay('upload-colour', 'upload', { width: 650, height: 430 }, uploadState(colourBackdrop(730, 510)))
  results['upload-hover'] = await captureOverlay('upload-hover', 'upload', { width: 650, height: 430 }, uploadState(colourBackdrop(730, 510)), null, '#clipboard-slot')
  const contextItems = buildContextMenu({
    isEditable: true, selectionText: 'Ember', misspelledWord: 'Embr', dictionarySuggestions: ['Ember'],
    editFlags: { canUndo: true, canRedo: false, canCut: true, canCopy: true, canPaste: true, canDelete: true, canSelectAll: true },
  }, { canGoBack: true, canGoForward: false })
  const contextSize = menuSize(contextItems)
  const backdropRect = { x: -40, y: -40, width: contextSize.width + 80, height: contextSize.height + 80 }
  const contextState = (contextBackdrop) => ({
    kind: 'context-menu', items: contextItems, backdropRect,
    backdrop: contextBackdrop,
  })
  const grid = gridBackdrop(backdropRect.width, backdropRect.height)
  results['context-grid-rest'] = await captureOverlay(
    'context-grid-rest', 'context-menu', contextSize, contextState(grid))
  results['context-grid-first'] = await captureOverlay(
    'context-grid-first', 'context-menu', contextSize, contextState(grid), 'first')
  results['context-grid-middle'] = await captureOverlay(
    'context-grid-middle', 'context-menu', contextSize, contextState(grid), 'middle')
  results['context-grid-bottom'] = await captureOverlay(
    'context-grid-bottom', 'context-menu', contextSize, contextState(grid), 'bottom')
  results['context-saturated'] = await captureOverlay(
    'context-saturated', 'context-menu', contextSize,
    contextState(saturatedBackdrop(backdropRect.width, backdropRect.height)), 'middle')
  results['context-type-contrast'] = await captureOverlay(
    'context-type-contrast', 'context-menu', contextSize,
    contextState(typeContrastBackdrop(backdropRect.width, backdropRect.height)), 'middle')
  results['context-photo'] = await captureOverlay(
    'context-photo', 'context-menu', contextSize,
    contextState(await photographicBackdrop(backdropRect.width, backdropRect.height)), 'middle')
  console.log(JSON.stringify(results, null, 2))
  app.quit()
}).catch((error) => {
  console.error(error?.stack || error)
  app.exit(1)
})
