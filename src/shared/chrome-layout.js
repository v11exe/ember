const TOPBAR_HEIGHT = 32
const SIDEBAR_WIDTH = 168
const OUTER_INSET = 0
const COLLAPSED_RAIL_WIDTH = 8
const OUTER_RADIUS = 12
const SHELL_INSET = 8
const VIEWPORT_RADIUS = 12
const BOOKMARKS_HEIGHT = 30
const SIDEBAR_TRANSITION_MS = 210

const TAB_MIN_WIDTH = 95
const TAB_MAX_WIDTH = 190
const TAB_GAP = 8
const NEW_TAB_WIDTH = 34
const DRAG_RESERVE = 96

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

/** The one native-page rectangle used by tabs, overlays, and visual QA. */
function viewportBounds({ width, height, sidebarOpen = true, bookmarksVisible = false } = {}) {
  const outerWidth = Math.max(0, Math.round(Number(width) || 0))
  const outerHeight = Math.max(0, Math.round(Number(height) || 0))
  const wantedX = sidebarOpen ? OUTER_INSET + SIDEBAR_WIDTH : COLLAPSED_RAIL_WIDTH
  const wantedY = TOPBAR_HEIGHT + (bookmarksVisible ? BOOKMARKS_HEIGHT : 0)
  const x = Math.min(outerWidth, wantedX)
  const y = Math.min(outerHeight, wantedY)
  return {
    x,
    y,
    width: Math.max(0, outerWidth - x - OUTER_INSET - SHELL_INSET),
    height: Math.max(0, outerHeight - y - OUTER_INSET - SHELL_INSET),
    radius: VIEWPORT_RADIUS,
  }
}

/** Cap long tabs without forcing short labels to consume the same width. */
function dynamicTabMax({
  availableWidth = 0,
  count = 0,
  gap = TAB_GAP,
  plusWidth = NEW_TAB_WIDTH,
  dragReserve = DRAG_RESERVE,
  minimum = TAB_MIN_WIDTH,
  maximum = TAB_MAX_WIDTH,
} = {}) {
  const tabCount = Math.max(0, Math.floor(Number(count) || 0))
  if (!tabCount) return maximum
  const width = Math.max(0, Number(availableWidth) || 0)
  const gaps = Math.max(0, tabCount - 1) * gap
  const share = Math.floor((width - plusWidth - dragReserve - gaps) / tabCount)
  return clamp(share, minimum, maximum)
}

module.exports = {
  TOPBAR_HEIGHT,
  SIDEBAR_WIDTH,
  OUTER_INSET,
  COLLAPSED_RAIL_WIDTH,
  OUTER_RADIUS,
  SHELL_INSET,
  VIEWPORT_RADIUS,
  BOOKMARKS_HEIGHT,
  SIDEBAR_TRANSITION_MS,
  TAB_MIN_WIDTH,
  TAB_MAX_WIDTH,
  TAB_GAP,
  NEW_TAB_WIDTH,
  DRAG_RESERVE,
  viewportBounds,
  dynamicTabMax,
}
