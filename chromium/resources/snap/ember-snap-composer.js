// Runs only in Chromium's internal isolated world after browser origin checks.
// Never writes composer text, clicks Send, or uses the Quick Search path.
((request) => {
  const visible = el => !!el && el.isConnected &&
      el.getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== 'hidden';
  if (location.origin !== 'https://chatgpt.com') return {state: 'login'};
  const slot = '__emberSnapPaste';
  const authSlot = '__emberSnapAuth';
  const clear = () => {
    const previous = globalThis[slot];
    if (previous?.listener) document.removeEventListener('paste', previous.listener, true);
    delete globalThis[slot];
  };
  if (request.phase === 'cancel') {
    clear();
    globalThis[authSlot]?.abort.abort();
    delete globalThis[authSlot];
    return {state: 'cancelled'};
  }
  // A guest homepage can expose a genuine textarea too. Require the site's
  // authenticated account control, including one inside its collapsed rail.
  const account = [...document.querySelectorAll('[data-testid="profile-button"], ' +
      '[data-testid="accounts-profile-button"], button[aria-label="Open profile menu"]')]
      .some(el => el.isConnected);
  const login = [...document.querySelectorAll('[data-testid="login-button"], ' +
      '[data-testid="signup-button"]')].some(visible);
  if (login || /\/(auth|login|signup)(\/|$)/.test(location.pathname))
    return {state: 'login'};
  // Mobile/responsive markup can keep a legacy textarea or test-id wrapper
  // beside the live editor. Normalize wrappers to real editable nodes and
  // deduplicate; never select an arbitrary first match or a page-wide textbox.
  const editable = el => el?.tagName === 'TEXTAREA' || el?.isContentEditable;
  const candidates = [...document.querySelectorAll(
      '#prompt-textarea, [data-testid="prompt-textarea"], ' +
      'form textarea, form [contenteditable], ' +
      '[data-testid="composer"] textarea, ' +
      '[data-testid="composer"] [contenteditable], ' +
      '[data-type="unified-composer"] textarea, ' +
      '[data-type="unified-composer"] [contenteditable]')];
  const composers = [...new Set(candidates.flatMap(el => editable(el) ? [el] :
      [...el.querySelectorAll('textarea, [contenteditable]')]))]
      .filter(el => {
        if (!editable(el) || !visible(el) ||
            el.getAttribute('aria-hidden') === 'true') return false;
        const bounds = el.getBoundingClientRect();
        // Offscreen/screen-reader legacy textareas can still have client rects.
        return bounds.width >= 16 && bounds.height >= 16;
      });
  if (!composers.length) return {state: 'waiting'};
  if (composers.length !== 1) return {state: 'ambiguous'};
  // Responsive ChatGPT versions omit the account control. Ask the site's own
  // same-origin session endpoint instead; never treat a guest textarea as proof.
  // Keep only a boolean, not session identities or tokens, and bound each request.
  if (!account) {
    let auth = globalThis[authSlot];
    if (auth && (auth.id !== request.id || auth.path !== location.pathname)) {
      auth.abort.abort();
      delete globalThis[authSlot];
      auth = null;
    }
    if (!auth || (!auth.pending && !auth.authenticated && Date.now() - auth.checked >= 5000)) {
      const abort = new AbortController();
      auth = {id: request.id, path: location.pathname, abort,
        pending: true, authenticated: false, error: false, checked: Date.now()};
      globalThis[authSlot] = auth;
      const current = auth;
      const timeout = setTimeout(() => abort.abort(), 10000);
      fetch('https://chatgpt.com/api/auth/session', {
        credentials: 'same-origin', signal: abort.signal,
        redirect: 'error', cache: 'no-store'
      }).then(response => {
        if (!response.ok || new URL(response.url).origin !== location.origin)
          throw new Error('Session unavailable');
        return response.json();
      }).then(session => {
        if (globalThis[authSlot] === current && location.pathname === current.path)
          current.authenticated = typeof session?.user?.id === 'string' &&
              session.user.id.length > 0;
      }).catch(() => {
        if (globalThis[authSlot] === current) current.error = true;
      }).finally(() => {
        clearTimeout(timeout);
        current.pending = false;
        current.checked = Date.now();
      });
    }
    if (auth.pending) return {state: 'auth-wait'};
    if (auth.error) return {state: 'auth-error'};
    if (!auth.authenticated) return {state: 'login'};
  }
  const composer = composers[0];
  if (composer.disabled || composer.getAttribute('aria-disabled') === 'true')
    return {state: 'waiting'};
  // Attachment evidence comes from the genuine composer surface, never the
  // conversation history. A changed DOM/composer fails conservatively.
  const surface = composer.closest('form') ?? composer.closest('[data-testid="composer"]') ??
      composer.closest('[data-type="unified-composer"]');
  if (!surface) return {state: 'changed'};
  const markers = () => [...surface.querySelectorAll(
      'img[src^="blob:"], img[alt*="attachment" i], ' +
      '[data-testid*="attachment"], button[aria-label*="Remove" i]')].filter(visible);
  if (request.phase === 'prepare') {
    clear();
    const state = {id: request.id, composer, surface, path: location.pathname,
      baseline: new Set(markers()), pasted: false, files: [], hashing: false};
    state.listener = event => {
      if (!event.isTrusted || state.pasted ||
          !composer.contains(event.target) || location.pathname !== state.path) return;
      for (const file of event.clipboardData?.files ?? []) {
        if (state.files.length < 4 && file.type === 'image/png' &&
            file.size > 0 && file.size <= 64 * 1024 * 1024) state.files.push(file);
      }
    };
    globalThis[slot] = state;
    document.addEventListener('paste', state.listener, true);
    composer.focus({preventScroll: true});
    return {state: document.activeElement === composer ? 'prepared' : 'changed',
      path: state.path};
  }
  const state = globalThis[slot];
  if (!state || state.id !== request.id ||
      state.surface !== surface || state.path !== location.pathname ||
      (state.composer !== composer && !state.pasted &&
       (request.phase !== 'check' || (!state.files.length && !state.hashing))))
    return {state: 'changed'};
  // Retry can move native focus to its button. Restore only this unchanged editor.
  if (request.phase === 'validate') {
    composer.focus({preventScroll: true});
    return {state: document.activeElement === composer ? 'prepared' : 'changed'};
  }
  // Only the browser's encoded capture counts as our paste. An unrelated
  // trusted clipboard event must not confirm this request's attachment.
  if (!state.pasted && !state.hashing && state.files.length &&
      /^[a-f0-9]{64}$/.test(request.digest ?? '')) {
    state.hashing = true;
    const file = state.files.shift();
    file.arrayBuffer().then(bytes => crypto.subtle.digest('SHA-256', bytes))
        .then(bytes => {
          const digest = [...new Uint8Array(bytes)]
              .map(value => value.toString(16).padStart(2, '0')).join('');
          if (globalThis[slot] === state && location.pathname === state.path)
            state.pasted = digest === request.digest;
        }).catch(() => {}).finally(() => {state.hashing = false;});
  }
  if (state.composer !== composer && !state.pasted)
    return {state: 'waiting', pasted: false};
  // A confirmed paste can cause the site to recreate its editor in the same
  // composer surface. Keep the capture proof and baseline, never repaste.
  if (state.pasted) state.composer = composer;
  const addedMarkers = markers().filter(el => !state.baseline.has(el));
  const errors = [...surface.querySelectorAll('[role="alert"]')].filter(visible);
  if (errors.some(el => /failed|unable|unsupported|too large|error|limit/i.test(el.textContent)))
    return {state: 'rejected', pasted: state.pasted};
  const uploadFailure = /upload (?:has )?failed|failed to upload|attachment .*(?:failed|unsupported|too large)/i;
  if (state.pasted && addedMarkers.length &&
      [...addedMarkers, ...document.querySelectorAll('[role="alert"]')]
          .filter(visible).some(el => uploadFailure.test(el.textContent)))
    return {state: 'rejected', pasted: true};
  const added = addedMarkers.length > 0;
  const uploading = [...surface.querySelectorAll('[role="progressbar"], [aria-busy="true"]')]
      .some(visible);
  // The site's own send readiness is evidence, never an action. Attachment
  // thumbnails can mount before their upload has finished.
  const send = [...surface.querySelectorAll('button[data-testid="send-button"], ' +
      'button[aria-label="Send prompt"], button[aria-label="Send message"]')].filter(visible);
  const ready = send.length === 1 && !send[0].disabled &&
      send[0].getAttribute('aria-disabled') !== 'true';
  if (state.pasted && added && !uploading && ready) {
    composer.focus({preventScroll: true});
    clear();
    return {state: 'attached', pasted: true};
  }
  return {state: 'waiting', pasted: state.pasted};
})
