// Keyboard shortcuts, resolved from an Electron `before-input-event` payload.
//
// Kept as a pure lookup so the whole table can be tested without a window: it
// takes the input descriptor and returns a command name, or null.
//
// Behaviour follows Chrome's Windows shortcuts, so muscle memory transfers.

/** Commands the browser knows how to run. */
const COMMANDS = {
  NEW_TAB: 'new-tab',
  CLOSE_TAB: 'close-tab',
  REOPEN_TAB: 'reopen-tab',
  NEXT_TAB: 'next-tab',          // Ctrl+Tab: walks the switcher
  PREVIOUS_TAB: 'previous-tab',
  NEXT_TAB_STRIP: 'next-tab-strip',      // Ctrl+PageDown: cycles the strip
  PREVIOUS_TAB_STRIP: 'previous-tab-strip',
  END_SWITCH: 'end-switch',      // Ctrl came back up
  SELECT_TAB: 'select-tab',       // carries an index
  LAST_TAB: 'last-tab',
  NEW_WINDOW: 'new-window',
  NEW_PRIVATE_WINDOW: 'new-private-window',
  CLOSE_WINDOW: 'close-window',
  BACK: 'back',
  FORWARD: 'forward',
  RELOAD: 'reload',
  HARD_RELOAD: 'hard-reload',
  STOP: 'stop',
  FOCUS_OMNIBOX: 'focus-omnibox',
  HISTORY: 'history',
  DOWNLOADS: 'downloads',
  SETTINGS: 'settings',
  EXTENSIONS: 'extensions',
  FULLSCREEN: 'fullscreen',
  ZOOM_IN: 'zoom-in',
  ZOOM_OUT: 'zoom-out',
  ZOOM_RESET: 'zoom-reset',
  FIND: 'find',
}

/**
 * @param {{ type: string, key: string, control?: boolean, meta?: boolean, shift?: boolean, alt?: boolean }} input
 * @returns {{ command: string, index?: number }|null}
 */
function resolveShortcut(input) {
  if (!input) return null
  // Releasing the modifier is what commits the Ctrl+Tab switcher, so keyUp is
  // the one non-keyDown event this table cares about.
  if (input.type === 'keyUp') {
    const released = String(input.key || '').toLowerCase()
    return released === 'control' || released === 'meta' ? { command: COMMANDS.END_SWITCH } : null
  }
  if (input.type !== 'keyDown') return null

  const key = String(input.key || '').toLowerCase()
  const mod = !!(input.control || input.meta)
  const shift = !!input.shift
  const alt = !!input.alt

  // Function keys carry no modifier of their own.
  if (key === 'f11' && !mod && !alt) return { command: COMMANDS.FULLSCREEN }
  if (key === 'f5' && !alt) return { command: shift || mod ? COMMANDS.HARD_RELOAD : COMMANDS.RELOAD }
  if (key === 'f6' && !mod && !alt) return { command: COMMANDS.FOCUS_OMNIBOX }
  if (key === 'escape' && !mod && !alt) return { command: COMMANDS.STOP }

  // Alt navigates history, matching the browser back/forward buttons.
  if (alt && !mod && !shift) {
    if (key === 'arrowleft') return { command: COMMANDS.BACK }
    if (key === 'arrowright') return { command: COMMANDS.FORWARD }
    if (key === 'd') return { command: COMMANDS.FOCUS_OMNIBOX }
    if (key === 'home') return { command: COMMANDS.NEW_TAB }
  }

  if (!mod || alt) return null

  // Ctrl+1..8 jump to that tab; Ctrl+9 is always the last one.
  if (!shift && /^[1-9]$/.test(key)) {
    return key === '9'
      ? { command: COMMANDS.LAST_TAB }
      : { command: COMMANDS.SELECT_TAB, index: Number(key) - 1 }
  }

  if (key === 'tab') return { command: shift ? COMMANDS.PREVIOUS_TAB : COMMANDS.NEXT_TAB }
  if (key === 'pagedown') return { command: COMMANDS.NEXT_TAB_STRIP }
  if (key === 'pageup') return { command: COMMANDS.PREVIOUS_TAB_STRIP }

  switch (key) {
    case 't': return { command: shift ? COMMANDS.REOPEN_TAB : COMMANDS.NEW_TAB }
    case 'w': return { command: shift ? COMMANDS.CLOSE_WINDOW : COMMANDS.CLOSE_TAB }
    case 'n': return { command: shift ? COMMANDS.NEW_PRIVATE_WINDOW : COMMANDS.NEW_WINDOW }
    case 'r': return { command: shift ? COMMANDS.HARD_RELOAD : COMMANDS.RELOAD }
    case 'l': return shift ? null : { command: COMMANDS.FOCUS_OMNIBOX }
    case 'h': return shift ? null : { command: COMMANDS.HISTORY }
    case 'j': return shift ? null : { command: COMMANDS.DOWNLOADS }
    case 'f': return shift ? null : { command: COMMANDS.FIND }
    case ',': return shift ? null : { command: COMMANDS.SETTINGS }
    case 'e': return shift ? { command: COMMANDS.EXTENSIONS } : null
    case '0': return { command: COMMANDS.ZOOM_RESET }
    case '+': case '=': return { command: COMMANDS.ZOOM_IN }
    case '-': case '_': return { command: COMMANDS.ZOOM_OUT }
    default: return null
  }
}

/** Zoom steps match Chrome's ladder rather than a linear scale. */
const ZOOM_STEPS = [-3, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5]

function nextZoom(current, direction) {
  const index = ZOOM_STEPS.findIndex((step) => Math.abs(step - current) < 0.01)
  const from = index === -1 ? ZOOM_STEPS.indexOf(0) : index
  const target = Math.min(ZOOM_STEPS.length - 1, Math.max(0, from + direction))
  return ZOOM_STEPS[target]
}

module.exports = { resolveShortcut, COMMANDS, ZOOM_STEPS, nextZoom }
