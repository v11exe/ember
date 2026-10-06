// Copyright 2026 The Ember Authors. BSD-style license in Chromium's LICENSE.
// Runs only in Chromium's internal isolated world, never the page's JS world.
(() => {
  if (globalThis.__emberPageState) return;
  const MAX_TEXT = 65536, MAX_NODES = 20000, MAX_ELEMENTS = 3000;
  const excluded = 'script,style,noscript,template,input,textarea,select,option,' +
      '[contenteditable]:not([contenteditable="false"]),[role="textbox"],' +
      '[hidden],[aria-hidden="true"],iframe,object,embed';
  const normalize = value => String(value).replace(/\s+/gu, ' ').trim();
  const readable = element => {
    if (!element || element.closest(excluded)) return false;
    const style = getComputedStyle(element);
    return style.visibility !== 'hidden' && style.display !== 'none' &&
        style.opacity !== '0' && element.getClientRects().length > 0;
  };
  const nodes = root => {
    const result = [], walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const started = performance.now();
    let node, count = 0, length = 0;
    while ((node = walker.nextNode()) && count++ < MAX_NODES) {
      if (count % 128 === 0 && performance.now() - started > 16) break;
      if (!readable(node.parentElement)) continue;
      const text = normalize(node.textContent.slice(0, MAX_TEXT - length));
      if (!text) continue;
      result.push({node, text});
      length += text.length + 1;
      if (length >= MAX_TEXT) break;
    }
    return result;
  };
  let dirty = true, cached = '', cachedURL = location.href;
  const observer = new MutationObserver(() => { dirty = true; });
  if (document.documentElement) observer.observe(document.documentElement,
      {subtree: true, childList: true, characterData: true, attributes: true,
        attributeFilter: ['hidden', 'aria-hidden', 'style', 'class']});
  const index = () => {
    if (cachedURL !== location.href) { dirty = true; cachedURL = location.href; }
    if (dirty) {
      cached = nodes(document.body || document.documentElement)
          .map(value => value.text).join(' ').slice(0, MAX_TEXT);
      dirty = false;
    }
    return {url: location.href, text: cached};
  };
  const path = element => {
    if (element === document.scrollingElement) return [];
    const result = [];
    while (element && element !== document.documentElement && result.length < 32) {
      const parent = element.parentElement;
      if (!parent) return [];
      result.unshift(Array.prototype.indexOf.call(parent.children, element));
      element = parent;
    }
    return element === document.documentElement ? result : [];
  };
  const resolve = indices => {
    if (!Array.isArray(indices) || indices.length > 32) return document.scrollingElement;
    if (!indices.length) return document.scrollingElement;
    let element = document.documentElement;
    for (const index of indices) {
      if (!Number.isInteger(index) || index < 0) return document.scrollingElement;
      element = element?.children[index];
    }
    return element && element.scrollHeight > element.clientHeight
        ? element : document.scrollingElement;
  };
  const mainScroller = () => {
    let best = document.scrollingElement, area = 0, count = 0;
    // Visible, substantial nested reading areas; never retain draft values.
    const walker = document.createTreeWalker(document.body || document.documentElement,
        NodeFilter.SHOW_ELEMENT);
    let element;
    while ((element = walker.nextNode()) && count++ < MAX_ELEMENTS) {
      if (element.scrollTop < 32 || element.scrollHeight <= element.clientHeight + 32 ||
          !readable(element)) continue;
      const box = element.getBoundingClientRect();
      const visibleArea = Math.max(0, Math.min(box.right, innerWidth) - Math.max(0, box.left)) *
          Math.max(0, Math.min(box.bottom, innerHeight) - Math.max(0, box.top));
      if (visibleArea > area && visibleArea >= innerWidth * innerHeight * 0.2) {
        best = element; area = visibleArea;
      }
    }
    return best;
  };
  let restoreGeneration = 0;
  const snapshot = () => {
    const scroller = mainScroller();
    if (!scroller) return null;
    const box = scroller === document.scrollingElement
        ? {left: 0, top: 0, width: innerWidth, height: innerHeight}
        : scroller.getBoundingClientRect();
    const at = document.elementFromPoint(
        Math.min(innerWidth - 1, Math.max(0, box.left + box.width * .5)),
        Math.min(innerHeight - 1, Math.max(0, box.top + 24)));
    const anchor = at && readable(at) ? nodes(at).map(value => value.text).join(' ').slice(0, 120) : '';
    return {url: location.href, x: scroller.scrollLeft, y: scroller.scrollTop,
      path: path(scroller), anchor, offset: at ? at.getBoundingClientRect().top - box.top : 0};
  };
  const restore = saved => {
    if (!saved || saved.url !== location.href || !Number.isFinite(saved.y) || saved.y < 32)
      return false;
    const generation = ++restoreGeneration, started = performance.now();
    const initial = resolve(saved.path), initialY = initial?.scrollTop;
    let cancelled = false;
    const cancel = event => { if (event.isTrusted) cancelled = true; };
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    events.forEach(event => addEventListener(event, cancel, {capture: true, passive: true}));
    const finish = () => events.forEach(event => removeEventListener(event, cancel, true));
    const step = () => {
      if (cancelled || generation !== restoreGeneration || saved.url !== location.href) {
        finish(); return;
      }
      const scroller = resolve(saved.path);
      if (!scroller) { finish(); return; }
      // Do not overwrite user or application scrolling while waiting for height.
      if (scroller === initial && scroller.scrollTop !== initialY) { finish(); return; }
      let y = saved.y;
      if (saved.anchor) {
        const match = nodes(scroller).find(value => value.text.includes(saved.anchor));
        if (match) {
          const top = scroller === document.scrollingElement ? 0 : scroller.getBoundingClientRect().top;
          y = scroller.scrollTop + match.node.parentElement.getBoundingClientRect().top - top - saved.offset;
        }
      }
      const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      if (max >= y || performance.now() - started >= 2000) {
        scroller.scrollTo({left: Math.max(0, Math.min(saved.x || 0,
          scroller.scrollWidth - scroller.clientWidth)), top: Math.max(0, Math.min(y, max)), behavior: 'instant'});
        finish(); return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    return true;
  };
  let highlightGeneration = 0;
  const find = query => {
    const q = normalize(query).toLowerCase();
    if (q.length < 2 || q.length > 128) return false;
    const values = nodes(document.body || document.documentElement);
    // Native-like temporary highlighting without changing any Ctrl+F session.
    for (const {node} of values) {
      const text = node.textContent.slice(0, MAX_TEXT);
      const at = text.toLowerCase().indexOf(q);
      if (at < 0) continue;
      // Case conversion can expand a character (e.g. İ -> i + combining dot).
      // Map the folded match back to original UTF-16 boundaries for Range.
      let raw = 0, folded = 0, start = -1, end = 0;
      for (const symbol of text) {
        const next = folded + symbol.toLowerCase().length;
        if (start < 0 && next > at) start = raw;
        raw += symbol.length;
        if (next >= at + q.length) { end = raw; break; }
        folded = next;
      }
      if (start < 0 || !end) continue;
      const range = document.createRange();
      range.setStart(node, start); range.setEnd(node, end);
      node.parentElement.scrollIntoView({block: 'center', inline: 'nearest', behavior: 'instant'});
      if (globalThis.CSS?.highlights && globalThis.Highlight) {
        let style = document.getElementById('__ember_content_match_style');
        if (!style) {
          style = document.createElement('style'); style.id = '__ember_content_match_style';
          style.textContent = '::highlight(ember-content-match){background:#ffca28;color:#111}';
          document.documentElement.append(style);
        }
        CSS.highlights.set('ember-content-match', new Highlight(range));
        const generation = ++highlightGeneration;
        setTimeout(() => {
          if (generation === highlightGeneration) {
            CSS.highlights.delete('ember-content-match'); style.remove();
          }
        }, 5000);
      }
      return true;
    }
    // A normalized query spanning inline text nodes still scrolls its passage.
    const joined = values.map(value => value.text).join(' '), at = joined.toLowerCase().indexOf(q);
    if (at < 0) return false;
    let offset = 0;
    for (const value of values) {
      if (offset + value.text.length >= at) {
        value.node.parentElement.scrollIntoView({block: 'center', behavior: 'instant'}); return true;
      }
      offset += value.text.length + 1;
    }
    return false;
  };
  globalThis.__emberPageState = {index, snapshot, restore, find,
    cancel: () => { ++restoreGeneration; }};
})();
