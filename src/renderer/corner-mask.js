const corner = new URLSearchParams(location.search).get('corner')
const valid = new Set(['top-left', 'top-right', 'bottom-left', 'bottom-right'])
document.body.dataset.corner = valid.has(corner) ? corner : 'top-left'
