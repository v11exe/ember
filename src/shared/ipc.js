// Single source of truth for IPC channel names.
// Rule (AGENTS.md §3): no channel-name string literals anywhere else.

const IPC = {
  // renderer -> main
  TAB_CREATE: 'tab:create',
  TAB_CLOSE: 'tab:close',
  TAB_SELECT: 'tab:select',
  TAB_REORDER: 'tab:reorder',
  TAB_CONTEXT_MENU: 'tab:context-menu',  // right-click on a tab strip entry
  NAV_GO: 'nav:go',
  NAV_BACK: 'nav:back',
  NAV_FORWARD: 'nav:forward',
  NAV_RELOAD: 'nav:reload',
  NAV_STOP: 'nav:stop',
  WIN_MINIMIZE: 'win:minimize',
  WIN_MAXIMIZE: 'win:maximize',
  WIN_CLOSE: 'win:close',
  WIN_DRAG_START: 'win:drag-start',
  WIN_DRAG_MOVE: 'win:drag-move',
  WIN_DRAG_END: 'win:drag-end',
  CORNER_MASK_INPUT: 'corner-mask:input',
  EXT_OPEN_STORE: 'ext:open-store',
  EXT_LIST: 'ext:list',
  EXT_REMOVE: 'ext:remove',
  PANEL_TOGGLE: 'panel:toggle',
  PANEL_CLOSE: 'panel:close',
  PANEL_RESIZE: 'panel:resize',
  PANEL_ANCHOR: 'panel:anchor',
  BANGS_GET: 'bangs:get',                 // the resolved quick-search table
  OMNIBOX_RESOLVE: 'omnibox:resolve',     // what would Enter do with this text?
  BOOKMARKS_GET: 'bookmarks:get',
  BOOKMARKS_IMPORT: 'bookmarks:import',
  BOOKMARKS_VISIBILITY: 'bookmarks:visibility',
  CHROME_CONFIG_GET: 'chrome-config:get',
  SIDEBAR_SET: 'sidebar:set',
  FAVORITE_OPEN: 'favorite:open',
  FAVORITE_PIN_TAB: 'favorite:pin-tab',
  FAVORITE_CONTEXT_MENU: 'favorite:context-menu',
  FAVORITE_REMOVE: 'favorite:remove',
  HISTORY_QUERY: 'history:query',
  HISTORY_DELETE: 'history:delete',
  HISTORY_CLEAR: 'history:clear',
  HISTORY_OPEN: 'history:open',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  DOWNLOADS_QUERY: 'downloads:query',
  DOWNLOADS_ACTION: 'downloads:action',
  NATIVE_GLASS_SETTINGS: 'native-glass:settings',
  UPLOAD_REQUEST: 'upload:request',
  SELECTION_CHANGED: 'selection:changed', // page reports its selected text
  ARCHIVE_OPEN: 'archive:open',           // look the page up on archive.org and go
  OVERLAY_ACTION: 'overlay:action',
  OVERLAY_CLOSE: 'overlay:close',

  // main -> renderer
  STATE: 'browser:state',
  PANEL_CHANGED: 'panel:changed',
  PANEL_ORIGIN: 'panel:origin', // panel view offset, for popup anchoring
  BANGS_CHANGED: 'bangs:changed',
  BOOKMARKS_CHANGED: 'bookmarks:changed',
  CHROME_CONFIG_CHANGED: 'chrome-config:changed',
  WIN_STATE: 'win:state',
  UPLOAD_RESULT: 'upload:result',
  OVERLAY_STATE: 'overlay:state',
  DOWNLOADS_CHANGED: 'downloads:changed',
}

// Where the omnibox sends anything that isn't a URL.
const SEARCH_URL = 'https://www.google.com/search?q='
const NEW_TAB_URL = 'ember://newtab'
const HISTORY_URL = 'ember://history'
const DOWNLOADS_URL = 'ember://downloads'
const SETTINGS_URL = 'ember://settings'
const UNREACHABLE_URL = 'ember://unreachable'
const EXTENSIONS_URL = 'ember://extensions'
const WEB_STORE_URL = 'https://chromewebstore.google.com/'

module.exports = {
  IPC, SEARCH_URL, NEW_TAB_URL, HISTORY_URL, DOWNLOADS_URL, SETTINGS_URL,
  UNREACHABLE_URL, EXTENSIONS_URL, WEB_STORE_URL,
}
