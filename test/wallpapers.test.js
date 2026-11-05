'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const port = require('../chromium/tools/port');

const source = fs.readFileSync(path.join(port.RESOURCES_ROOT, 'newtab/ember-newtab.ts'), 'utf8');
const controller = source.slice(source.indexOf('const emberWallpapers ='), source.indexOf('\nfunction bindSearch()'));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}

function harness(config = {}, photo, decode = () => Promise.resolve()) {
  const classes = new Set();
  const properties = new Map();
  const background = {style: {backgroundImage: ''}};
  const credit = {hidden: true, textContent: '', removeAttribute(name) { delete this[name]; }};
  const calls = [];
  const listeners = {};
  const state = {config: {wallpaper: 'ember-glow', translucent: false, enabled: false, ...config}};
  const context = vm.createContext({
    URL,
    Image: class { decode() { return decode(); } },
    document: {
      getElementById: id => id === 'ember-wallpaper-background' ? background : credit,
      body: {
        classList: {toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); }},
        style: {
          setProperty(name, value) { properties.set(name, value); },
          removeProperty(name) { properties.delete(name); },
        },
      },
    },
    sendWithPromise(name) {
      calls.push(name);
      return Promise.resolve(name === 'emberWallpaperConfig' ? state.config : photo());
    },
    addWebUiListener(name, callback) { listeners[name] = callback; },
  });
  vm.runInContext(controller.replace('void updateWallpaperBackground();', 'globalThis.ready = updateWallpaperBackground();'), context);
  return {state, context, classes, properties, background, credit, calls,
    ready: context.ready, update: () => listeners['ember-wallpaper-changed']()};
}

const validPhoto = {status: 200, imageDataUrl: 'data:image/png;base64,dGVzdA==',
  profileUrl: 'https://unsplash.com/@photographer', photographer: 'Photographer'};

test('approved wallpaper artwork is packaged losslessly with enough native detail', () => {
  const expected = {
    'smoked-glass': 'f80c05afea2ef1dec955ee56a9ed20b8c2f69d3dd02920c65b76c3c159698cd5',
    'ember-glow': 'f036744a456fea7267b228482371a59d8a895e43d4c83580223db98f2e437f4a',
    'frosted-landscape': 'f7dea27da40446b90fb670924ecb367d8382b1f9d73856e86e58b9fbd836b12b',
  };
  const manifest = port.readResourceManifest();
  for (const [name, hash] of Object.entries(expected)) {
    const relative = `newtab/wallpapers/${name}.png`;
    const file = fs.readFileSync(path.join(port.RESOURCES_ROOT, relative));
    assert.equal(file.subarray(1, 4).toString(), 'PNG');
    assert.ok(file.readUInt32BE(16) >= 1600);
    assert.ok(file.readUInt32BE(20) >= 900);
    assert.equal(crypto.createHash('sha256').update(file).digest('hex'), hash);
    assert.ok(manifest.files.some(item => item.source === relative &&
      item.destination === `chrome/browser/resources/new_tab_page_third_party/ember-wallpaper-${name}.png`));
  }
});

test('each bundled wallpaper uses the shared lens without a photo network request', async () => {
  for (const wallpaper of ['smoked-glass', 'ember-glow', 'frosted-landscape']) {
    const h = harness({wallpaper});
    await h.ready;
    assert.equal(h.background.style.backgroundImage, `url("ember-wallpaper-${wallpaper}.png")`);
    assert.equal(h.properties.get('--wallpaper-image'), h.background.style.backgroundImage);
    assert.ok(h.classes.has('wallpaper-mode'));
    assert.equal(h.credit.hidden, true);
    assert.deepEqual(h.calls, ['emberWallpaperConfig']);
  }
});

test('unknown or URL-like wallpaper preferences use the local Ember Glow fallback', async () => {
  for (const wallpaper of ['removed', 'https://example.com/image.png', '__proto__', '");url(https://example.com)']) {
    const h = harness({wallpaper});
    await h.ready;
    assert.equal(h.background.style.backgroundImage, 'url("ember-wallpaper-ember-glow.png")');
    assert.deepEqual(h.calls, ['emberWallpaperConfig']);
  }
});

test('translucency overrides Unsplash and retains choices when switched back', async () => {
  const h = harness({translucent: true, enabled: true, hasAccessKey: true, wallpaper: 'smoked-glass'}, () => validPhoto);
  await h.ready;
  assert.equal(h.background.style.backgroundImage, '');
  assert.equal(h.properties.has('--wallpaper-image'), false);
  assert.ok(h.classes.has('translucent-mode'));
  assert.equal(h.credit.hidden, true);
  assert.deepEqual(h.calls, ['emberWallpaperConfig']);
  h.state.config = {...h.state.config, translucent: false, enabled: false};
  await h.update();
  assert.equal(h.background.style.backgroundImage, 'url("ember-wallpaper-smoked-glass.png")');
  assert.equal(h.classes.has('translucent-mode'), false);
});

test('missing Unsplash credentials and failed downloads leave a useful local wallpaper', async () => {
  const missing = harness({enabled: true, hasAccessKey: false});
  await missing.ready;
  assert.deepEqual(missing.calls, ['emberWallpaperConfig']);
  assert.match(missing.credit.textContent, /Access Key/);
  for (const status of [0, 401, 429, 500]) {
    const h = harness({enabled: true, hasAccessKey: true}, () => ({status}));
    await h.ready;
    assert.equal(h.background.style.backgroundImage, 'url("ember-wallpaper-ember-glow.png")');
    assert.equal(h.credit.hidden, false);
    assert.equal(h.credit.href, undefined);
  }
});

test('successful Unsplash decode uses the shared image lens and photographer credit', async () => {
  const h = harness({enabled: true, hasAccessKey: true}, () => validPhoto);
  await h.ready;
  assert.equal(h.background.style.backgroundImage, `url("${validPhoto.imageDataUrl}")`);
  assert.equal(h.properties.get('--wallpaper-image'), h.background.style.backgroundImage);
  assert.match(h.credit.href, /^https:\/\/unsplash.com\/@photographer\?/);
  assert.match(h.credit.textContent, /Photographer/);
  assert.equal(h.credit.hidden, false);
});

test('a stale configuration response cannot replace a newer wallpaper choice', async () => {
  const pending = deferred();
  const h = harness();
  await h.ready;
  h.state.config = pending.promise;
  const old = h.update();
  h.state.config = {wallpaper: 'smoked-glass', translucent: false, enabled: false};
  await h.update();
  pending.resolve({wallpaper: 'frosted-landscape', translucent: true});
  await old;
  assert.equal(h.background.style.backgroundImage, 'url("ember-wallpaper-smoked-glass.png")');
  assert.ok(h.classes.has('wallpaper-mode'));
});

test('pending Unsplash responses cannot paint over a new local or translucent choice', async () => {
  for (const translucent of [false, true]) {
    const pending = deferred();
    const h = harness({enabled: true, hasAccessKey: true}, () => pending.promise);
    await Promise.resolve();
    h.state.config = {wallpaper: 'frosted-landscape', enabled: false, translucent};
    await h.update();
    pending.resolve(validPhoto);
    await h.ready;
    assert.equal(h.background.style.backgroundImage,
      translucent ? '' : 'url("ember-wallpaper-frosted-landscape.png")');
    assert.equal(h.credit.hidden, true);
  }
});

test('pending image decoding cannot restore a photo after translucency is enabled', async () => {
  const decoding = deferred();
  const h = harness({enabled: true, hasAccessKey: true}, () => validPhoto, () => decoding.promise);
  await Promise.resolve();
  await Promise.resolve();
  h.state.config = {...h.state.config, translucent: true};
  await h.update();
  decoding.resolve();
  await h.ready;
  assert.equal(h.background.style.backgroundImage, '');
  assert.equal(h.properties.has('--wallpaper-image'), false);
  assert.equal(h.credit.hidden, true);
});
