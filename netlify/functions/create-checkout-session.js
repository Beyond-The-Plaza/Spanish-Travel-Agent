const { json, unavailable, required, authenticatedUser, hasCourseAccess } = require('./_course');

// Managed Payments (Stripe handles sales tax/VAT, fraud and order support) needs this preview version or later.
const STRIPE_API_VERSION = '2026-02-25.preview';

/* The Origin header is caller-supplied, so only send customers back to this site's own URLs. */
function siteOrigin(event) {
  const origin = event.headers.origin || event.headers.Origin;
  const own = [process.env.URL, process.env.DEPLOY_PRIME_URL, process.env.DEPLOY_URL];
  return own.includes(origin) ? origin : required('URL');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  try {
    const user = await authenticatedUser(event);
    if (!user) return json(401, { error: 'Sign in required.' });
    if (await hasCourseAccess(user.id)) return json(409, { error: 'You already have full access.', code: 'already_paid' });
    const priceId = required('STRIPE_FULL_COURSE_PRICE_ID');
    const origin = siteOrigin(event);
    const form = new URLSearchParams({
      mode: 'payment',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'managed_payments[enabled]': 'true',
      customer_email: user.email,
      client_reference_id: user.id,
      'metadata[supabase_user_id]': user.id,
      success_url: `${origin}/Splash-draftv3-parrot.html?checkout=success`,
      cancel_url: `${origin}/Splash-draftv3-parrot.html?checkout=cancelled`
    });
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${required('STRIPE_SECRET_KEY')}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Stripe-Version': STRIPE_API_VERSION },
      body: form
    });
    const session = await response.json();
    if (!response.ok) throw new Error(session.error?.message || 'Stripe could not create checkout.');
    return json(200, { url: session.url });
  } catch (error) {
    console.error('[create-checkout-session]', error);
    if (error.code === 'BACKEND_UNAVAILABLE') return unavailable();
    return json(500, { error: 'Unable to start checkout.' });
  }
};
