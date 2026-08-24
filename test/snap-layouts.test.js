const test = require('node:test')
const assert = require('node:assert/strict')

const {
  LAYOUTS, GROUP_WIDTH, GROUP_HEIGHT, PADDING,
  layoutsFor, pickerSize, groupRects, zoneRectIn, zoneBounds, zoneAtPoint,
} = require('../src/shared/snap-layouts')

const LANDSCAPE = { x: 0, y: 0, width: 2560, height: 1400 }

test('every arrangement tiles its display exactly', () => {
  for (const layout of LAYOUTS) {
    const covered = layout.zones.reduce((total, zone) => total + zone.w * zone.h, 0)
    assert.ok(Math.abs(covered - 1) < 1e-9, `${layout.id} covers ${covered} of the screen`)
  }
})

test('zones meet on shared edges rather than drifting by a pixel', () => {
  const area = { x: 100, y: 50, width: 1001, height: 701 }
  for (const layout of LAYOUTS) {
    const rects = layout.zones.map((zone) => zoneBounds(area, zone))
    // Every edge is either the screen's own or shared exactly with a neighbour.
    for (const rect of rects) {
      const right = rect.x + rect.width
      const bottom = rect.y + rect.height
      const touchesRight = right === area.x + area.width
        || rects.some((other) => other.x === right)
      const touchesBottom = bottom === area.y + area.height
        || rects.some((other) => other.y === bottom)
      assert.ok(touchesRight, `${layout.id}: a right edge at ${right} meets nothing`)
      assert.ok(touchesBottom, `${layout.id}: a bottom edge at ${bottom} meets nothing`)
    }
    const total = rects.reduce((sum, rect) => sum + rect.width * rect.height, 0)
    assert.equal(total, area.width * area.height, `${layout.id} leaves a gap or overlaps`)
  }
})

test('a portrait display is not offered the column arrangements', () => {
  const portrait = layoutsFor({ x: 0, y: 0, width: 1080, height: 1920 }).map((l) => l.id)
  assert.ok(!portrait.includes('thirds'), 'three columns on a portrait screen are unusable')
  assert.ok(portrait.includes('quarters'))
  assert.ok(layoutsFor(LANDSCAPE).map((l) => l.id).includes('thirds'))
})

test('the picker is exactly as wide as the groups it holds', () => {
  const layouts = layoutsFor(LANDSCAPE)
  const size = pickerSize(layouts.length)
  const rects = groupRects(layouts.length)
  assert.equal(rects.length, layouts.length)
  assert.equal(rects[0].x, PADDING)
  assert.equal(size.height, PADDING * 2 + GROUP_HEIGHT)
  const last = rects[rects.length - 1]
  assert.equal(last.x + last.width + PADDING, size.width)
  assert.equal(last.width, GROUP_WIDTH)
})

test('a point in the picker resolves to the zone drawn under it', () => {
  const layouts = layoutsFor(LANDSCAPE)
  const groups = groupRects(layouts.length)
  for (let index = 0; index < layouts.length; index += 1) {
    const layout = layouts[index]
    for (let zoneIndex = 0; zoneIndex < layout.zones.length; zoneIndex += 1) {
      const cell = zoneRectIn(groups[index], layout.zones[zoneIndex], 0)
      const middle = { x: cell.x + cell.width / 2, y: cell.y + cell.height / 2 }
      assert.deepEqual(
        zoneAtPoint(layouts, middle),
        { layout: layout.id, zone: zoneIndex },
        `${layout.id} zone ${zoneIndex}`,
      )
    }
  }
})

test('the gutters between zones still belong to a zone', () => {
  const layouts = layoutsFor(LANDSCAPE)
  const groups = groupRects(layouts.length)
  const halves = layouts.findIndex((layout) => layout.id === 'halves')
  const group = groups[halves]
  // Exactly on the seam: a drop here must land somewhere, not in a dead pixel.
  const seam = { x: group.x + group.width / 2, y: group.y + group.height / 2 }
  assert.ok(zoneAtPoint(layouts, seam), 'the seam between two halves is dead')
})

test('padding around the groups is not a target', () => {
  const layouts = layoutsFor(LANDSCAPE)
  assert.equal(zoneAtPoint(layouts, { x: 2, y: 2 }), null)
  const size = pickerSize(layouts.length)
  assert.equal(zoneAtPoint(layouts, { x: size.width - 2, y: size.height - 2 }), null)
})

test('a chosen zone becomes a real rectangle on the work area', () => {
  const area = { x: -1080, y: -600, width: 1080, height: 1920 }
  const halves = LAYOUTS.find((layout) => layout.id === 'halves')
  assert.deepEqual(zoneBounds(area, halves.zones[0]), { x: -1080, y: -600, width: 540, height: 1920 })
  assert.deepEqual(zoneBounds(area, halves.zones[1]), { x: -540, y: -600, width: 540, height: 1920 })
})
