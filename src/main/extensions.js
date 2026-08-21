const path = require('node:path')
const fs = require('node:fs')
const { app } = require('electron')

/**
 * Chrome Web Store support.
 *
 * electron-chrome-web-store implements the real CWS install flow (download the
 * .crx, verify, unpack, load). electron-chrome-extensions implements the
 * chrome.* APIs those extensions call at runtime (tabs, browserAction, popups).
 *
 * Honest limits, see README "Extensions": Electron is not Chrome. Extensions
 * relying on APIs Electron does not implement will install and then misbehave.
 */

const STORE_HOSTS = new Set(['chromewebstore.google.com', 'chrome.google.com'])

function extensionsDir() {
  const dir = path.join(app.getPath('userData'), 'Extensions')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

/** @returns {{ extensions: any|null }} */
function setupExtensions(session, hooks) {
  let extensions = null

  try {
    const { ElectronChromeExtensions } = require('electron-chrome-extensions')

    // Without this, browser action icons in the panel resolve to nothing.
    ElectronChromeExtensions.handleCRXProtocol(session)

    extensions = new ElectronChromeExtensions({
      // GPL-3.0 is the free license offered by the package author.
      license: 'GPL-3.0',
      session,
      createTab: async (details) => {
        const id = hooks.createTab(details.url || 'ember://newtab', { active: details.active !== false })
        const tab = hooks.getTab(id)
        return [tab.webContents, hooks.getWindow()]
      },
      selectTab: (tab) => hooks.selectTabByWebContents(tab),
      removeTab: (tab) => hooks.removeTabByWebContents(tab),
      createWindow: async () => hooks.getWindow(),
      removeWindow: () => {},
    })
  } catch (err) {
    console.error('[ember] chrome.* extension APIs unavailable:', err.message)
  }

  try {
    const { installChromeWebStore } = require('electron-chrome-web-store')
    installChromeWebStore({
      session,
      extensionsPath: extensionsDir(),
      loadExtensions: true,        // restore installed extensions on boot
      allowUnpackedExtensions: true,
      autoUpdate: true,
      minimumManifestVersion: 2,   // accept MV2 as well as MV3
    })
  } catch (err) {
    console.error('[ember] Chrome Web Store install flow unavailable:', err.message)
  }

  return { extensions }
}

/**
 * Rebrand the store UI: "Add to Chrome" -> "Add to Ember", the way Opera GX
 * shows "Add to Opera". Cosmetic only — it retitles the store's own buttons,
 * it does not touch Google branding or the extension payload.
 */
const REBRAND = `(() => {
  if (window.__emberRebrand) return
  window.__emberRebrand = true
  const MAP = [
    [/\bAdd to Chrome\b/g, 'Add to Ember'],
    [/\bAdded to Chrome\b/g, 'Added to Ember'],
    [/\bRemove from Chrome\b/g, 'Remove from Ember'],
    [/\bAvailable on Chrome\b/g, 'Available on Ember'],
    [/\bYou're signed in to Chrome\b/g, "You're signed in to Ember"],
  ]
  const swap = (text) => MAP.reduce((acc, [re, to]) => acc.replace(re, to), text)
  const walk = (root) => {
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let n
    while ((n = it.nextNode())) {
      const next = swap(n.nodeValue)
      if (next !== n.nodeValue) n.nodeValue = next
    }
    for (const el of root.querySelectorAll ? root.querySelectorAll('[aria-label],[title]') : []) {
      for (const attr of ['aria-label', 'title']) {
        const v = el.getAttribute(attr)
        if (v) { const next = swap(v); if (next !== v) el.setAttribute(attr, next) }
      }
    }
  }
  const run = () => { try { walk(document.body) } catch {} }
  run()
  new MutationObserver(run).observe(document.documentElement, { childList: true, subtree: true, characterData: true })
})()`

function applyStoreRebranding(webContents) {
  const maybeRebrand = () => {
    let host = ''
    try { host = new URL(webContents.getURL()).host } catch { return }
    if (!STORE_HOSTS.has(host)) return
    webContents.executeJavaScript(REBRAND, true).catch(() => {})
  }
  webContents.on('dom-ready', maybeRebrand)
  webContents.on('did-finish-load', maybeRebrand)
  webContents.on('did-navigate-in-page', maybeRebrand)
}

module.exports = { setupExtensions, applyStoreRebranding, extensionsDir }

// ---------------------------------------------------------------------------
// Panel support: what's installed, and removing one.

const ICON_EXT = { '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp' }

/** Best icon under 128px, inlined as a data URL for the chrome UI. */
function iconDataUrl(ext) {
  const icons = ext.manifest && ext.manifest.icons
  if (!icons) return null
  const size = Object.keys(icons)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a)
    .find((n) => n <= 128)
  if (!size) return null
  try {
    const file = path.join(ext.path, icons[String(size)])
    const mime = ICON_EXT[path.extname(file).toLowerCase()]
    if (!mime) return null
    return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`
  } catch {
    return null
  }
}

// Electron 43 moved these onto session.extensions; keep a fallback for older.
function extensionHost(session) {
  return session.extensions || session
}

function listExtensions(session) {
  return extensionHost(session).getAllExtensions().map((ext) => ({
    id: ext.id,
    name: ext.name,
    version: ext.version,
    description: (ext.manifest && ext.manifest.description) || '',
    icon: iconDataUrl(ext),
  }))
}

async function removeExtension(session, id) {
  try {
    const { uninstallExtension } = require('electron-chrome-web-store')
    await uninstallExtension(id, { session })
    return true
  } catch (err) {
    console.error('[ember] uninstall failed:', err.message)
    try { extensionHost(session).removeExtension(id); return true } catch { return false }
  }
}

module.exports.listExtensions = listExtensions
module.exports.removeExtension = removeExtension
