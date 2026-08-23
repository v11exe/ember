const axis = new URLSearchParams(location.search).get('axis')
document.body.dataset.axis = axis === 'right' ? 'right' : 'bottom'
document.querySelector('.frame-surface').classList.add(axis === 'right' ? 'shell-edge-right' : 'shell-edge-bottom')
