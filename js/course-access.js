/* Global account and entitlement helpers for Beyond the Plaza. */
(function () {
  const config = window.BTP_COURSE_CONFIG || {};
  let client = null;
  let entitlement = { loaded: false, paid: false };

  function configured() {
    return Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
  }

  function getClient() {
    if (!configured()) return null;
    if (!client) client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    return client;
  }

  async function refreshEntitlement() {
    // Supabase settings missing = a real configuration problem. The supabase-js script simply
    // not loading (offline, blocked CDN) is an outage and must not look like "not paid".
    if (!config.supabaseUrl || !config.supabaseAnonKey) return entitlement = { loaded: true, paid: false, configurationRequired: true };
    const supabase = getClient();
    if (!supabase) return entitlement = { loaded: true, paid: false, unavailable: true };
    let session;
    try {
      ({ data: { session } } = await supabase.auth.getSession());
    } catch (error) {
      return entitlement = { loaded: true, paid: false, unavailable: true };
    }
    if (!session) return entitlement = { loaded: true, paid: false, signedIn: false };
    let response;
    try {
      response = await fetch('/.netlify/functions/access-status', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
    } catch (error) {
      return entitlement = { loaded: true, paid: false, signedIn: true, unavailable: true };
    }
    if (response.status >= 500) return entitlement = { loaded: true, paid: false, signedIn: true, unavailable: true };
    if (!response.ok) return entitlement = { loaded: true, paid: false, signedIn: true };
    const data = await response.json();
    if (data.paid && data.user) rememberUser(data.user.id);
    return entitlement = { loaded: true, paid: Boolean(data.paid), signedIn: true, user: data.user };
  }

  async function sendMagicLink(email) {
    const supabase = getClient();
    if (!supabase) throw new Error('Course accounts have not been configured yet.');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname }
    });
    if (error) throw error;
  }

  async function startCheckout() {
    const supabase = getClient();
    if (!supabase) throw new Error('Course payments have not been configured yet.');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { showPaywall(); return; }
    const response = await fetch('/.netlify/functions/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ productKey: config.courseProductKey })
    });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('Checkout is not available on this deployment yet. Publish this branch through Netlify, where the secure payment function can run.');
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to start checkout.');
    window.location.assign(data.url);
  }

  function showPaywall() {
    const existing = document.getElementById('course-access-modal');
    if (existing) existing.remove();
    const signedIn = entitlement.signedIn;
    const body = signedIn
      ? `<p>Your account is ready. Unlock the complete course whenever you are.</p>
         <button class="course-access__primary" data-course-action="checkout">Unlock full course</button>`
      : `<p>Enter your email and we’ll send a secure sign-in link. Your progress and access stay with you.</p>
         <form data-course-action="magic-link"><label for="course-email">Email address</label><input id="course-email" type="email" required placeholder="you@example.com"><button class="course-access__primary" type="submit">Continue</button></form>`;
    const modal = document.createElement('div');
    modal.id = 'course-access-modal';
    modal.className = 'course-access';
    modal.innerHTML = `<div class="course-access__scrim" data-course-action="close"></div><section class="course-access__card" role="dialog" aria-modal="true" aria-labelledby="course-access-title"><button class="course-access__close" aria-label="Close" data-course-action="close">×</button><div class="course-access__eyebrow">Beyond the Plaza</div><h2 id="course-access-title">Unlock the full course</h2>${body}<p class="course-access__message" aria-live="polite"></p></section>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', async (event) => {
      const action = event.target.closest('[data-course-action]')?.dataset.courseAction;
      if (!action) return;
      if (action === 'close') return modal.remove();
      const message = modal.querySelector('.course-access__message');
      try {
        if (action === 'checkout') { message.textContent = 'Opening secure checkout…'; await startCheckout(); }
      } catch (error) { message.textContent = error.message; }
    });
    const form = modal.querySelector('form');
    if (form) form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = modal.querySelector('.course-access__message');
      try {
        await sendMagicLink(form.querySelector('input').value);
        message.textContent = 'Check your inbox for your sign-in link.';
      } catch (error) { message.textContent = error.message; }
    });
  }

  async function fetchLesson(slug) {
    const supabase = getClient();
    if (!supabase) throw lessonError('Course service unavailable.', 0);
    let response;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw lessonError('Sign in required.', 401);
      response = await fetch(`/.netlify/functions/course-lesson?slug=${encodeURIComponent(slug)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
    } catch (error) {
      throw error.status ? error : lessonError('Course service unavailable.', 0);
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw lessonError(data.error || 'This lesson is not available to your account.', response.status);
    }
    return response.text();
  }

  /* status: 0 = network failure, 401 = not signed in, 403 = not paid, 404 = not published, 5xx/503 = backend down */
  function lessonError(message, status) {
    const error = new Error(message);
    error.status = status;
    return error;
  }

  /* ── Per-user lesson cache (IndexedDB) ────────────────────────────────
     Lets a paying member reopen steps 2+ without Supabase, including during an
     outage. Keyed by user id + slug and wiped on sign-out. Revalidated in the
     background by js/app.js, which drops it if access is revoked.
     Note: there is no expiry yet — add one to `cacheLesson`/`getCachedLesson`
     (compare `cachedAt`) if offline access should lapse after N days. */
  const CACHE_DB = 'btp-lessons';
  const CACHE_STORE = 'lessons';
  const LAST_USER_KEY = 'btp_uid';

  function rememberUser(id) { try { localStorage.setItem(LAST_USER_KEY, id); } catch (error) { /* private mode */ } }
  function forgetUser() { try { localStorage.removeItem(LAST_USER_KEY); } catch (error) { /* private mode */ } }
  function cacheUserId() {
    if (entitlement.user && entitlement.user.id) return entitlement.user.id;
    try { return localStorage.getItem(LAST_USER_KEY); } catch (error) { return null; }
  }

  function withStore(mode, run) {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB unavailable'));
      const open = indexedDB.open(CACHE_DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(CACHE_STORE);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction(CACHE_STORE, mode);
        const request = run(tx.objectStore(CACHE_STORE));
        tx.oncomplete = () => { db.close(); resolve(request ? request.result : undefined); };
        tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
      };
    });
  }

  async function getCachedLesson(slug) {
    const uid = cacheUserId();
    if (!uid) return null;
    try {
      const entry = await withStore('readonly', (store) => store.get(`${uid}:${slug}`));
      return entry && entry.html ? entry.html : null;
    } catch (error) { return null; }
  }

  async function cacheLesson(slug, html) {
    const uid = cacheUserId();
    if (!uid) return;
    try { await withStore('readwrite', (store) => store.put({ html, cachedAt: Date.now() }, `${uid}:${slug}`)); } catch (error) { /* cache is best-effort */ }
  }

  async function clearLessonCache() {
    try { await withStore('readwrite', (store) => store.clear()); } catch (error) { /* nothing to clear */ }
  }

  window.courseAccess = { refreshEntitlement, showPaywall, startCheckout, fetchLesson, getCachedLesson, cacheLesson, clearLessonCache, get entitlement() { return entitlement; } };
  if (configured()) {
    getClient().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { forgetUser(); clearLessonCache(); }
      return refreshEntitlement().then(() => {
        if (new URLSearchParams(window.location.search).get('checkout') === 'success') window.courseAccess.showPaywall();
      });
    });
    refreshEntitlement();
  }
}());
