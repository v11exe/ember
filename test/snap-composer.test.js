const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {createHash, webcrypto} = require('node:crypto');
const imageBytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4]);
const digest = createHash('sha256').update(imageBytes).digest('hex');
const settleHash = () => new Promise(resolve => setTimeout(resolve, 10));
const source = fs.readFileSync(path.join(__dirname, '../chromium/resources/snap/ember-snap-composer.js'), 'utf8');

function fixture() {
  const listeners = new Set();
  const state = {markers: [], errors: [], globalErrors: [], progress: [], draft: 'Keep my draft', submissions: 0};
  const visible = extra => ({isConnected: true, getClientRects: () => [{}],
    getBoundingClientRect: () => ({width: 120, height: 24}),
    getAttribute: () => null, ...extra});
  state.send = [visible({disabled: false, getAttribute: () => null,
    click: () => ++state.submissions})];
  state.account = [visible({})]; state.login = [];
  const surface = visible({querySelectorAll(selector) {
    if (selector.includes('role="alert"')) return state.errors;
    if (selector.includes('progressbar')) return state.progress;
    if (selector.includes('send-button')) return state.send;
    return state.markers;
  }});
  const document = {activeElement: null, querySelectorAll: selector =>
    selector.includes('profile-button') ? state.account :
    selector.includes('login-button') ? state.login :
    selector.includes('role="alert"') ? state.globalErrors : [composer],
    addEventListener: (name, fn) => listeners.add(fn),
    removeEventListener: (name, fn) => listeners.delete(fn)};
  const composer = visible({tagName: 'DIV', isContentEditable: true,
    querySelectorAll: () => [], disabled: false, getAttribute: () => null,
    closest: () => surface, contains: target => target === composer,
    focus: () => {document.activeElement = composer;}});
  for (const property of ['value', 'innerText', 'textContent']) {
    Object.defineProperty(composer, property, {
      get: () => state.draft, set: value => {state.draft = value;}
    });
  }
  surface.submit = surface.requestSubmit = () => ++state.submissions;
  const location = {origin: 'https://chatgpt.com', pathname: '/c/current'};
  state.session = {};
  state.fetches = 0;
  const context = vm.createContext({document, location, crypto: webcrypto,
    AbortController, URL, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      ++state.fetches;
      state.authOptions = options;
      if (state.sessionPromise) await state.sessionPromise;
      if (state.sessionError) throw new Error('Unavailable');
      return {ok: true, url, json: async () => state.session};
    },
    getComputedStyle: () => ({visibility: 'visible'})});
  const run = (phase, id = '1') => vm.runInContext(source, context)({phase, id, digest});
  const paste = (trusted = true, target = composer, type = 'image/png', bytes = imageBytes) => {
    for (const fn of listeners) fn({isTrusted: trusted, target,
      clipboardData: {files: [{type, size: bytes.length, arrayBuffer: async () => bytes.buffer}]}});
  };
  return {state, composer, surface, document, location, listeners, run, paste, visible};
}

test('prepare and validate retain text and existing attachments without submitting', () => {
  const f = fixture(); f.state.markers.push(f.visible({}));
  assert.equal(f.run('prepare').state, 'prepared');
  assert.equal(f.run('validate').state, 'prepared');
  assert.equal(f.run('check').state, 'waiting');
  assert.equal(f.state.draft, 'Keep my draft');
  assert.equal(f.state.markers.length, 1);
  assert.equal(f.state.submissions, 0);
});
test('dispatch and unrelated attachment alone cannot report success', () => {
  const f = fixture(); f.run('prepare'); f.state.markers.push(f.visible({}));
  assert.equal(f.run('check').state, 'waiting');
  f.paste(false); assert.equal(f.run('check').pasted, false);
  f.paste(true, f.surface); assert.equal(f.run('check').pasted, false);
  f.paste(true, f.composer, 'text/plain'); assert.equal(f.run('check').pasted, false);
});
test('native PNG paste needs a new, finished attachment before success', async () => {
  const f = fixture(); f.run('prepare'); f.paste();
  assert.equal(f.run('check').state, 'waiting');
  await settleHash();
  f.state.markers.push(f.visible({})); f.state.progress.push(f.visible({}));
  assert.equal(f.run('check').state, 'waiting');
  f.state.progress.length = 0;
  f.state.send[0].disabled = true;
  assert.equal(f.run('check').state, 'waiting');
  f.state.send[0].disabled = false;
  assert.equal(f.run('check').state, 'attached');
  assert.equal(f.document.activeElement, f.composer);
  assert.equal(f.listeners.size, 0);
  assert.equal(f.run('check').state, 'changed');
});
test('another trusted PNG cannot confirm the captured image', async () => {
  const f = fixture(); f.run('prepare'); f.paste(true, f.composer, 'image/png', new Uint8Array([1, 2, 3]));
  f.state.markers.push(f.visible({})); f.run('check'); await settleHash();
  assert.equal(f.run('check').pasted, false);
  f.paste(); f.run('check'); await settleHash();
  assert.equal(f.run('check').state, 'attached');
});
test('cancellation prevents a pending image hash confirming a new request', async () => {
  const f = fixture(); f.run('prepare'); f.paste(); f.run('check');
  f.run('cancel'); f.run('prepare', '2');
  f.state.markers.push(f.visible({})); await settleHash();
  assert.equal(f.run('check', '2').pasted, false);
  assert.equal(f.state.draft, 'Keep my draft');
  assert.equal(f.state.submissions, 0);
});
test('login, wrong origin, disabled and missing composers wait safely', () => {
  const f = fixture(); f.location.origin = 'https://example.com';
  assert.equal(f.run('prepare').state, 'login');
  f.location.origin = 'https://chatgpt.com'; f.location.pathname = '/auth/login';
  assert.equal(f.run('prepare').state, 'login');
  f.location.pathname = '/'; f.composer.disabled = true;
  assert.equal(f.run('prepare').state, 'waiting');
  f.composer.disabled = false; f.document.querySelectorAll = () => [];
  assert.equal(f.run('prepare').state, 'waiting');
});
test('a guest composer and visible sign-in controls cannot prepare paste', async () => {
  const f = fixture(); f.state.account.length = 0;
  assert.equal(f.run('prepare').state, 'auth-wait');
  await settleHash();
  assert.equal(f.run('prepare').state, 'login');
  assert.equal(f.listeners.size, 0);
  f.state.account.push(f.visible({})); f.state.login.push(f.visible({}));
  assert.equal(f.run('prepare').state, 'login');
  f.state.login.length = 0;
  assert.equal(f.run('prepare').state, 'prepared');
});
test('retry restores focus but changed conversation, composer and generation cannot paste', () => {
  const f = fixture(); f.run('prepare'); f.document.activeElement = null;
  assert.equal(f.run('validate').state, 'prepared');
  assert.equal(f.document.activeElement, f.composer);
  f.document.activeElement = f.composer;
  assert.equal(f.run('validate', '2').state, 'changed');
  f.location.pathname = '/c/different';
  assert.equal(f.run('check').state, 'changed');
  f.location.pathname = '/c/current';
  const lookup = f.document.querySelectorAll;
  f.document.querySelectorAll = selector => selector.includes('prompt-textarea')
    ? [f.visible({...f.composer})] : lookup(selector);
  assert.equal(f.run('check').state, 'changed');
});
test('cancel and reprepare remove old listeners and retain draft', () => {
  const f = fixture(); f.run('prepare'); f.run('prepare', '2');
  assert.equal(f.listeners.size, 1);
  assert.equal(f.run('cancel').state, 'cancelled');
  assert.equal(f.listeners.size, 0);
  assert.equal(f.run('check', '2').state, 'changed');
  assert.equal(f.state.draft, 'Keep my draft');
});
test('genuine attachment errors fail and hidden markers do not confirm', () => {
  const f = fixture(); f.run('prepare'); f.paste();
  f.state.markers.push(f.visible({getClientRects: () => []}));
  assert.equal(f.run('check').state, 'waiting');
  f.state.errors.push(f.visible({textContent: 'Upload failed'}));
  assert.equal(f.run('check').state, 'rejected');
});


test('responsive authenticated session prepares once without changing the draft', async () => {
  const f = fixture(); f.state.account.length = 0;
  f.state.session = {user: {id: 'test-user'}};
  assert.equal(f.run('prepare').state, 'auth-wait');
  await settleHash();
  assert.equal(f.run('prepare').state, 'prepared');
  assert.equal(f.state.fetches, 1);
  assert.equal(f.state.authOptions.credentials, 'same-origin');
  assert.equal(f.state.authOptions.redirect, 'error');
  assert.equal(f.state.draft, 'Keep my draft');
  assert.equal(f.state.submissions, 0);
});

test('pending session, failed lookup and missing composer never dispatch paste', async () => {
  const f = fixture(); f.state.account.length = 0;
  let release;
  f.state.sessionPromise = new Promise(resolve => { release = resolve; });
  assert.equal(f.run('prepare').state, 'auth-wait');
  assert.equal(f.run('prepare').state, 'auth-wait');
  assert.equal(f.state.fetches, 1);
  assert.equal(f.listeners.size, 0);
  f.state.sessionError = true; release(); await settleHash();
  assert.equal(f.run('prepare').state, 'auth-error');
  assert.equal(f.listeners.size, 0);
  f.state.account.push(f.visible({}));
  const lookup = f.document.querySelectorAll;
  f.document.querySelectorAll = selector => selector.includes('prompt-textarea')
    ? [] : lookup(selector);
  assert.equal(f.run('prepare').state, 'waiting');
});

test('cancellation aborts auth and a late result cannot authenticate a replacement', async () => {
  const f = fixture(); f.state.account.length = 0;
  let release;
  f.state.sessionPromise = new Promise(resolve => { release = resolve; });
  f.state.session = {user: {id: 'old-user'}};
  assert.equal(f.run('prepare').state, 'auth-wait');
  const signal = f.state.authOptions.signal;
  f.run('cancel'); assert.equal(signal.aborted, true);
  release(); await settleHash();
  f.state.session = {};
  assert.equal(f.run('prepare', '2').state, 'auth-wait');
  await settleHash();
  assert.equal(f.run('prepare', '2').state, 'login');
  assert.equal(f.listeners.size, 0);
  assert.equal(f.state.submissions, 0);
});


test('responsive composer wrappers and duplicate selectors normalize to one editor', () => {
  const f = fixture();
  const wrapper = f.visible({tagName: 'DIV', isContentEditable: false,
    querySelectorAll: () => [f.composer]});
  const hiddenTextarea = f.visible({tagName: 'TEXTAREA',
    getBoundingClientRect: () => ({width: 1, height: 1}),
    querySelectorAll: () => []});
  const lookup = f.document.querySelectorAll;
  f.document.querySelectorAll = selector => selector.includes('prompt-textarea')
    ? [wrapper, f.composer, f.composer, hiddenTextarea] : lookup(selector);
  assert.equal(f.run('prepare').state, 'prepared');
  assert.equal(f.document.activeElement, f.composer);
  assert.equal(f.listeners.size, 1);
  assert.equal(f.state.draft, 'Keep my draft');
  assert.equal(f.state.submissions, 0);
});

test('multiple live editors and noneditable legacy containers do not choose a destination', () => {
  const f = fixture();
  const lookup = f.document.querySelectorAll;
  f.document.querySelectorAll = selector => selector.includes('prompt-textarea')
    ? [f.composer, f.visible({...f.composer})] : lookup(selector);
  assert.equal(f.run('prepare').state, 'ambiguous');
  assert.equal(f.listeners.size, 0);
  f.composer.isContentEditable = false;
  f.document.querySelectorAll = selector => selector.includes('prompt-textarea')
    ? [f.composer] : lookup(selector);
  assert.equal(f.run('prepare').state, 'waiting');
  assert.equal(f.listeners.size, 0);
});


test('failed site upload can be rechecked without repasting or changing draft', async () => {
  const f = fixture(); f.run('prepare'); f.paste(); f.run('check');
  await settleHash();
  const marker = f.visible({textContent: 'Upload failed'});
  f.state.markers.push(marker);
  f.state.globalErrors.push(f.visible({textContent: 'Upload failed because of a network issue'}));
  assert.equal(f.run('check').state, 'rejected');
  assert.equal(f.listeners.size, 1);
  marker.textContent = ''; f.state.globalErrors.length = 0;
  f.state.progress.push(f.visible({}));
  assert.equal(f.run('check').state, 'waiting');
  f.state.progress.length = 0;
  assert.equal(f.run('check').state, 'attached');
  assert.equal(f.state.draft, 'Keep my draft');
  assert.equal(f.state.submissions, 0);
  assert.equal(f.listeners.size, 0);
});

test('unrelated global errors cannot confirm or reject an unproven paste', () => {
  const f = fixture(); f.run('prepare');
  f.state.globalErrors.push(f.visible({textContent: 'Upload failed'}));
  f.state.markers.push(f.visible({textContent: 'An existing attachment'}));
  assert.equal(f.run('check').state, 'waiting');
  assert.equal(f.state.submissions, 0);
});

test('editor replacement after proven paste retains attachment evidence', async () => {
  const f = fixture(); f.run('prepare'); f.paste(); f.run('check');
  await settleHash();
  const replacement = f.visible({...f.composer,
    focus: () => {f.document.activeElement = replacement;}});
  const lookup = f.document.querySelectorAll;
  f.document.querySelectorAll = selector => selector.includes('prompt-textarea')
    ? [replacement] : lookup(selector);
  f.state.markers.push(f.visible({}));
  assert.equal(f.run('check').state, 'attached');
  assert.equal(f.document.activeElement, replacement);
  assert.equal(f.state.draft, 'Keep my draft');
  assert.equal(f.state.submissions, 0);
});


test('editor replacement during image hashing waits for capture proof', async () => {
  const f = fixture(); f.run('prepare'); f.paste();
  const replacement = f.visible({...f.composer,
    focus: () => {f.document.activeElement = replacement;}});
  const lookup = f.document.querySelectorAll;
  f.document.querySelectorAll = selector => selector.includes('prompt-textarea')
    ? [replacement] : lookup(selector);
  f.state.markers.push(f.visible({}));
  assert.equal(f.run('check').state, 'waiting');
  await settleHash();
  assert.equal(f.run('check').state, 'attached');
  assert.equal(f.state.submissions, 0);
});


test('recapture in the same chat appends one new image and refocuses the draft', async () => {
  const f = fixture();
  f.run('prepare'); f.paste(); f.run('check'); await settleHash();
  const oldAttachment = f.visible({}); f.state.markers.push(oldAttachment);
  assert.equal(f.run('check').state, 'attached');
  f.run('cancel'); f.document.activeElement = null;
  assert.equal(f.run('prepare', '2').state, 'prepared');
  assert.equal(f.document.activeElement, f.composer);
  assert.equal(f.run('check', '2').state, 'waiting');
  f.paste(); f.run('check', '2'); await settleHash();
  assert.equal(f.run('check', '2').state, 'waiting');
  f.state.markers.push(f.visible({}));
  f.document.activeElement = null;
  assert.equal(f.run('check', '2').state, 'attached');
  assert.equal(f.document.activeElement, f.composer);
  assert.equal(f.location.pathname, '/c/current');
  assert.equal(f.state.markers[0], oldAttachment);
  assert.equal(f.state.markers.length, 2);
  assert.equal(f.state.draft, 'Keep my draft');
  assert.equal(f.state.submissions, 0);
  assert.equal(f.listeners.size, 0);
});
