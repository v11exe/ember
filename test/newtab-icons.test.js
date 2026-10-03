const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../chromium/resources/newtab/ember-newtab.ts'), 'utf8');
const start = source.indexOf('export function emberUrl');
const end = source.indexOf("// Ember's New Tab remains", start);
assert.ok(start > 0 && end > start);
const actualHelpers = source.slice(start, end).replace(/export /g, '');
const context = vm.createContext({});
vm.runInContext(actualHelpers, context);
const icon = input => context.emberSuggestionIcon(input);

test('site match unwraps Mojo destination and uses cached favicon before generic icon', () => {
  const value = icon({destinationUrl: {url: 'https://example.test/path?q=snow%20%26%20ice'},
    iconUrl: {url: ''}, iconPath: 'chrome://resources/images/icon_globe.svg', isSearchType: false});
  assert.equal(value.src, 'chrome://favicon2/?size=16&pageUrl=' +
    encodeURIComponent('https://example.test/path?q=snow%20%26%20ice'));
  assert.equal(value.utility, false);
  assert.equal(value.fallback, 'chrome://resources/images/icon_globe.svg');
});

test('real supplied icon retains colors, including data favicon', () => {
  for (const supplied of ['https://example.test/favicon.ico', 'data:image/png;base64,AAAA']) {
    const value = icon({iconUrl: {url: supplied}, isSearchType: true, iconPath: 'generic.svg'});
    assert.equal(value.src, supplied);
    assert.equal(value.utility, false);
  }
});

test('search/provider icons and internal-page fallbacks stay correct', () => {
  const provider = icon({iconUrl: {url: ''}, isSearchType: true, iconPath: 'search.svg',
    destinationUrl: {url: 'https://google.com/search?q=a%26b'}});
  assert.equal(provider.src, 'search.svg');
  assert.equal(provider.utility, true);
  assert.equal(icon({isSearchType: false, destinationUrl: {url: 'chrome://settings'},
    iconPath: 'settings.svg'}).src, 'settings.svg');
});

test('Mojo display text unwraps UTF-16 without changing literal queries or URLs', () => {
  assert.equal(context.emberText({data: [0x73, 0x6e, 0x6f, 0x77, 0x20, 0x26, 0x20, 0xd83d, 0xde80]}), 'snow & \u{1f680}');
  assert.equal(context.emberText('https://example.test/a?x=1&y=2'), 'https://example.test/a?x=1&y=2');
  assert.equal(context.emberUrl({url: 'https://example.test/'}), 'https://example.test/');
  assert.equal(context.emberText(null), '');
});

test('one-result traversal wraps forwards and backwards without auxiliary stops', () => {
  assert.equal(context.emberNextSuggestion(0, 4), 1);
  assert.equal(context.emberNextSuggestion(3, 4), 0);
  assert.equal(context.emberNextSuggestion(0, 4, true), 3);
  assert.equal(context.emberNextSuggestion(2, 4, true), 1);
  assert.equal(context.emberNextSuggestion(0, 1, true), 0);
  assert.equal(context.emberNextSuggestion(0, 0), -1);
});
