(function exposeEmberBrand(root) {
  const ICON_ASSET = '/assets/ember-icon.png'
  const LOGO_ASSET = '/assets/ember-logo.png'

  function mountImage(target, className, label) {
    if (!target || typeof target.replaceChildren !== 'function') {
      throw new TypeError('A DOM target is required')
    }
    const image = target.ownerDocument.createElement('span')
    image.className = className
    image.setAttribute('role', 'img')
    image.setAttribute('aria-label', label)
    target.replaceChildren(image)
    return image
  }

  function mountIcon(target) {
    return mountImage(target, 'ember-icon', 'Ember')
  }

  function mountBrand(target) {
    return mountImage(target, 'ember-logo', 'Ember')
  }

  const api = { ICON_ASSET, LOGO_ASSET, mountIcon, mountBrand }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  if (root) root.EmberBrand = api
})(typeof window !== 'undefined' ? window : null)
