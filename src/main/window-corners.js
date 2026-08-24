const path = require('node:path')
const fs = require('node:fs/promises')
const { execFile: execFileCallback } = require('node:child_process')
const { promisify } = require('node:util')

const execFile = promisify(execFileCallback)

const SOURCE = path.join(__dirname, '..', 'native', 'ember-window-corners.cs')
const CSC = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe')

// Several of the events that could clear the preference arrive together — a
// restore is a move and a resize as well — so they are collapsed into one call.
const SETTLE_MS = 120

/**
 * Keeps the window's rounded corners rounded.
 *
 * Ember paints no corner of its own: `OUTER_RADIUS` is 0 and the curve belongs
 * entirely to DWM, which is what stopped the shell and the window disagreeing
 * about where the corner was. The cost of that is a single point of failure —
 * if anything clears `DWMWA_WINDOW_CORNER_PREFERENCE`, the window goes square
 * and nothing in Ember can tell. Electron sets it once at construction and has
 * no setter, so this re-asserts it after the moments that plausibly disturb it.
 *
 * This exists because the square-corner report could not be reproduced across
 * repeated resizes, three maximise/restore cycles, a window sized to the work
 * area, one larger than the display, a move between two displays of different
 * DPI, and switching between an internal page and a website. Rather than keep
 * guessing at the trigger, the state is simply made self-correcting.
 */
class WindowCorners {
  /**
   * @param {import('electron').BaseWindow} win
   * @param {{ userDataPath: string, platform?: string, run?: Function }} options
   */
  constructor(win, { userDataPath, platform = process.platform, run = null } = {}) {
    this.win = win
    this.platform = platform
    this.run = run
    this.executable = path.join(userDataPath || process.cwd(), 'ember-window-corners.exe')
    this.buildPromise = null
    this.timer = null
    this.destroyed = false
  }

  async #ensureBinary() {
    if (this.run) return
    if (!this.buildPromise) {
      this.buildPromise = fs.access(this.executable).catch(() => execFile(CSC, [
        '/nologo', '/target:exe', `/out:${this.executable}`, SOURCE,
      ], { windowsHide: true }))
    }
    await this.buildPromise
  }

  #handle() {
    try {
      if (!this.win || this.win.isDestroyed?.()) return null
      return this.win.getNativeWindowHandle().readBigUInt64LE(0).toString()
    } catch {
      return null
    }
  }

  /** Ask for the corners to be rounded again, once the flurry has settled. */
  reassert() {
    if (this.platform !== 'win32' || this.destroyed) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => { this.timer = null; void this.#apply() }, SETTLE_MS)
    this.timer.unref?.()
  }

  async #apply() {
    // A maximised window is meant to be square; asking for round would be
    // asking Windows for the wrong thing.
    if (this.destroyed || this.win?.isDestroyed?.() || this.win?.isMaximized?.()) return
    try {
      await this.#ensureBinary()
      if (this.destroyed) return
      const handle = this.#handle()
      if (!handle) return
      const args = [handle, 'round']
      if (this.run) await this.run(args)
      else await execFile(this.executable, args, { windowsHide: true })
    } catch (error) {
      console.warn('[ember] window corners could not be re-asserted:', error.message)
    }
  }

  /** Watch the moments that could disturb the preference. */
  watch(screen) {
    if (this.platform !== 'win32') return this
    const again = () => this.reassert()
    for (const event of ['unmaximize', 'restore', 'leave-full-screen', 'show', 'resize', 'move']) {
      this.win.on(event, again)
    }
    screen?.on?.('display-metrics-changed', again)
    this.reassert()
    return this
  }

  destroy() {
    this.destroyed = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }
}

module.exports = { WindowCorners, SETTLE_MS }
