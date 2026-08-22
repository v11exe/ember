const { NEW_TAB_URL, HISTORY_URL, DOWNLOADS_URL, SETTINGS_URL } = require('./ipc')

const ACCENT_BLUR_TINT = '#8C000000'

// Kept in one mutable-facing contract so a future settings page can replace
// values without rewriting either the native view or the new-tab renderer.
const NATIVE_GLASS_DEFAULTS = Object.freeze({
  pageBlurRadius: 18,
  blurAmountToRadius: 40,
  search: Object.freeze({
    displacementScale: 0,
    blurAmount: 0.05,
    saturation: 95,
    aberrationIntensity: 20,
    elasticity: 0.46,
    cornerRadius: 48,
    borderWidth: 2,
    mode: 'standard',
    padding: '20px 25px',
    mouseContainer: 'pageRef',
    globalMousePos: 'internal',
    onClick: 'function',
  }),
})

// Every internal page sits on the live window material, not just the new tab.
// ember://extensions is deliberately absent: it is the dropdown panel's own
// document, which renders in a bounded view with nothing behind it to refract.
const NATIVE_GLASS_URLS = Object.freeze([
  NEW_TAB_URL, HISTORY_URL, DOWNLOADS_URL, SETTINGS_URL,
])

function isNativeGlassUrl(url) {
  return typeof url === 'string' && NATIVE_GLASS_URLS.some((base) => url.startsWith(base))
}

function snapshotNativeGlassSettings(settings = NATIVE_GLASS_DEFAULTS) {
  return {
    pageBlurRadius: settings.pageBlurRadius,
    blurAmountToRadius: settings.blurAmountToRadius,
    search: { ...settings.search },
  }
}

module.exports = {
  ACCENT_BLUR_TINT, NATIVE_GLASS_DEFAULTS, NATIVE_GLASS_URLS,
  isNativeGlassUrl, snapshotNativeGlassSettings,
}
