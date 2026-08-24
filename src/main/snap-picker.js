const path = require('node:path')
const { IPC } = require('../shared/ipc')
const {
  layoutsFor, pickerSize, zoneAtPoint, zoneBounds,
} = require('../shared/snap-layouts')

// How far below the top of the work area the picker hangs.
const DROP = 6

/**
 * The arrangement picker, as its own screen-anchored window.
 *
 * It cannot live inside the browser window. During a drag the browser window
 * follows the cursor one-to-one, so an overlay inside it would travel with the
 * pointer and no zone but the one under the cursor could ever be reached. A
 * separate always-on-top window stays where the display put it while the
 * browser slides around underneath.
 *
 * It never takes the mouse either: the pointer belongs to the drag in
 * progress, so the window is click-through and main hit-tests the cursor
 * against the shared geometry instead.
 */
class SnapPicker {
  /**
   * @param {{ createWindow?: Function, screen: Electron.Screen }} deps
   */
  constructor({ createWindow = null, screen }) {
    this.screen = screen
    this.createWindow = createWindow || (() => {
      const { BrowserWindow } = require('electron')
      return new BrowserWindow({
        show: false,
        frame: false,
        transparent: true,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        skipTaskbar: true,
        focusable: false,
        alwaysOnTop: true,
        hasShadow: false,
        backgroundColor: '#00000000',
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
          preload: path.join(__dirname, '..', 'renderer', 'overlay-preload.js'),
        },
      })
    })
    this.win = null
    this.loaded = false
    this.open = false
    this.layouts = []
    this.bounds = null
    this.hot = null
  }

  #ensure() {
    if (this.win) return this.win
    const win = this.createWindow()
    this.win = win
    win.setIgnoreMouseEvents?.(true)
    win.webContents.on('did-finish-load', () => { this.loaded = true; this.#send() })
    win.loadURL('ember://snap')
    return win
  }

  /** Put the picker at the top of whichever display the pointer is on. */
  show(point) {
    const display = this.screen.getDisplayNearestPoint(point)
    const area = display.workArea
    this.layouts = layoutsFor(area)
    const size = pickerSize(this.layouts.length)
    this.bounds = {
      x: Math.round(area.x + (area.width - size.width) / 2),
      y: Math.round(area.y + DROP),
      width: size.width,
      height: size.height,
    }
    const win = this.#ensure()
    win.setBounds(this.bounds)
    win.setAlwaysOnTop?.(true, 'screen-saver')
    if (!this.open) win.showInactive?.()
    this.open = true
    this.hot = null
    this.#send()
    return this.bounds
  }

  hide() {
    if (!this.open) return
    this.open = false
    this.hot = null
    this.win?.hide?.()
  }

  destroy() {
    this.open = false
    if (this.win && !this.win.isDestroyed?.()) this.win.destroy()
    this.win = null
    this.loaded = false
  }

  /** True while the cursor is somewhere the picker would act on. */
  contains(point) {
    const bounds = this.bounds
    if (!this.open || !bounds) return false
    return point.x >= bounds.x && point.x <= bounds.x + bounds.width
      && point.y >= bounds.y && point.y <= bounds.y + bounds.height
  }

  /** Light up whichever zone the cursor is over. Cheap enough to call per move. */
  track(point) {
    if (!this.open || !this.bounds) return null
    const local = { x: point.x - this.bounds.x, y: point.y - this.bounds.y }
    const found = zoneAtPoint(this.layouts, local)
    const changed = found?.layout !== this.hot?.layout || found?.zone !== this.hot?.zone
    this.hot = found
    if (changed) this.#send()
    return found
  }

  /**
   * The window rectangle the cursor is asking for, or null. Resolved against
   * the display the picker is on, not the one the pointer wandered to.
   */
  resolve(point) {
    const found = this.track(point)
    if (!found) return null
    const layout = this.layouts.find((candidate) => candidate.id === found.layout)
    const zone = layout?.zones[found.zone]
    if (!zone) return null
    const display = this.screen.getDisplayNearestPoint({
      x: this.bounds.x + this.bounds.width / 2,
      y: this.bounds.y + this.bounds.height / 2,
    })
    return zoneBounds(display.workArea, zone)
  }

  #send() {
    const wc = this.win?.webContents
    if (!this.loaded || !wc || wc.isDestroyed?.()) return
    wc.send(IPC.OVERLAY_STATE, {
      kind: 'snap',
      layouts: this.layouts.map((layout) => ({ id: layout.id, label: layout.label, zones: layout.zones })),
      hot: this.hot,
    })
  }
}

module.exports = { SnapPicker, DROP }
