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

  async setActiveUrl(url) {
    const sequence = ++this.sequence
    const mode = isNativeGlassUrl(url) ? 'accent' : 'none'
    if (this.platform !== 'win32' || this.destroyed) return
    try {
      await this.ensureBridge()
      if (this.destroyed || sequence !== this.sequence) return
      const handle = this.win.getNativeWindowHandle().readBigUInt64LE(0).toString()
      const args = [handle, mode, ACCENT_BLUR_TINT.slice(1)]
      if (this.options.run) await this.options.run(args)
      else await execFile(this.executable, args, { windowsHide: true })
    } catch (error) {
      console.warn(`[ember] native backdrop could not apply ${mode}: ${error.message}`)
    }
  }

  layoutPage() {}
  layoutSearch() {}
  destroy() { this.destroyed = true; this.sequence += 1 }
}

module.exports = { NativeBackdrop }
