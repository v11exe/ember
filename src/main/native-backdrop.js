const path = require('node:path')
const fs = require('node:fs/promises')
const { execFile: execFileCallback } = require('node:child_process')
const { promisify } = require('node:util')

const { ACCENT_BLUR_TINT, isNativeGlassUrl } = require('../shared/native-glass')

const execFile = promisify(execFileCallback)
const SOURCE = path.join(__dirname, '..', 'native', 'ember-accent-blur.cs')
const CSC = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe')

class NativeBackdrop {
  constructor(win, options = {}) {
    this.win = win
    this.options = options
    this.platform = options.platform || process.platform
    this.executable = options.executable || path.join(options.userDataPath || process.cwd(), 'ember-accent-blur.exe')
    this.destroyed = false
    this.sequence = 0
    this.bridgePromise = null
    // The material actually on the window, the one asked for most recently,
    // and the single run allowed to be in flight. See setActiveUrl().
    this.appliedMode = null
    this.pendingMode = null
    this.applying = null
  }

  async ensureBridge() {
    if (this.options.run) return
    if (!this.bridgePromise) {
      this.bridgePromise = fs.access(this.executable).catch(() => execFile(CSC, [
        '/nologo', '/target:exe', `/out:${this.executable}`, SOURCE,
      ], { windowsHide: true }))
    }
    await this.bridgePromise
  }

  /**
   * Put the window's material where this URL wants it.
   *
   * Two rules, both learned the hard way. Moving between two pages that want
   * the same material is not a change, so nothing is spawned — closing tabs
   * quickly used to fire one bridge process per keystroke. And only one run is
   * ever in flight: several processes calling SetWindowCompositionAttribute on
   * the same handle at once takes the window down with no JavaScript error to
   * show for it. A request that arrives mid-run replaces any other request
   * waiting behind it, because only the last one is still true.
   */
  async setActiveUrl(url) {
    const mode = isNativeGlassUrl(url) ? 'accent' : 'none'
    if (this.platform !== 'win32' || this.destroyed) return
    if (mode === this.appliedMode && !this.applying) return
    this.pendingMode = mode
    this.sequence += 1
    if (this.applying) return this.applying
    this.applying = this.#drain().finally(() => { this.applying = null })
    return this.applying
  }

  async #drain() {
    while (!this.destroyed && this.pendingMode !== null) {
      const mode = this.pendingMode
      this.pendingMode = null
      if (mode === this.appliedMode) continue
      try {
        await this.ensureBridge()
        if (this.destroyed) return
        const handle = this.#handle()
        if (!handle) return
        const args = [handle, mode, ACCENT_BLUR_TINT.slice(1)]
        if (this.options.run) await this.options.run(args)
        else await execFile(this.executable, args, { windowsHide: true })
        this.appliedMode = mode
      } catch (error) {
        console.warn(`[ember] native backdrop could not apply ${mode}: ${error.message}`)
        return
      }
    }
  }

  /** The window can go away while a run is queued behind another one. */
  #handle() {
    try {
      if (this.win?.isDestroyed?.()) return null
      return this.win.getNativeWindowHandle().readBigUInt64LE(0).toString()
    } catch {
      return null
    }
  }

  destroy() {
    this.destroyed = true
    this.sequence += 1
    this.pendingMode = null
  }
}

module.exports = { NativeBackdrop }
