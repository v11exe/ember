// Single source of truth for IPC channel names.
// Rule (AGENTS.md §3): no channel-name string literals anywhere else.

const IPC = {
  // renderer -> main
  TAB_CREATE: 'tab:create',
  TAB_CLOSE: 'tab:close',
  TAB_SELECT: 'tab:select',
  NAV_GO: 'nav:go',
  NAV_BACK: 'nav:back',
  NAV_FORWARD: 'nav:forward',
  NAV_RELOAD: 'nav:reload',
  NAV_STOP: 'nav:stop',
  WIN_MINIMIZE: 'win:minimize',
  WIN_MAXIMIZE: 'win:maximize',
  WIN_CLOSE: 'win:close',
  EXT_OPEN_STORE: 'ext:open-store',
  EXT_LIST: 'ext:list',
  EXT_REMOVE: 'ext:remove',
  PANEL_TOGGLE: 'panel:toggle',
  PANEL_CLOSE: 'panel:close',
  PANEL_RESIZE: 'panel:resize',
  PANEL_ANCHOR: 'panel:anchor',
  BOOKMARKS_GET: 'bookmarks:get',
  BOOKMARKS_IMPORT: 'bookmarks:import',
  BOOKMARKS_VISIBILITY: 'bookmarks:visibility',
  HISTORY_QUERY: 'history:query',
  HISTORY_DELETE: 'history:delete',
  HISTORY_CLEAR: 'history:clear',
  HISTORY_OPEN: 'history:open',
  DOWNLOADS_QUERY: 'downloads:query',
  DOWNLOADS_ACTION: 'downloads:action',
  UPLOAD_REQUEST: 'upload:request',
  OVERLAY_ACTION: 'overlay:action',
  OVERLAY_CLOSE: 'overlay:close',

  // main -> renderer
  STATE: 'browser:state',
  PANEL_CHANGED: 'panel:changed',
  PANEL_ORIGIN: 'panel:origin', // panel view offset, for popup anchoring
  BOOKMARKS_CHANGED: 'bookmarks:changed',
  UPLOAD_RESULT: 'upload:result',
  OVERLAY_STATE: 'overlay:state',
  DOWNLOADS_CHANGED: 'downloads:changed',
}

// Where the omnibox sends anything that isn't a URL.
const SEARCH_URL = 'https://www.google.com/search?q='
const NEW_TAB_URL = 'ember://newtab'
const HISTORY_URL = 'ember://history'
const DOWNLOADS_URL = 'ember://downloads'
const WEB_STORE_URL = 'https://chromewebstore.google.com/'

module.exports = { IPC, SEARCH_URL, NEW_TAB_URL, HISTORY_URL, DOWNLOADS_URL, WEB_STORE_URL }
