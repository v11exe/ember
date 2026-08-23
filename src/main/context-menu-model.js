function separator(items) {
  if (items.length && items.at(-1).type !== 'separator') items.push({ type: 'separator' })
}

function command(id, label, enabled = true, shortcut = '') {
  return { type: 'command', id, label, enabled: enabled !== false, shortcut }
}

function buildContextMenu(params = {}, navigation = {}) {
  const items = []
  const flags = params.editFlags || {}
  const suggestions = Array.isArray(params.dictionarySuggestions) ? params.dictionarySuggestions.slice(0, 5) : []

  for (const suggestion of suggestions) items.push(command(`spell:${suggestion}`, suggestion))
  if (params.misspelledWord) {
    items.push(command('dictionary-add', 'Add to dictionary'))
    separator(items)
  }

  if (params.linkURL) {
    items.push(command('open-link', 'Open link in new tab'))
    items.push(command('copy-link', 'Copy link address'))
    separator(items)
  }

  if (params.mediaType === 'image' && params.srcURL) {
    items.push(command('open-image', 'Open image in new tab'))
    items.push(command('copy-image', 'Copy image'))
    items.push(command('copy-image-address', 'Copy image address'))
    separator(items)
  }

  if (params.isEditable) {
    items.push(command('undo', 'Undo', flags.canUndo, 'Ctrl+Z'))
    items.push(command('redo', 'Redo', flags.canRedo, 'Ctrl+Shift+Z'))
    separator(items)
    items.push(command('cut', 'Cut', flags.canCut, 'Ctrl+X'))
    items.push(command('copy', 'Copy', flags.canCopy, 'Ctrl+C'))
    items.push(command('paste', 'Paste', flags.canPaste, 'Ctrl+V'))
    items.push(command('delete', 'Delete', flags.canDelete))
    separator(items)
    items.push(command('select-all', 'Select all', flags.canSelectAll, 'Ctrl+A'))
    separator(items)
  } else if (params.selectionText) {
    items.push(command('copy', 'Copy', flags.canCopy !== false, 'Ctrl+C'))
    separator(items)
  }

  items.push(command('back', 'Back', !!navigation.canGoBack, 'Alt+Left'))
  items.push(command('forward', 'Forward', !!navigation.canGoForward, 'Alt+Right'))
  items.push(command('reload', 'Reload', true, 'Ctrl+R'))
  separator(items)
  items.push(command('save-page', 'Save page as…', true, 'Ctrl+S'))
  items.push(command('print', 'Print…', true, 'Ctrl+P'))
  items.push(command('view-source', 'View page source'))
  items.push(command('inspect', 'Inspect'))

  while (items.at(-1)?.type === 'separator') items.pop()
  return items
}

/**
 * Right-clicking a tab strip entry. Kept in the same vocabulary as the page
 * menu so the one renderer can draw both.
 *
 * @param {{ asleep?: boolean, active?: boolean, neverSleep?: boolean, url?: string }} tab
 * @param {{ domain?: string, domainNeverSleeps?: boolean, canSleep?: boolean }} [context]
 */
function buildTabContextMenu(tab = {}, context = {}) {
  const items = []
  const domain = context.domain || ''

  items.push(command('tab-reload', 'Reload', !tab.asleep, 'Ctrl+R'))
  items.push(command('tab-duplicate', 'Duplicate'))
  separator(items)

  items.push(command('tab-sleep', 'Sleep tab now', context.canSleep !== false))
  items.push(tab.neverSleep
    ? command('tab-allow-sleep', 'Allow this tab to sleep')
    : command('tab-never-sleep', 'Never sleep this tab'))
  if (domain) {
    items.push(context.domainNeverSleeps
      ? command('tab-allow-domain', `Allow ${domain} to sleep`)
      : command('tab-never-sleep-domain', `Never sleep ${domain}`))
  }
  separator(items)

  items.push(command('tab-close-others', 'Close other tabs', !!context.hasOtherTabs))
  items.push(command('tab-close', 'Close tab', true, 'Ctrl+W'))

  while (items.at(-1)?.type === 'separator') items.pop()
  return items
}

module.exports = { buildContextMenu, buildTabContextMenu }
