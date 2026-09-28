/* eslint-disable no-restricted-properties */
// @ts-nocheck — WebUI globals are supplied by Chromium's internal-page runtime.
import {PageCallbackRouter, PageHandlerFactory, PageHandlerRemote} from 'chrome://resources/mojo/components/omnibox/browser/searchbox.mojom-webui.js';
// Ember's browser-owned New Tab handler uses the same promise bridge as Favorites.
// eslint-disable-next-line no-restricted-imports
import {addWebUiListener, sendWithPromise} from 'chrome://resources/js/cr.js';

// Ember's New Tab remains a quiet logo and search surface. Favorites are
// managed in chrome://settings and rendered in the browser's sidebar.
window.EmberBrand.mountBrand(document.getElementById('ember-brand'));

let unsplashRequest = 0;
async function updateUnsplashBackground() {
  const request = ++unsplashRequest;
  const background = document.getElementById('ember-unsplash-background');
  const credit = document.getElementById('ember-unsplash-credit');
  const config = await sendWithPromise('emberUnsplashConfig');
  if (request !== unsplashRequest) return;
  const enabled = !!config.enabled;
  document.body.classList.toggle('unsplash-mode', enabled);
  background.style.backgroundImage = '';
  document.body.style.removeProperty('--unsplash-photo');
  credit.hidden = true;
  if (!enabled) return;
  if (!config.hasAccessKey) {
    credit.textContent = 'Add an Unsplash Access Key in Appearance settings';
    credit.removeAttribute('href');
    credit.hidden = false;
    return;
  }
  let status = 0;
  try {
    const photo = await sendWithPromise('emberUnsplashPhoto');
    status = photo.status;
    if (status !== 200 || !photo.imageDataUrl || !photo.profileUrl ||
        !photo.photographer) {
      throw new Error(`Unsplash HTTP ${status}`);
    }
    if (request !== unsplashRequest) return;
    const profile = new URL(photo.profileUrl);
    if (!/^data:image\/(jpeg|png|webp|avif);base64,/.test(photo.imageDataUrl) ||
        profile.protocol !== 'https:' || profile.hostname !== 'unsplash.com') {
      throw new Error('Unexpected Unsplash photo URL');
    }
    const image = new Image();
    image.src = photo.imageDataUrl;
    await image.decode();
    if (request !== unsplashRequest) return;
    const photoBackground = `url("${photo.imageDataUrl}")`;
    background.style.backgroundImage = photoBackground;
    document.body.style.setProperty('--unsplash-photo', photoBackground);
    profile.searchParams.set('utm_source', 'ember');
    profile.searchParams.set('utm_medium', 'referral');
    credit.href = profile.href;
    credit.textContent = `Photo: ${photo.photographer} · Unsplash`;
    credit.hidden = false;
  } catch {
    if (request !== unsplashRequest) return;
    credit.textContent = status === 401 || status === 403 ?
        'Unsplash photo unavailable — check the Access Key' :
        status === 429 ? 'Unsplash hourly photo limit reached' :
                         'Unsplash photo unavailable — try again later';
    credit.removeAttribute('href');
    credit.hidden = false;
  }
}
addWebUiListener('ember-unsplash-changed', updateUnsplashBackground);
void updateUnsplashBackground();

function bindSearch() {
  const form = document.getElementById('search-form');
  if (!form || form.dataset.bound) return;
  form.dataset.bound = 'true';
  const input = document.getElementById('q');
  const chip = document.getElementById('q-chip');
  const submitLabel = form.querySelector('button:last-child');
  const host = document.getElementById('native-liquid-glass');
  const root = host.querySelector('.liquid-glass-root');
  const ghost = document.createElement('div');
  ghost.className = 'ember-autofill';
  ghost.setAttribute('aria-hidden', 'true');
  input.insertAdjacentElement('afterend', ghost);
  const panel = document.createElement('div');
  panel.className = 'ember-recommendations';
  panel.setAttribute('role', 'listbox');
  panel.setAttribute('aria-label', 'Search recommendations');
  panel.hidden = true;
  const panelWarp = document.createElement('span');
  panelWarp.className = 'glass__warp';
  const panelRows = document.createElement('div');
  panelRows.className = 'ember-recommendation-list';
  const panelHighlight = document.createElement('span');
  panelHighlight.className = 'liquid-glass-highlight';
  panel.append(panelWarp, panelRows, panelHighlight);
  host.append(panel);

  // The normal NTP realbox owns the same Mojo handler. The third-party Ember
  // page binds it here and paints its own compact rows from Chromium's results.
  const handler = new PageHandlerRemote();
  const callbacks = new PageCallbackRouter();
  PageHandlerFactory.getRemote().createPageHandler(
      callbacks.$.bindNewPipeAndPassRemote(),
      handler.$.bindNewPipeAndPassReceiver());
  let queryId = 0;
  let activeQuery = -1;
  let results = [];
  let selected = 0;
  let paused = false;
  let panelVersion = 0;
  let engagedBang = null;
  let bangLookupVersion = 0;
  let pendingBangAlias = '';

  function setBang(bang) {
    engagedBang = bang;
    chip.replaceChildren();
    chip.hidden = !bang;
    const context = bang ?
        (bang.alias === 'gpt' ? 'Ask ChatGPT' : `Search ${bang.name}`) :
        'Search';
    if (bang) {
      const icon = document.createElement('img');
      icon.alt = '';
      let site = '';
      try {
        site = bang.iconUrl ? new URL(bang.iconUrl).origin : '';
      } catch {
        // A custom engine may have no usable favicon URL.
      }
      icon.src = site ?
          `chrome://favicon2/?size=16&pageUrl=${encodeURIComponent(site)}` :
          'chrome://resources/images/icon_search.svg';
      const divider = document.createElement('span');
      divider.className = 'liquid-glass-search-chip-divider';
      divider.setAttribute('aria-hidden', 'true');
      chip.append(icon, divider);
    }
    input.placeholder = bang ? context : 'Search Google or type a URL';
    input.setAttribute('aria-label', context);
    submitLabel.hidden = !!bang;
  }

  function querySuggestions() {
    root.dataset.autocompleteActive = input.value || engagedBang ? 'true' : 'false';
    if (engagedBang) {
      stop();
      return;
    }
    if (!input.value) {
      paused = false;
      stop();
      return;
    }
    if (paused) { stop(); return; }
    activeQuery = queryId++;
    const prefix = engagedBang ? `${engagedBang.alias} ` : '';
    handler.queryAutocomplete(activeQuery, prefix + input.value, false,
        prefix.length + (input.selectionStart || input.value.length));
  }

  function stop() {
    activeQuery = -1;
    results = [];
    const version = ++panelVersion;
    panel.classList.remove('open');
    panel.style.height = '0px';
    setTimeout(() => {
      if (panelVersion === version) panel.hidden = true;
    }, 280);
    panelRows.replaceChildren();
    ghost.replaceChildren();
    input.classList.remove('has-autofill');
    input.removeAttribute('aria-activedescendant');
    handler.stopAutocomplete(true);
  }

  function completionParts(match) {
    const typed = input.value;
    if (!typed || !match) return null;
    const suggestion = (match.fillIntoEdit || '').replace(
        engagedBang ? new RegExp(`^${engagedBang.alias}\\s+`, 'i') : /^$/, '');
    const at = suggestion.toLocaleLowerCase().indexOf(typed.toLocaleLowerCase());
    if (at < 0 || suggestion.length <= typed.length) return null;
    // fillIntoEdit is Chromium's own edit string. inlineAutocompletion is
    // authoritative for the usual suffix case; its nonempty value must agree.
    if (at === 0 && match.inlineAutocompletion &&
        !suggestion.endsWith(match.inlineAutocompletion)) return null;
    return [suggestion.slice(0, at), typed, suggestion.slice(at + typed.length)];
  }

  function paintCompletion() {
    ghost.replaceChildren();
    ghost.style.left = `${input.offsetLeft}px`;
    ghost.style.top = `${input.offsetTop}px`;
    ghost.style.width = `${input.offsetWidth}px`;
    ghost.style.height = `${input.offsetHeight}px`;
    const parts = completionParts(results[selected]?.match);
    const atEnd = input.selectionStart === input.value.length &&
        input.selectionEnd === input.value.length;
    input.classList.toggle('has-autofill', !!parts && atEnd && !paused);
    input.classList.toggle('autofill-middle',
        !!parts && !!parts[0] && atEnd && !paused);
    if (!parts || !atEnd || paused) return;
    for (let i = 0; i < parts.length; i++) {
      const span = document.createElement('span');
      span.className = i === 1 ? 'ember-autofill-typed' : 'ember-autofill-added';
      span.textContent = parts[i];
      ghost.append(span);
      if (i === 1 && parts[0]) {
        const caret = document.createElement('span');
        caret.className = 'ember-autofill-caret';
        ghost.append(caret);
      }
    }
  }

  function select(index) {
    if (!results.length) return;
    selected = (index + results.length) % results.length;
    for (const [i, row] of [...panelRows.children].entries()) {
      row.classList.toggle('selected', i === selected);
      row.setAttribute('aria-selected', String(i === selected));
      row.querySelector('.ember-recommendation-enter').hidden = i !== selected;
    }
    input.setAttribute('aria-activedescendant', `ember-recommendation-${selected}`);
    paintCompletion();
  }

  function accept(event) {
    if (!results.length || paused) return false;
    const {match, line} = results[selected];
    handler.openAutocompleteMatch(line, match.destinationUrl, true,
        event.button || 0, event.altKey, event.ctrlKey, event.metaKey,
        event.shiftKey, event instanceof KeyboardEvent);
    stop();
    return true;
  }

  function paintResults() {
    if (!results.length) {
      stop();
      return;
    }
    const wasHidden = panel.hidden;
    panelRows.replaceChildren();
    for (const [i, entry] of results.entries()) {
      const {match} = entry;
      const row = document.createElement('button');
      row.type = 'button';
      row.id = `ember-recommendation-${i}`;
      row.className = 'ember-recommendation';
      row.setAttribute('role', 'option');
      const icon = document.createElement('img');
      icon.className = 'ember-recommendation-icon';
      icon.alt = '';
      icon.src = match.iconUrl || match.iconPath ||
          (match.isSearchType ? 'chrome://resources/images/icon_search.svg' :
                                'chrome://favicon2/?size=16&pageUrl=' +
                                encodeURIComponent(match.destinationUrl || ''));
      icon.onerror = () => { icon.style.visibility = 'hidden'; };
      const text = document.createElement('span');
      text.className = 'ember-recommendation-text';
      const title = document.createElement('span');
      title.className = 'ember-recommendation-title';
      title.textContent = match.contents || match.fillIntoEdit;
      text.append(title);
      if (!match.isSearchType && match.description) {
        const description = document.createElement('span');
        description.className = 'ember-recommendation-description';
        description.textContent = match.description;
        text.append(description);
      }
      const enter = document.createElement('span');
      enter.className = 'ember-recommendation-enter';
      enter.setAttribute('aria-hidden', 'true');
      enter.textContent = '↵';
      row.append(icon, text, enter);
      row.addEventListener('pointerenter', () => select(i));
      row.addEventListener('pointerdown', (event) => event.preventDefault());
      row.addEventListener('click', (event) => { select(i); accept(event); });
      panelRows.append(row);
    }
    panelVersion++;
    if (wasHidden) {
      panel.hidden = false;
      panel.style.height = '0px';
      panel.classList.remove('open');
      // Establish the closed geometry before the first height/opacity change.
      panel.getBoundingClientRect();
    }
    panel.style.height = `${10 + results.length * 37}px`;
    panel.classList.add('open');
    select(0);
  }

  callbacks.autocompleteResultChanged.addListener((result) => {
    if (paused || result.queryId !== activeQuery || !input.value) return;
    results = result.matches.map((match, line) => ({match, line}))
        .filter(entry => !entry.match.isHidden).slice(0, 5);
    selected = 0;
    paintResults();
  });

  input.addEventListener('input', () => {
    const bangPrefix = !engagedBang &&
        /^(!?[a-z0-9][a-z0-9_+-]{0,23})\s/i.exec(input.value);
    if (bangPrefix && pendingBangAlias !== bangPrefix[1].toLowerCase()) {
      const alias = bangPrefix[1].toLowerCase();
      pendingBangAlias = alias;
      const version = ++bangLookupVersion;
      void sendWithPromise('emberBangLookup', alias).then((bang) => {
        if (version !== bangLookupVersion ||
            !input.value.toLowerCase().startsWith(alias + ' ')) return;
        pendingBangAlias = '';
        if (!bang?.alias) {
          querySuggestions();
          return;
        }
        const query = input.value.slice(alias.length + 1);
        setBang(bang);
        input.value = query;
        stop();
        input.focus();
      }).catch(() => {
        if (version !== bangLookupVersion) return;
        pendingBangAlias = '';
        querySuggestions();
      });
    } else if (!bangPrefix && pendingBangAlias) {
      pendingBangAlias = '';
      bangLookupVersion++;
    }
    if (pendingBangAlias) { stop(); return; }
    querySuggestions();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Backspace' && !input.value && engagedBang) {
      event.preventDefault();
      const alias = engagedBang.alias;
      setBang(null);
      input.value = alias;
      querySuggestions();
      return;
    }
    if (event.ctrlKey && event.key === 'Backspace') {
      paused = true;
      stop();
      return;
    }
    if (event.key === 'Enter' && engagedBang) {
      event.preventDefault();
      chrome.send('emberNavigateBang', [engagedBang.alias, input.value.trim()]);
      return;
    }
    if (event.key === 'Enter' && !engagedBang &&
        /^!?[a-z0-9][a-z0-9_+-]{0,23}\s+\S/i.test(input.value)) {
      event.preventDefault();
      const text = input.value;
      const alias = text.trim().split(/\s+/)[0].toLowerCase();
      void sendWithPromise('emberBangLookup', alias).then((bang) => {
        if (input.value !== text) return;
        if (bang?.alias) {
          chrome.send('emberNavigate', [text.trim()]);
        } else if (results.length && !paused) {
          accept(event);
        } else {
          chrome.send('emberNavigate', [text.trim()]);
        }
      });
      return;
    }
    if (event.key === 'Tab' && results.length && !paused) {
      event.preventDefault();
      select(selected + 1);
    } else if (event.key === 'Enter' && results.length && !paused) {
      event.preventDefault();
      accept(event);
    } else if (event.key === 'Escape') {
      stop();
      if (!input.value && engagedBang) setBang(null);
    }
  });
  input.addEventListener('click', paintCompletion);
  input.addEventListener('blur', () => {
    if (!panel.matches(':hover')) stop();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (engagedBang) chrome.send('emberNavigateBang', [engagedBang.alias, text]);
    else if (text) chrome.send('emberNavigate', [text]);
  });
  input.focus();
}

document.addEventListener('native-liquid-glass-ready', bindSearch);
bindSearch();

document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1)
    return;
  const input = document.getElementById('q');
  if (!input || document.activeElement === input) return;
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable))
    return;
  input.focus();
});
