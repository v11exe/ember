const fs = require('node:fs/promises')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { app, BrowserWindow, ipcMain, nativeImage } = require('electron')

const { registerSchemePrivileges, handleInternalPages } = require('../src/main/protocol')
const { IPC } = require('../src/shared/ipc')
const { buildContextMenu } = require('../src/main/context-menu-model')

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

async function captureOverlay(name, page, size, state) {
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
  const metrics = await win.webContents.executeJavaScript(`({
    viewport: [innerWidth, innerHeight],
    scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
  })`)
  await screenshot(win, `${name}.png`)
  win.destroy()
  return metrics
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
  results['context-menu'] = await captureOverlay('context-menu', 'context-menu', { width: 318, height: 430 }, {
    kind: 'context-menu', backdrop, items: contextItems,
  })
  console.log(JSON.stringify(results, null, 2))
  app.quit()
}).catch((error) => {
  console.error(error?.stack || error)
  app.exit(1)
})
