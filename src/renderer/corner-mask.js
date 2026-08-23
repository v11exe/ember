const requestedCorner = new URLSearchParams(location.search).get('corner')
const centres = {
  'top-left': [12, 12],
  'top-right': [0, 12],
  'bottom-left': [12, 0],
  'bottom-right': [0, 0],
}
const corner = requestedCorner in centres ? requestedCorner : 'top-left'
const [centreX, centreY] = centres[corner]
document.body.dataset.corner = corner

let forwarding = false
let pressedPointer = null

function isPagePixel(event) {
  return Math.hypot(event.clientX - centreX, event.clientY - centreY) < 11.35
}

function send(type, event, extra = {}) {
  window.emberCornerMask.send({
    type,
    x: event.clientX,
    y: event.clientY,
    button: ['left', 'middle', 'right'][event.button] || 'left',
    clickCount: Math.max(1, event.detail || 1),
    ...extra,
  })
}

addEventListener('pointerdown', (event) => {
  if (!isPagePixel(event)) return
  pressedPointer = event.pointerId
  forwarding = true
  document.body.setPointerCapture?.(event.pointerId)
  send('mouseDown', event)
  event.preventDefault()
})
addEventListener('pointermove', (event) => {
  if (isPagePixel(event) || event.pointerId === pressedPointer) {
    forwarding = true
    send('mouseMove', event)
  } else if (forwarding) {
    forwarding = false
    send('mouseLeave', event)
  }
})
addEventListener('pointerup', (event) => {
  if (event.pointerId !== pressedPointer && !isPagePixel(event)) return
  send('mouseUp', event)
  pressedPointer = null
})
addEventListener('pointercancel', (event) => {
  if (event.pointerId !== pressedPointer) return
  send('mouseUp', event)
  pressedPointer = null
})
addEventListener('wheel', (event) => {
  if (!isPagePixel(event)) return
  send('mouseWheel', event, {
    deltaX: Math.round(event.deltaX),
    deltaY: Math.round(event.deltaY),
  })
  event.preventDefault()
}, { passive: false })
