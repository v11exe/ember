(function exposeEmberBrand(root) {
  const iconMarkup = `<svg class="ember-icon" viewBox="0 0 460 130" role="img" aria-label="Ember">
    <defs>
      <linearGradient id="ember-tail" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#E8410F"/><stop offset=".45" stop-color="#FF7A18"/>
        <stop offset=".8" stop-color="#FFC93C"/><stop offset="1" stop-color="#FBE6A2"/>
      </linearGradient>
      <radialGradient id="ember-head" cx=".68" cy=".42" r=".75">
        <stop offset="0" stop-color="#FFF6D2"/><stop offset=".45" stop-color="#FFC93C"/>
        <stop offset="1" stop-color="#FF7A18"/>
      </radialGradient>
    </defs>
    <circle cx="392" cy="65" r="46" fill="url(#ember-head)"/>
    <rect x="250" y="19" width="150" height="92" rx="46" fill="url(#ember-tail)"/>
    <g fill="url(#ember-tail)">
      <rect x="176" y="26" width="96" height="17" rx="8.5"/><rect x="150" y="52" width="120" height="16" rx="8"/>
      <rect x="196" y="76" width="86" height="16" rx="8"/><rect x="168" y="98" width="58" height="15" rx="7.5"/>
      <rect x="96" y="30" width="34" height="14" rx="7" opacity=".92"/><rect x="118" y="57" width="26" height="13" rx="6.5" opacity=".8"/>
      <rect x="128" y="88" width="30" height="14" rx="7" opacity=".85"/><rect x="46" y="56" width="22" height="12" rx="6" opacity=".7"/>
      <rect x="88" y="56" width="16" height="12" rx="6" opacity=".55"/>
    </g>
  </svg>`

  function resolveTarget(target) {
    if (!target || typeof target.replaceChildren !== 'function') throw new TypeError('A DOM target is required')
    return target
  }

  function mountIcon(target) {
    target = resolveTarget(target)
    target.innerHTML = iconMarkup
    return target.firstElementChild
  }

  function mountWordmark(target) {
    target = resolveTarget(target)
    const wordmark = target.ownerDocument.createElement('span')
    wordmark.className = 'ember-wordmark'
    wordmark.setAttribute('role', 'img')
    wordmark.setAttribute('aria-label', 'Ember')
    wordmark.textContent = 'EMBER'
    target.replaceChildren(wordmark)
    return wordmark
  }

  function mountBrand(target) {
    target = resolveTarget(target)
    const icon = target.ownerDocument.createElement('span')
    icon.className = 'ember-brand-icon'
    const wordmark = target.ownerDocument.createElement('span')
    wordmark.className = 'ember-brand-wordmark'
    target.replaceChildren(icon, wordmark)
    mountIcon(icon)
    mountWordmark(wordmark)
    return target
  }

  const api = { iconMarkup, mountIcon, mountWordmark, mountBrand }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  if (root) root.EmberBrand = api
})(typeof window !== 'undefined' ? window : null)
