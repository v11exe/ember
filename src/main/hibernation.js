// Tab hibernation: after a configurable idle period a background tab genuinely
// loses its renderer instead of merely being marked asleep.
//
// The policy half of this file is pure so it can be tested without a window.
// `sleepBlockers()` answers "why is this tab still awake?" and everything else
// — the sweep timer, the page probes — only feeds it facts.
//
// Chromium's own TabLifecycleUnitSource is the reference for which categories
// must never be discarded; the list below follows it, plus Ember's own
// per-tab and per-domain opt-outs.

const HIBERNATION_DEFAULTS = { enabled: true, minutes: 30, neverDomains: [] }
const MIN_MINUTES = 1
const MAX_MINUTES = 720
const SWEEP_INTERVAL = 15_000
const PROBE_TIMEOUT = 2_000
const MAX_NEVER_DOMAINS = 200

/** eTLD-ish key for the never-sleep list: hostname without a leading www. */
function hostnameOf(url) {
  try {
    return new URL(String(url)).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

function sanitiseHibernation(value) {
  const source = value && typeof value === 'object' ? value : {}
  const minutes = Number(source.minutes)
  const domains = Array.isArray(source.neverDomains) ? source.neverDomains : []
  return {
    enabled: source.enabled !== false,
    minutes: Number.isFinite(minutes)
      ? Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(minutes)))
      : HIBERNATION_DEFAULTS.minutes,
    neverDomains: [...new Set(domains
      .map((domain) => String(domain || '').trim().toLowerCase().replace(/^www\./, ''))
      .filter(Boolean))].slice(0, MAX_NEVER_DOMAINS),
  }
}

/** Only real web pages sleep; ember:// pages hold no meaningful renderer cost. */
function isSleepableUrl(url) {
  return /^https?:\/\//i.test(String(url || ''))
}

/**
 * Every reason this tab must stay awake, in the order they are worth reporting.
 * An empty array means it is safe to discard.
 *
 * @param {object} tab                 tab record, plus live probe results
 * @param {object} context             { now, timeoutMs, enabled, neverDomains }
 */
function sleepBlockers(tab = {}, context = {}) {
  const {
    now = Date.now(),
    timeoutMs = HIBERNATION_DEFAULTS.minutes * 60_000,
    enabled = true,
    neverDomains = [],
  } = context
  const blockers = []

  if (!enabled) blockers.push('disabled')
  if (tab.asleep) blockers.push('asleep')
  if (tab.active) blockers.push('active')
  if (tab.visible) blockers.push('visible') // split panes, floating tabs, a live follower
  if (tab.neverSleep) blockers.push('never-sleep')
  if (tab.protected) blockers.push('protected')
  if (!isSleepableUrl(tab.url)) blockers.push('internal')
  if (tab.loading) blockers.push('loading')
  if (tab.audible) blockers.push('audio')
  if (tab.playingMedia) blockers.push('media')
  if (tab.pictureInPicture) blockers.push('picture-in-picture')
  if (tab.fullscreen) blockers.push('fullscreen')
  if (tab.capturing) blockers.push('capture')
  if (tab.downloading) blockers.push('download')
  if (tab.dirtyForm) blockers.push('unsaved-form')
  if (tab.warnsOnExit) blockers.push('warns-on-exit')
  if (neverDomains.includes(hostnameOf(tab.url))) blockers.push('never-sleep-domain')

  // A tab restored from a saved session carries lastActiveAt 0, meaning "never
  // looked at". `|| now` would read that as "used a moment ago", so the check
  // has to distinguish a real zero from a missing value.
  const lastActive = Number.isFinite(tab.lastActiveAt) ? tab.lastActiveAt : now
  if (now - lastActive < timeoutMs) blockers.push('recent')

  return blockers
}

function shouldHibernate(tab, context) {
  return sleepBlockers(tab, context).length === 0
}

// Installed in the page's main world once per document.
//
// Two things Chromium knows and Electron does not expose: whether a capture
// stream is live, and whether the page has asked to be warned before it goes
// away. Both need a hook inside the page, so this wraps two APIs — and puts
// the original's toString() back on the wrapper, because a patched native is
// exactly the sort of thing fingerprinting scripts look for.
const MEDIA_PROBE_SCRIPT = `(() => {
  if (window.__emberProbe) return true
  const streams = new Set()
  let exitWarnings = 0
  window.__emberProbe = {
    capturing() {
      for (const stream of streams) {
        if (stream.getTracks().some((track) => track.readyState === 'live')) return true
        streams.delete(stream)
      }
      return false
    },
    warnsOnExit() {
      return exitWarnings > 0 || typeof window.onbeforeunload === 'function'
    },
  }

  const disguise = (wrapper, original) => {
    try {
      Object.defineProperty(wrapper, 'name', { value: original.name, configurable: true })
      Object.defineProperty(wrapper, 'toString', {
        value: original.toString.bind(original), configurable: true, writable: true,
      })
    } catch { /* frozen prototypes are the page's business, not ours */ }
    return wrapper
  }

  const devices = navigator.mediaDevices
  if (devices) {
    for (const name of ['getUserMedia', 'getDisplayMedia']) {
      const original = devices[name]
      if (typeof original !== 'function') continue
      devices[name] = disguise(function (...args) {
        return Promise.resolve(original.apply(this, args)).then((stream) => { streams.add(stream); return stream })
      }, original)
    }
  }

  // A beforeunload listener is the web's own statement that there is unsaved
  // work here. destroy() would skip the dialog, so the tab must not sleep.
  const add = window.addEventListener
  const remove = window.removeEventListener
  window.addEventListener = disguise(function (type, ...rest) {
    if (type === 'beforeunload') exitWarnings += 1
    return add.call(this, type, ...rest)
  }, add)
  window.removeEventListener = disguise(function (type, ...rest) {
    if (type === 'beforeunload') exitWarnings = Math.max(0, exitWarnings - 1)
    return remove.call(this, type, ...rest)
  }, remove)
  return true
})()`

// Evaluated only for tabs that are already past their idle timeout, so the
// common case costs nothing.
const STATE_PROBE_SCRIPT = `(() => {
  const playing = [...document.querySelectorAll('video, audio')]
    .some((element) => !element.paused && !element.ended && element.currentTime > 0)
  const dirtyField = [...document.querySelectorAll('input, textarea, select')].some((field) => {
    if (field.disabled || field.type === 'submit' || field.type === 'button' || field.type === 'hidden') return false
    if (field.tagName === 'SELECT') return [...field.options].some((option) => option.selected !== option.defaultSelected)
    if (field.type === 'checkbox' || field.type === 'radio') return field.checked !== field.defaultChecked
    return field.value !== field.defaultValue
  })
  const dirtyEditable = [...document.querySelectorAll('[contenteditable=""], [contenteditable="true"]')]
    .some((element) => element.textContent.trim().length > 0)
  const probe = window.__emberProbe
  return {
    playingMedia: playing,
    capturing: !!probe && probe.capturing(),
    dirtyForm: dirtyField || dirtyEditable,
    warnsOnExit: !!probe && probe.warnsOnExit(),
    // A video the reader popped out, or anything mid-fullscreen, is in use
    // even though the tab itself is in the background.
    pictureInPicture: !!document.pictureInPictureElement,
    fullscreen: !!document.fullscreenElement,
  }
})()`

/** What the sweep assumes about a page it could not question. */
const PROBE_UNAVAILABLE = {
  playingMedia: true, capturing: true, dirtyForm: true,
  warnsOnExit: true, pictureInPicture: true, fullscreen: true,
}

const PROBE_CLEAR = {
  playingMedia: false, capturing: false, dirtyForm: false,
  warnsOnExit: false, pictureInPicture: false, fullscreen: false,
}

/**
 * Re-apply a remembered scroll offset after a tab wakes.
 *
 * A single scrollTo at dom-ready lands at the top of anything that is still
 * growing, so this keeps re-applying while the document gets taller — and
 * stops the moment the reader touches the page, because then they have said
 * where they want to be.
 */
function scrollRestoreScript(x = 0, y = 0, { timeout = 4000, step = 120 } = {}) {
  const targetX = Number(x) || 0
  const targetY = Number(y) || 0
  return `(() => {
    const targetX = ${targetX}, targetY = ${targetY}
    let stopped = false
    const events = ['wheel', 'touchstart', 'keydown', 'mousedown']
    const release = () => { for (const name of events) window.removeEventListener(name, stop, true) }
    function stop() { stopped = true; release() }
    for (const name of events) window.addEventListener(name, stop, { capture: true, once: true })
    const deadline = performance.now() + ${timeout}
    const apply = () => {
      if (stopped) return
      window.scrollTo(targetX, targetY)
      const arrived = Math.abs(window.scrollY - targetY) <= 2 && Math.abs(window.scrollX - targetX) <= 2
      if (arrived || performance.now() > deadline) { release(); return }
      setTimeout(apply, ${step})
    }
    apply()
  })()`
}

/**
 * Drives the sweep. Knows nothing about how a tab is discarded — it asks the
 * TabManager to hibernate, so tests can pass a stub.
 */
class HibernationManager {
  /**
   * @param {import('./tabs').TabManager} tabs
   * @param {{ config: () => object, isDownloading?: (tab: object) => boolean, interval?: number }} opts
   */
  constructor(tabs, {
    config, isDownloading = () => false, interval = SWEEP_INTERVAL, probeTimeout = PROBE_TIMEOUT,
  } = {}) {
    this.tabs = tabs
    this.config = config || (() => HIBERNATION_DEFAULTS)
    this.isDownloading = isDownloading
    this.interval = interval
    this.probeTimeout = probeTimeout
    this.timer = null
    this.sweeping = false
  }

  start() {
    if (this.timer) return this
    this.timer = setInterval(() => {
      this.sweep().catch((error) => console.warn('[ember] hibernation sweep failed:', error.message))
    }, this.interval)
    this.timer.unref?.()
    return this
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  /** Candidates are cheap to reject, so probe only what survives the pure pass. */
  async sweep(now = Date.now()) {
    if (this.sweeping) return []
    const settings = sanitiseHibernation(this.config())
    if (!settings.enabled) return []
    this.sweeping = true
    const context = {
      now,
      enabled: true,
      timeoutMs: settings.minutes * 60_000,
      neverDomains: settings.neverDomains,
    }
    const slept = []
    try {
      for (const tab of [...this.tabs.tabs]) {
        const facts = {
          ...tab,
          active: tab.id === this.tabs.activeId,
          audible: !!tab.webContents?.isCurrentlyAudible?.(),
          downloading: !!this.isDownloading(tab),
        }
        if (sleepBlockers(facts, context).length) continue

        const probe = await this.#probe(tab)
        if (sleepBlockers({ ...facts, ...probe }, context).length) continue
        if (await this.tabs.hibernate(tab.id)) slept.push(tab.id)
      }
    } finally {
      this.sweeping = false
    }
    return slept
  }

  /**
   * A page busy in a long synchronous task never answers, and an unbounded
   * await there would wedge the sweep for the rest of the session. Losing the
   * race counts as "cannot be questioned", which means "do not discard".
   */
  async #probe(tab) {
    const wc = tab.webContents
    if (!wc || wc.isDestroyed?.()) return { ...PROBE_CLEAR }
    let timer = null
    try {
      const answer = wc.executeJavaScript(STATE_PROBE_SCRIPT, true)
      const expiry = new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('probe timed out')), this.probeTimeout)
        timer.unref?.()
      })
      const result = await Promise.race([answer, expiry])
      return {
        playingMedia: !!result?.playingMedia,
        capturing: !!result?.capturing,
        dirtyForm: !!result?.dirtyForm,
        warnsOnExit: !!result?.warnsOnExit,
        pictureInPicture: !!result?.pictureInPicture,
        fullscreen: !!result?.fullscreen,
      }
    } catch {
      return { ...PROBE_UNAVAILABLE }
    } finally {
      clearTimeout(timer)
    }
  }
}

module.exports = {
  HibernationManager,
  HIBERNATION_DEFAULTS,
  PROBE_TIMEOUT,
  PROBE_CLEAR,
  PROBE_UNAVAILABLE,
  scrollRestoreScript,
  MIN_MINUTES,
  MAX_MINUTES,
  SWEEP_INTERVAL,
  MEDIA_PROBE_SCRIPT,
  STATE_PROBE_SCRIPT,
  hostnameOf,
  sanitiseHibernation,
  isSleepableUrl,
  sleepBlockers,
  shouldHibernate,
}
