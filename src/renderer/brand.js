(function exposeEmberBrand(root) {
  const ICON_ASSET = '/assets/ember-icon.png'
  const WORDMARK_FONT_ASSET = '/assets/Necosmic-PersonalUse.otf'

  function requireTarget(target) {
    if (!target || typeof target.replaceChildren !== 'function') {
      throw new TypeError('A DOM target is required')
    }
  }

  function createMeteor(target, className, label) {
    const image = target.ownerDocument.createElement('img')
    image.className = className
    image.src = ICON_ASSET
    image.alt = label
    return image
  }

  function mountIcon(target) {
    requireTarget(target)
    const image = createMeteor(target, 'ember-icon', 'Ember')
    target.replaceChildren(image)
    return image
  }

  function mountBrand(target) {
    requireTarget(target)
    const masthead = target.ownerDocument.createElement('div')
    masthead.className = 'ember-masthead'

    const meteor = createMeteor(target, 'ember-meteor', '')
    const wordmark = target.ownerDocument.createElement('span')
    wordmark.className = 'ember-wordmark'
    wordmark.textContent = 'ember'

    masthead.append(meteor, wordmark)
    target.replaceChildren(masthead)
    return masthead
  }

  const api = { ICON_ASSET, WORDMARK_FONT_ASSET, mountIcon, mountBrand }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  if (root) root.EmberBrand = api
})(typeof window !== 'undefined' ? window : null)
