const DEFAULT_MARGIN = 10
const DEFAULT_GAP = 10

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function calculatePopupBounds({
  windowBounds,
  panelBounds,
  anchorRect,
  popupSize,
  margin = DEFAULT_MARGIN,
  gap = DEFAULT_GAP,
}) {
  const width = Math.max(1, Math.min(Math.round(popupSize.width), windowBounds.width - margin * 2))
  const height = Math.max(1, Math.min(Math.round(popupSize.height), windowBounds.height - margin * 2))
  const safeLeft = windowBounds.x + margin
  const safeRight = windowBounds.x + windowBounds.width - margin
  const safeTop = windowBounds.y + margin
  const safeBottom = windowBounds.y + windowBounds.height - margin
  const panelLeft = windowBounds.x + panelBounds.x
  const panelRight = panelLeft + panelBounds.width
  const leftX = panelLeft - gap - width
  const rightX = panelRight + gap

  let x
  if (leftX >= safeLeft) x = leftX
  else if (rightX + width <= safeRight) x = rightX
  else x = safeLeft

  const desiredY = windowBounds.y + anchorRect.y
  const y = clamp(desiredY, safeTop, safeBottom - height)
  return { x: Math.round(x), y: Math.round(y), width, height }
}

module.exports = { calculatePopupBounds, DEFAULT_GAP, DEFAULT_MARGIN }
