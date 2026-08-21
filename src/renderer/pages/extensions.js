const list = document.getElementById('ext-list')
const panel = document.getElementById('panel')

// Window-relative offset of this view, needed because popup anchoring is
// measured from the window origin, not from this page.
let origin = { x: 0, y: 0 }
window.emberPanel.onOrigin((next) => { origin = next })

/** Ask main to resize the view to whatever the content actually needs. */
function fit() {
  const height = Math.ceil(panel.scrollHeight) + 2
  window.emberPanel.resize(Math.min(height, 520))
}

/**
 * Open an extension's popup, anchored to its row icon.
 *
 * Alignment is deliberately left without "right": the package positions the
 * popup at anchor.x + anchor.width - popupWidth, so it opens leftward and stays
 * on screen. Passing "right" made it open rightward, off the window edge.
 */
function activate(extensionId, iconEl) {
  const rect = iconEl.getBoundingClientRect()
  const anchorRect = {
    x: origin.x + rect.left,
    y: origin.y + rect.top,
    width: rect.width,
    height: rect.height,
  }
  window.emberPanel.setAnchor(anchorRect)
  window.browserAction.activate('_self', {
    eventType: 'click',
    extensionId,
    alignment: 'bottom',
    anchorRect,
  })
}

function render(extensions) {
  if (!extensions.length) {
    const empty = document.createElement('div')
    empty.className = 'ext-empty'
    const title = document.createElement('strong')
    title.textContent = 'No extensions yet'
    empty.append(title, document.createTextNode(
      'Open the Chrome Web Store and pick one — the install button reads “Add to Ember”.'
    ))
    list.replaceChildren(empty)
    fit()
    return
  }

  list.replaceChildren(...extensions.map((ext) => {
    const row = document.createElement('div')
    row.className = 'ext-row'

    const launch = document.createElement('button')
    launch.className = 'ext-launch'
    launch.title = `Open ${ext.name}`
    const icon = document.createElement('span')
    icon.className = 'ext-icon'
    if (ext.icon) {
      const img = document.createElement('img')
      img.src = ext.icon
      icon.append(img)
    } else {
      icon.classList.add('fallback')
      icon.textContent = (ext.name || '?').charAt(0).toUpperCase()
    }

    const meta = document.createElement('div')
    meta.className = 'ext-meta'
    const name = document.createElement('div')
    name.className = 'ext-name'
    name.textContent = ext.name
    name.title = ext.description || ext.name
    const version = document.createElement('div')
    version.className = 'ext-version'
    version.textContent = 'v' + ext.version
    meta.append(name, version)
    launch.append(icon, meta)
    launch.onclick = () => activate(ext.id, icon)

    const remove = document.createElement('button')
    remove.className = 'ext-remove'
    remove.textContent = 'Remove'
    remove.onclick = async () => {
      remove.disabled = true
      remove.textContent = '…'
      const { extensions: next } = await window.emberPanel.remove(ext.id)
      render(next)
    }

    row.append(launch, remove)
    return row
  }))
  fit()
}

document.getElementById('panel-store').onclick = () => window.emberPanel.openStore()
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.emberPanel.close() })

async function refresh() { render(await window.emberPanel.list()) }
refresh()
