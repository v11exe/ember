const fs = require('node:fs/promises')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { app, BrowserWindow, ipcMain, nativeImage } = require('electron')

const { registerSchemePrivileges, handleInternalPages } = require('../src/main/protocol')
const { IPC } = require('../src/shared/ipc')
const { buildContextMenu } = require('../src/main/context-menu-model')
const { menuHeight } = require('../src/main/context-menu-panel')

registerSchemePrivileges()

const output = path.resolve(process.argv[2] || 'visual-qa')
const sizes = [
  { name: 'wide', width: 1280, height: 736 },
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
    const search = document.querySelector('.search').getBoundingClientRect()
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
    height: 114,
    frame: false,
    webPreferences: {
      offscreen: true,
    },
  })
  const renderer = path.join(__dirname, '..', 'src', 'renderer')
  const source = await fs.readFile(path.join(renderer, 'chrome.html'), 'utf8')
  const preview = source
    .replace('<head>', `<head><base href="${pathToFileURL(renderer + path.sep).href}">`)
    .replace('<script src="chrome.js"></script>', '')
  const previewFile = path.join(output, 'chrome-preview.html')
  await fs.writeFile(previewFile, preview, 'utf8')
  await win.loadFile(previewFile)
  await win.webContents.executeJavaScript(`(() => {
    EmberBrand.mountIcon(document.getElementById('chrome-brand'))
    const bar = document.getElementById('bookmarks-bar')
    bar.hidden = false
    document.getElementById('bookmarks-toggle').setAttribute('aria-pressed', 'true')
    const items = document.getElementById('bookmarks-items')
    const add = (title, folder = false) => {
      const button = document.createElement('button')
      button.className = 'bookmark-item ' + (folder ? 'bookmark-folder' : 'bookmark-link')
      const label = document.createElement('span')
      label.textContent = title
      button.append(label)
      items.append(button)
    }
    add('Ember'); add('Documentation with a long title'); add('Reference', true)
  })()`)
  const metrics = await win.webContents.executeJavaScript(`(() => {
    const toolbar = document.querySelector('.toolbar').getBoundingClientRect()
    return {
      viewport: [innerWidth, innerHeight],
      scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      toolbar: [toolbar.left, toolbar.top, toolbar.right, toolbar.bottom],
      bookmarksWidth: document.querySelector('#bookmarks-items').scrollWidth,
    }
  })()`)
  await screenshot(win, `chrome-${size.name}.png`)
  win.destroy()
  return metrics
}

async function captureOverlay(name, page, size, state, activePosition = null) {
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
  await new Promise((resolve) => setTimeout(resolve, 150))
  if (activePosition) {
    await win.webContents.executeJavaScript(`(() => {
      const items = [...document.querySelectorAll('.menu-item:not(:disabled)')]
      const index = ${JSON.stringify(activePosition)} === 'first' ? 0
        : ${JSON.stringify(activePosition)} === 'bottom' ? items.length - 1 : Math.floor(items.length / 2)
      items[index].dispatchEvent(new PointerEvent('pointerenter'))
    })()`)
    await new Promise((resolve) => setTimeout(resolve, 220))
  }
  const metrics = await win.webContents.executeJavaScript(`({
    viewport: [innerWidth, innerHeight],
    scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
    lens: (() => { const r = document.getElementById('selector-lens')?.getBoundingClientRect(); return r && [r.x, r.y, r.width, r.height] })(),
  })`)
  await screenshot(win, `${name}.png`)
  win.destroy()
  return metrics
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

app.whenReady().then(async () => {
  await fs.mkdir(output, { recursive: true })
  handleInternalPages()
  ipcMain.handle(IPC.BOOKMARKS_GET, () => ({ version: 1, visible: false, items: [] }))
  ipcMain.handle(IPC.BOOKMARKS_IMPORT, () => ({ ok: false, canceled: true }))
  const results = {}
  for (const size of sizes) {
    results[`newtab-${size.name}`] = await captureNewTab(size)
    results[`chrome-${size.name}`] = await captureChrome(size)
  }
  const brandIcon = nativeImage.createFromPath(path.join(__dirname, '..', 'src', 'renderer', 'assets', 'ember-icon.png'))
    .resize({ width: 180 }).toDataURL()
  const brandLogo = nativeImage.createFromPath(path.join(__dirname, '..', 'src', 'renderer', 'assets', 'ember-logo.png'))
    .resize({ width: 180 }).toDataURL()
  const backdrop = nativeImage.createFromPath(path.join(output, 'newtab-wide.png')).resize({ width: 650 }).toDataURL()
  const uploadState = {
    kind: 'upload', origin: 'uploads.example', accept: 'image/*', multiple: false,
    backdrop,
    clipboard: { name: 'clipboard-20260821.png', type: 'image/png', thumbnail: brandIcon },
    recents: [
      { name: 'ember-logo.png', path: 'logo', thumbnail: brandLogo },
      { name: 'ember-icon.png', path: 'icon', thumbnail: brandIcon },
      { name: 'campaign-cover.png', path: 'cover', thumbnail: null },
      { name: 'product-shot.png', path: 'product', thumbnail: brandIcon },
      { name: 'visual-reference.png', path: 'reference', thumbnail: brandLogo },
    ],
  }
  results['upload-wide'] = await captureOverlay('upload-wide', 'upload', { width: 650, height: 430 }, uploadState)
  results['upload-compact'] = await captureOverlay('upload-compact', 'upload', { width: 596, height: 312 }, uploadState)
  const contextItems = buildContextMenu({
    isEditable: true, selectionText: 'Ember', misspelledWord: 'Embr', dictionarySuggestions: ['Ember'],
    editFlags: { canUndo: true, canRedo: false, canCut: true, canCopy: true, canPaste: true, canDelete: true, canSelectAll: true },
  }, { canGoBack: true, canGoForward: false })
  const contextSize = { width: 318, height: Math.min(menuHeight(contextItems), 540) }
  const backdropRect = { x: -40, y: -40, width: contextSize.width + 80, height: contextSize.height + 80 }
  const contextState = (tone) => ({
    kind: 'context-menu', items: contextItems, backdropRect,
    backdrop: contrastBackdrop(tone, backdropRect.width, backdropRect.height),
  })
  results['context-dark-first'] = await captureOverlay(
    'context-dark-first', 'context-menu', contextSize, contextState('dark'), 'first')
  results['context-dark-middle'] = await captureOverlay(
    'context-dark-middle', 'context-menu', contextSize, contextState('dark'), 'middle')
  results['context-dark-bottom'] = await captureOverlay(
    'context-dark-bottom', 'context-menu', contextSize, contextState('dark'), 'bottom')
  results['context-light-middle'] = await captureOverlay(
    'context-light-middle', 'context-menu', contextSize, contextState('light'), 'middle')
  console.log(JSON.stringify(results, null, 2))
  app.quit()
}).catch((error) => {
  console.error(error?.stack || error)
  app.exit(1)
})
