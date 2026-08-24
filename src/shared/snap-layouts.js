// Snap layouts — the arrangement picker Windows 11 shows when a window is
// dragged to the top of the screen.
//
// Ember cannot summon the real one. That flyout is the shell's, and it appears
// only for a window the OS itself is moving or one that answers WM_NCHITTEST
// with HTMAXBUTTON — neither of which is reachable from a `BaseWindow` whose
// `WebContentsView` cannot carry a native drag region, and the second of which
// needs a window procedure hook in Ember's own process. So Ember offers the
// same choice itself, with the same arrangements.
//
// Everything here is pure geometry in two coordinate systems, kept together so
// main and the picker page cannot disagree about where a zone is: fractions of
// a display's work area, and pixels inside the picker.

/** A zone is a fraction of the work area: x/y/w/h in 0..1. */
const LAYOUTS = [
  { id: 'halves', label: 'Halves', zones: [
    { x: 0, y: 0, w: 1 / 2, h: 1 },
    { x: 1 / 2, y: 0, w: 1 / 2, h: 1 },
  ] },
  { id: 'wide-left', label: 'Two thirds and a third', zones: [
    { x: 0, y: 0, w: 2 / 3, h: 1 },
    { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
  ] },
  { id: 'wide-right', label: 'A third and two thirds', zones: [
    { x: 0, y: 0, w: 1 / 3, h: 1 },
    { x: 1 / 3, y: 0, w: 2 / 3, h: 1 },
  ] },
  { id: 'thirds', label: 'Thirds', zones: [
    { x: 0, y: 0, w: 1 / 3, h: 1 },
    { x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
    { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
  ] },
  { id: 'left-stack', label: 'Half and two stacked', zones: [
    { x: 0, y: 0, w: 1 / 2, h: 1 },
    { x: 1 / 2, y: 0, w: 1 / 2, h: 1 / 2 },
    { x: 1 / 2, y: 1 / 2, w: 1 / 2, h: 1 / 2 },
  ] },
  { id: 'quarters', label: 'Quarters', zones: [
    { x: 0, y: 0, w: 1 / 2, h: 1 / 2 },
    { x: 1 / 2, y: 0, w: 1 / 2, h: 1 / 2 },
    { x: 0, y: 1 / 2, w: 1 / 2, h: 1 / 2 },
    { x: 1 / 2, y: 1 / 2, w: 1 / 2, h: 1 / 2 },
  ] },
]

// The picker's own measurements. Shared so that the rect main hit-tests and
// the rect the page paints are the same rect.
const GROUP_WIDTH = 96
const GROUP_HEIGHT = 60
const GROUP_GAP = 10
const PADDING = 12
const ZONE_GAP = 3

/** Portrait displays cannot use the column layouts; they get the stacks. */
function layoutsFor(area) {
  const landscape = !area || area.width >= area.height
  return landscape ? LAYOUTS : LAYOUTS.filter((layout) => layout.id !== 'thirds')
}

function pickerSize(count) {
  return {
    width: PADDING * 2 + count * GROUP_WIDTH + Math.max(0, count - 1) * GROUP_GAP,
    height: PADDING * 2 + GROUP_HEIGHT,
  }
}

/** Each group's box, in pixels relative to the picker's top-left corner. */
function groupRects(count) {
  return Array.from({ length: count }, (_unused, index) => ({
    x: PADDING + index * (GROUP_WIDTH + GROUP_GAP),
    y: PADDING,
    width: GROUP_WIDTH,
    height: GROUP_HEIGHT,
  }))
}

/**
 * A fractional zone as pixels inside a group's box.
 *
 * Edges are rounded, not sizes, so neighbouring zones meet exactly instead of
 * drifting apart by a pixel at some fractions and overlapping at others.
 */
function zoneRectIn(group, zone, gap = ZONE_GAP) {
  const left = Math.round(group.x + zone.x * group.width)
  const top = Math.round(group.y + zone.y * group.height)
  const right = Math.round(group.x + (zone.x + zone.w) * group.width)
  const bottom = Math.round(group.y + (zone.y + zone.h) * group.height)
  const half = gap / 2
  return {
    x: Math.round(left + (zone.x > 0 ? half : 0)),
    y: Math.round(top + (zone.y > 0 ? half : 0)),
    width: Math.max(1, Math.round(right - left - (zone.x > 0 ? half : 0) - (zone.x + zone.w < 1 ? half : 0))),
    height: Math.max(1, Math.round(bottom - top - (zone.y > 0 ? half : 0) - (zone.y + zone.h < 1 ? half : 0))),
  }
}

/** The same zone as a real window rectangle on a display. */
function zoneBounds(area, zone) {
  const left = Math.round(area.x + zone.x * area.width)
  const top = Math.round(area.y + zone.y * area.height)
  const right = Math.round(area.x + (zone.x + zone.w) * area.width)
  const bottom = Math.round(area.y + (zone.y + zone.h) * area.height)
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) }
}

/**
 * Which zone a point inside the picker is asking for, or null.
 *
 * Main hit-tests this rather than asking the picker page, because during a
 * drag the pointer belongs to the window being moved and the overlay never
 * sees it.
 */
function zoneAtPoint(layouts, point) {
  const groups = groupRects(layouts.length)
  for (let index = 0; index < layouts.length; index += 1) {
    const group = groups[index]
    if (point.x < group.x || point.x > group.x + group.width) continue
    if (point.y < group.y || point.y > group.y + group.height) continue
    const layout = layouts[index]
    for (let zoneIndex = 0; zoneIndex < layout.zones.length; zoneIndex += 1) {
      // Hit-test the ungapped cell, so the gutters between zones still belong
      // to one of them and there is no dead pixel to drop into.
      const cell = zoneRectIn(group, layout.zones[zoneIndex], 0)
      if (point.x < cell.x || point.x > cell.x + cell.width) continue
      if (point.y < cell.y || point.y > cell.y + cell.height) continue
      return { layout: layout.id, zone: zoneIndex }
    }
  }
  return null
}

module.exports = {
  LAYOUTS, GROUP_WIDTH, GROUP_HEIGHT, GROUP_GAP, PADDING, ZONE_GAP,
  layoutsFor, pickerSize, groupRects, zoneRectIn, zoneBounds, zoneAtPoint,
}
