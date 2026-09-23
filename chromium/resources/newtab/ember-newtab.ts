/* eslint-disable no-restricted-properties */
// @ts-nocheck — WebUI globals are supplied by Chromium's internal-page runtime.
// Ember's New Tab remains a quiet logo and search surface. Favorites are
// managed in chrome://settings and rendered in the browser's sidebar.
window.EmberBrand.mountBrand(document.getElementById('ember-brand'));

function bindSearch() {
  const form = document.getElementById('search-form');
  if (!form || form.dataset.bound) return;
  form.dataset.bound = 'true';
  const input = document.getElementById('q');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (text) chrome.send('emberNavigate', [text]);
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
