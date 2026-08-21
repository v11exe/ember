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

  // main -> renderer
  STATE: 'browser:state',
}

// Where the omnibox sends anything that isn't a URL.
const SEARCH_URL = 'https://www.google.com/search?q='
const NEW_TAB_URL = 'ember://newtab'
const WEB_STORE_URL = 'https://chromewebstore.google.com/'

module.exports = { IPC, SEARCH_URL, NEW_TAB_URL, WEB_STORE_URL }
