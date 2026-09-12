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
    const supabase = getClient();
    if (!supabase) return entitlement = { loaded: true, paid: false, configurationRequired: true };
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return entitlement = { loaded: true, paid: false, signedIn: false };
    const response = await fetch('/.netlify/functions/access-status', {
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    if (!response.ok) return entitlement = { loaded: true, paid: false, signedIn: true };
    const data = await response.json();
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
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`/.netlify/functions/course-lesson?slug=${encodeURIComponent(slug)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'This lesson is not available to your account.');
    }
    return response.text();
  }

  window.courseAccess = { refreshEntitlement, showPaywall, startCheckout, fetchLesson, get entitlement() { return entitlement; } };
  if (configured()) {
    getClient().auth.onAuthStateChange(() => refreshEntitlement().then(() => {
      if (new URLSearchParams(window.location.search).get('checkout') === 'success') window.courseAccess.showPaywall();
    }));
    refreshEntitlement();
  }
}());
