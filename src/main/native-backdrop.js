const { ACCENT_BLUR_TINT, NATIVE_GLASS_DEFAULTS, isNativeGlassUrl } = require('../shared/native-glass')

function normalizeGlassRect(rect, viewport) {
  if (!rect || !viewport) return null
  const x = Math.max(0, Math.round(Number(rect.x) || 0))
  const y = Math.max(0, Math.round(Number(rect.y) || 0))
  const width = Math.min(Math.max(0, Math.round(Number(rect.width) || 0)), Math.max(0, viewport.width - x))
  const height = Math.min(Math.max(0, Math.round(Number(rect.height) || 0)), Math.max(0, viewport.height - y))
  if (width < 1 || height < 1 || y >= viewport.height) return null
  return { x, y, width, height }
}

class NativeBackdrop {
  constructor(win, View, settings = NATIVE_GLASS_DEFAULTS) {
    this.win = win
    this.settings = settings
    this.page = new View()
    this.search = new View()
    this.active = false
    this.pageBounds = { x: 0, y: 0, width: 0, height: 0 }

    for (const layer of [this.page, this.search]) {
      layer.setBackgroundColor(ACCENT_BLUR_TINT)
      layer.setVisible(false)
      win.contentView.addChildView(layer)
    }
    this.page.setBackgroundBlur(settings.pageBlurRadius)
    this.search.setBackgroundBlur(Math.round(settings.search.blurAmount * settings.blurAmountToRadius))
    this.search.setBorderRadius(settings.search.cornerRadius)
  }

  setActiveUrl(url) {
    this.active = isNativeGlassUrl(url)
    this.page.setVisible(this.active)
    this.search.setVisible(this.active && this.searchVisible)
  }

  layoutPage({ chromeHeight, width, height }) {
    this.pageBounds = {
      x: 0,
      y: Math.max(0, Math.round(chromeHeight)),
      width: Math.max(0, Math.round(width)),
      height: Math.max(0, Math.round(height - chromeHeight)),
    }
    this.page.setBounds(this.pageBounds)
  }

  layoutSearch(rect) {
    const local = normalizeGlassRect(rect, this.pageBounds)
    this.searchVisible = Boolean(local)
    if (local) {
      this.search.setBounds({
        x: this.pageBounds.x + local.x,
        y: this.pageBounds.y + local.y,
        width: local.width,
        height: local.height,
      })
    }
    this.search.setVisible(this.active && this.searchVisible)
  }

  destroy() {
    for (const layer of [this.page, this.search]) this.win.contentView.removeChildView(layer)
  }
}

module.exports = { NativeBackdrop, normalizeGlassRect }
