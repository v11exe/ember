function usable(viewport, margin) {
  return {
    x: viewport.x + margin,
    y: viewport.y + margin,
    width: Math.max(0, viewport.width - margin * 2),
    height: Math.max(0, viewport.height - margin * 2),
  }
}

function centerPanel(viewport, desired, margin = 12) {
  const area = usable(viewport, margin)
  const width = Math.min(desired.width, area.width)
  const height = Math.min(desired.height, area.height)
  return {
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(area.y + (area.height - height) / 2),
    width,
    height,
  }
}

function placePointPanel(viewport, point, desired, margin = 8) {
  const area = usable(viewport, margin)
  const width = Math.min(desired.width, area.width)
  const height = Math.min(desired.height, area.height)
  const preferredX = point.x + width <= area.x + area.width ? point.x : point.x - width
  const preferredY = point.y + height <= area.y + area.height ? point.y : point.y - height
  return {
    x: Math.round(Math.min(Math.max(preferredX, area.x), area.x + area.width - width)),
    y: Math.round(Math.min(Math.max(preferredY, area.y), area.y + area.height - height)),
    width,
    height,
  }
}

module.exports = { centerPanel, placePointPanel }
