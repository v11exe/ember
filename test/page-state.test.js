'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../chromium/resources/page-state/ember-page-state.js'), 'utf8');

function fixture() {
  let now = 0, mutation;
  const frames = [], listeners = new Map(), styles = new Map(), timers = [];
  class Element {
    constructor(parent, excluded = false) {
      this.parentElement = parent; this.children = []; this.excluded = excluded;
      this.scrollTop = this.scrollLeft = 0; this.scrollHeight = 2000;
      this.scrollWidth = this.clientWidth = 800; this.clientHeight = 600;
      this.visible = true; this.top = 0;
      parent?.children.push(this);
    }
    closest() { return this.excluded ? this : this.parentElement?.closest() || null; }
    contains(node) { return node === this || !!node.parentElement && this.contains(node.parentElement); }
    getClientRects() { return this.visible ? [{}] : []; }
    getBoundingClientRect() { return {left: 0, top: this.top, right: 800, bottom: this.top + 600, width: 800, height: 600}; }
    scrollTo(value) { this.lastScroll = value; this.scrollTop = value.top; this.scrollLeft = value.left; }
    scrollIntoView(value) { this.scrolledIntoView = value; }
    append(node) { styles.set(node.id, node); }
  }
  const html = new Element(null), body = new Element(html), textNodes = [], elements = [body];
  const document = {documentElement: html, body, scrollingElement: html,
    elementFromPoint: () => null,
    createTreeWalker(root, filter) {
      const list = (filter === 4 ? textNodes : elements).filter(node => root.contains(node));
      let at = 0; return {nextNode: () => list[at++] || null};
    },
    createRange: () => ({setStart(node, offset) { this.start = offset; }, setEnd(node, offset) { this.end = offset; }}),
    getElementById: id => styles.get(id),
    createElement: () => ({remove() { styles.delete(this.id); }})};
  const highlights = new Map(), location = {href: 'https://example.test/article'};
  const context = vm.createContext({document, location, innerWidth: 800, innerHeight: 600,
    NodeFilter: {SHOW_TEXT: 4, SHOW_ELEMENT: 1}, performance: {now: () => now},
    MutationObserver: class {constructor(fn) { mutation = fn; } observe() {}},
    getComputedStyle: element => ({visibility: element.visible ? 'visible' : 'hidden', display: 'block', opacity: '1'}),
    requestAnimationFrame: fn => frames.push(fn),
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    setTimeout: fn => timers.push(fn), CSS: {highlights}, Highlight: class {constructor(range) {this.range = range;}}});
  vm.runInContext(source, context);
  const api = context.__emberPageState;
  return {api, html, body, location, highlights, styles, timers, context,
    element(parent = body, excluded = false) { const node = new Element(parent, excluded); elements.push(node); return node; },
    text(value, parent = body) { const node = {parentElement: parent, textContent: value}; textNodes.push(node); return node; },
    mutate: () => mutation(),
    frame(ms = 16) { now += ms; const batch = frames.splice(0); batch.forEach(fn => fn(now)); },
    input(name, trusted = true) { for (const fn of listeners.get(name) || []) fn({isTrusted: trusted}); },
    listenerCount: () => [...listeners.values()].reduce((n, set) => n + set.size, 0)};
}

test('readable index excludes drafts, passwords and hidden ancestors before reading text', () => {
  const f = fixture(); f.text('Readable article');
  for (const parent of [f.element(f.body, true), f.element(f.body, true)]) {
    const node = f.text('', parent);
    Object.defineProperty(node, 'textContent', {get() { throw Error('Draft was read'); }});
  }
  const hidden = f.element(); hidden.visible = false; f.text('Hidden', hidden);
  assert.equal(f.api.index().text, 'Readable article');
});
test('text snapshots are bounded, normalized and invalidated on mutations and SPA URLs', () => {
  const f = fixture(); const node = f.text('  Hello\n  world  ');
  assert.equal(f.api.index().text, 'Hello world'); node.textContent = 'New text';
  assert.equal(f.api.index().text, 'Hello world'); f.mutate();
  assert.equal(f.api.index().text, 'New text'); node.textContent = 'z'.repeat(70000);
  f.location.href += '?route=two';
  assert.equal(f.api.index().text.length, 65536);
  assert.equal(f.api.index().url, f.location.href);
});
test('isolated helper reinjection retains its single observer and state', () => {
  const f = fixture(); vm.runInContext(source, f.context);
  assert.equal(f.context.__emberPageState, f.api);
});
test('snapshot uses the substantial nested reading container without editable text', () => {
  const f = fixture(); f.html.scrollTop = 10;
  const pane = f.element(); pane.scrollTop = 420;
  const editable = f.element(f.body, true); editable.scrollTop = 600;
  const saved = f.api.snapshot();
  assert.equal(saved.y, 420); assert.equal(saved.path.length, 2);
  assert.equal(saved.anchor, ''); assert.equal(saved.url, f.location.href);
});
test('top-of-page and different-route reading actions leave scrolling alone', () => {
  const f = fixture();
  assert.equal(f.api.restore({url: f.location.href, y: 0}), false);
  assert.equal(f.api.restore({url: 'https://example.test/other', y: 500}), false);
  f.frame(); assert.equal(f.html.lastScroll, undefined);
});
test('Return waits for delayed content and restores only after sufficient height', () => {
  const f = fixture(); f.html.scrollHeight = 700;
  assert.equal(f.api.restore({url: f.location.href, y: 900, x: 0, path: []}), true);
  f.frame(); assert.equal(f.html.lastScroll, undefined);
  f.html.scrollHeight = 2000; f.frame();
  assert.equal(f.html.scrollTop, 900); assert.equal(f.listenerCount(), 0);
});
test('bounded delayed restore clamps at two seconds and removes listeners', () => {
  const f = fixture(); f.html.scrollHeight = 700;
  f.api.restore({url: f.location.href, y: 900, x: 999, path: []}); f.frame(2001);
  assert.equal(f.html.scrollTop, 100); assert.equal(f.html.scrollLeft, 0);
  assert.equal(f.listenerCount(), 0);
});
test('trusted user input cancels a pending restore without fighting scrolling', () => {
  const f = fixture(); f.html.scrollHeight = 700;
  f.api.restore({url: f.location.href, y: 900, path: []}); f.frame();
  f.input('wheel'); f.html.scrollHeight = 3000; f.frame();
  assert.equal(f.html.lastScroll, undefined); assert.equal(f.listenerCount(), 0);
});
test('application scrolling and route changes also cancel delayed restore', () => {
  const f = fixture(); f.html.scrollHeight = 700;
  f.api.restore({url: f.location.href, y: 900, path: []}); f.html.scrollTop = 60; f.frame();
  assert.equal(f.html.lastScroll, undefined);
  f.api.restore({url: f.location.href, y: 900, path: []}); f.location.href += '#new'; f.frame();
  assert.equal(f.html.lastScroll, undefined); assert.equal(f.listenerCount(), 0);
});
test('a newer Return cancels the older generation and restores nested scrollers', () => {
  const f = fixture(); const pane = f.element(); pane.scrollTop = 400;
  const saved = f.api.snapshot(); pane.scrollTop = 0;
  f.api.restore({...saved, y: 500}); f.api.restore({...saved, y: 800}); f.frame();
  assert.equal(pane.scrollTop, 800); assert.equal(f.html.lastScroll, undefined);
  assert.equal(f.listenerCount(), 0);
});
test('Unicode case matching highlights only the selected passage temporarily', () => {
  const f = fixture(); const paragraph = f.element(); f.text('Café ŻÓŁĆ: readable text', paragraph);
  assert.equal(f.api.find('żółć'), true); assert.ok(paragraph.scrolledIntoView);
  assert.equal(f.highlights.size, 1); f.timers.shift()();
  assert.equal(f.highlights.size, 0); assert.equal(f.styles.size, 0);
});
test('inline-node passage matching scrolls without inventing an inaccurate range', () => {
  const f = fixture(); const paragraph = f.element(); f.text('A useful', paragraph); f.text('passage here', paragraph);
  assert.equal(f.api.find('useful passage'), true); assert.ok(paragraph.scrolledIntoView);
  assert.equal(f.highlights.size, 0); assert.equal(f.api.find('missing text'), false);
});
test('Unicode case expansions map back to valid original UTF-16 highlight bounds', () => {
  const f = fixture(); f.text('İx');
  assert.equal(f.api.find('İx'), true);
  const range = f.highlights.get('ember-content-match').range;
  assert.equal(range.start, 0); assert.equal(range.end, 2);
});
test('expired highlight callbacks cannot erase a newer selected match', () => {
  const f = fixture(); f.text('First passage and second passage');
  f.api.find('first'); f.api.find('second'); f.timers.shift()();
  assert.equal(f.highlights.size, 1); f.timers.shift()(); assert.equal(f.highlights.size, 0);
});
