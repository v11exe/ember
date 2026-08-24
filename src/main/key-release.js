const path = require('node:path')
const fs = require('node:fs/promises')
const { spawn, execFile: execFileCallback } = require('node:child_process')
const { promisify } = require('node:util')

const execFile = promisify(execFileCallback)

const SOURCE = path.join(__dirname, '..', 'native', 'ember-key-watch.cs')
const CSC = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe')

/** Windows virtual-key codes for the modifiers a chord can be held with. */
const VK_CONTROL = 0x11

const POLL_MS = 24
// Nobody holds a switcher open for five minutes; past that the watcher gives up
// rather than lingering as an orphan process.
const TIMEOUT_MS = 300_000

/**
 * Watches for a held modifier to be released.
 *
 * This exists because no surface inside Ember reports it dependably. A
 * `BaseWindow` does not route keys to whichever `WebContentsView` was focused,
 * and a sandboxed page view never surfaces a modifier's key-up through
 * `before-input-event` — so a Ctrl+Tab chord could be let go with nothing in
 * the browser hearing it, which is what left the switcher stuck on screen. The
 * OS always knows, so it is asked.
 *
 * One short-lived process per chord, killed the moment the switcher closes for
 * any other reason.
 */
class ModifierWatch {
  /**
   * @param {{ userDataPath: string, platform?: string, run?: Function }} options
   */
  constructor({ userDataPath, platform = process.platform, run = null }) {
    this.platform = platform
    this.run = run
    this.executable = path.join(userDataPath || process.cwd(), 'ember-key-watch.exe')
    this.buildPromise = null
    this.child = null
    this.generation = 0
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

  /**
   * Call `onRelease` once the modifier is up. Starting a new watch cancels any
   * watch already running, so only the current chord is ever pending.
   */
  async start(onRelease) {
    this.stop()
    if (this.platform !== 'win32') return false
    const generation = ++this.generation
    try {
      await this.#ensureBinary()
    } catch (error) {
      console.warn('[ember] modifier watch could not be built:', error.message)
      return false
    }
    if (generation !== this.generation) return false

    const args = [String(VK_CONTROL), String(POLL_MS), String(TIMEOUT_MS)]
    if (this.run) {
      // Injected for tests: resolve however the fake decides to.
      void Promise.resolve(this.run(args)).then((released) => {
        if (generation === this.generation && released) onRelease()
      }, () => {})
      return true
    }

    const child = spawn(this.executable, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] })
    this.child = child
    child.unref?.()
    let said = ''
    child.stdout.on('data', (chunk) => { said += String(chunk) })
    child.on('error', () => { if (this.child === child) this.child = null })
    child.on('close', () => {
      if (this.child === child) this.child = null
      if (generation !== this.generation) return
      if (said.includes('up')) onRelease()
    })
    return true
  }

  /** No longer interested — the chord ended some other way. */
  stop() {
    this.generation += 1
    const child = this.child
    this.child = null
    if (!child) return
    try { child.kill() } catch { /* already gone */ }
  }
}

module.exports = { ModifierWatch, VK_CONTROL, POLL_MS, TIMEOUT_MS }
