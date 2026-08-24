// ember://snap — the arrangement picker.
//
// Pure presentation. The window is click-through, so this page never sees the
// pointer: main hit-tests the cursor against shared/snap-layouts.js and sends
// back which zone is hot. Every rectangle drawn here comes from that same
// module, so the zone that lights up is the zone that will be snapped to.

const GROUP_WIDTH = 96
const GROUP_HEIGHT = 60
const GROUP_GAP = 10
const PADDING = 12
const ZONE_GAP = 3

const els = {
  shell: document.getElementById('shell'),
  groups: document.getElementById('groups'),
}

els.shell.style.setProperty('--snap-padding', `${PADDING}px`)
els.shell.style.setProperty('--snap-group-gap', `${GROUP_GAP}px`)
els.shell.style.setProperty('--snap-group-width', `${GROUP_WIDTH}px`)
els.shell.style.setProperty('--snap-group-height', `${GROUP_HEIGHT}px`)

/** The pixel rectangle of a fractional zone, matching zoneRectIn() in shared. */
function zoneRect(zone) {
  const left = Math.round(zone.x * GROUP_WIDTH)
  const top = Math.round(zone.y * GROUP_HEIGHT)
  const right = Math.round((zone.x + zone.w) * GROUP_WIDTH)
  const bottom = Math.round((zone.y + zone.h) * GROUP_HEIGHT)
  const half = ZONE_GAP / 2
  return {
    x: Math.round(left + (zone.x > 0 ? half : 0)),
    y: Math.round(top + (zone.y > 0 ? half : 0)),
    width: Math.max(1, Math.round(right - left - (zone.x > 0 ? half : 0) - (zone.x + zone.w < 1 ? half : 0))),
    height: Math.max(1, Math.round(bottom - top - (zone.y > 0 ? half : 0) - (zone.y + zone.h < 1 ? half : 0))),
  }
}

let painted = ''

function render(state) {
  const layouts = state.layouts || []
  const signature = layouts.map((layout) => layout.id).join('|')
  if (signature !== painted) {
    painted = signature
    els.groups.replaceChildren(...layouts.map((layout) => {
      const group = document.createElement('div')
      group.className = 'group'
      group.dataset.layout = layout.id
      group.title = layout.label || ''
      for (const zone of layout.zones) {
        const rect = zoneRect(zone)
        const cell = document.createElement('span')
        cell.className = 'zone'
        cell.style.left = `${rect.x}px`
        cell.style.top = `${rect.y}px`
        cell.style.width = `${rect.width}px`
        cell.style.height = `${rect.height}px`
        group.append(cell)
      }
      return group
    }))
  }

  const hot = state.hot || null
  for (const group of els.groups.children) {
    const active = hot && group.dataset.layout === hot.layout
    group.dataset.hot = String(!!active)
    ;[...group.children].forEach((cell, index) => {
      cell.dataset.hot = String(!!active && index === hot.zone)
    })
  }
}

window.emberOverlay.onState((state) => {
  if (state?.kind === 'snap') render(state)
})
