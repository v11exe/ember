const axis = new URLSearchParams(location.search).get('axis')
document.body.dataset.axis = axis === 'right' ? 'right' : 'bottom'
