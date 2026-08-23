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
  if (tab.capturing) blockers.push('capture')
  if (tab.downloading) blockers.push('download')
  if (tab.dirtyForm) blockers.push('unsaved-form')
  if (neverDomains.includes(hostnameOf(tab.url))) blockers.push('never-sleep-domain')

  const idle = now - (tab.lastActiveAt || now)
  if (idle < timeoutMs) blockers.push('recent')

  return blockers
}

function shouldHibernate(tab, context) {
  return sleepBlockers(tab, context).length === 0
}

// Installed in the page's main world once per document. Counts live capture
// streams, which is the only reliable way to see camera/microphone use from
// outside Chromium.
const MEDIA_PROBE_SCRIPT = `(() => {
  if (window.__emberMediaProbe) return true
  const streams = new Set()
  window.__emberMediaProbe = {
    live() {
      for (const stream of streams) {
        if (stream.getTracks().some((track) => track.readyState === 'live')) return true
        streams.delete(stream)
      }
      return false
    },
  }
  const devices = navigator.mediaDevices
  if (!devices) return true
  for (const name of ['getUserMedia', 'getDisplayMedia']) {
    const original = devices[name]
    if (typeof original !== 'function') continue
    devices[name] = function (...args) {
      return Promise.resolve(original.apply(this, args)).then((stream) => { streams.add(stream); return stream })
    }
  }
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
  return {
    playingMedia: playing,
    capturing: !!window.__emberMediaProbe && window.__emberMediaProbe.live(),
    dirtyForm: dirtyField || dirtyEditable,
  }
})()`

/**
 * Drives the sweep. Knows nothing about how a tab is discarded — it asks the
 * TabManager to hibernate, so tests can pass a stub.
 */
class HibernationManager {
  /**
   * @param {import('./tabs').TabManager} tabs
   * @param {{ config: () => object, isDownloading?: (tab: object) => boolean, interval?: number }} opts
   */
  constructor(tabs, { config, isDownloading = () => false, interval = SWEEP_INTERVAL } = {}) {
    this.tabs = tabs
    this.config = config || (() => HIBERNATION_DEFAULTS)
    this.isDownloading = isDownloading
    this.interval = interval
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

  async #probe(tab) {
    const wc = tab.webContents
    if (!wc || wc.isDestroyed?.()) return { playingMedia: false, capturing: false, dirtyForm: false }
    try {
      const result = await wc.executeJavaScript(STATE_PROBE_SCRIPT, true)
      return {
        playingMedia: !!result?.playingMedia,
        capturing: !!result?.capturing,
        dirtyForm: !!result?.dirtyForm,
      }
    } catch {
      // A page that cannot be questioned is a page we do not discard.
      return { playingMedia: true, capturing: true, dirtyForm: true }
    }
  }
}

module.exports = {
  HibernationManager,
  HIBERNATION_DEFAULTS,
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
