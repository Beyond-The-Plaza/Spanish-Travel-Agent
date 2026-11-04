const { json, required, supabase, stripeSignatureIsValid } = require('./_course');

async function grantAccess(session) {
  const userId = session.metadata?.supabase_user_id || session.client_reference_id;
  if (!userId) throw new Error('Checkout session has no course user reference.');
  const response = await supabase('/rest/v1/user_entitlements?on_conflict=user_id,product_key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: userId, product_key: 'full-course', status: 'active', stripe_customer_id: session.customer, stripe_checkout_session_id: session.id, updated_at: new Date().toISOString() })
  });
  if (!response.ok) throw new Error(`Could not save access: ${await response.text()}`);
}

/* Only a full refund ends access (charge.refunded also fires for partial ones). */
async function revokeRefundedAccess(charge) {
  if (!charge.refunded || !charge.payment_intent) return;
  const lookup = await fetch(`https://api.stripe.com/v1/checkout/sessions?payment_intent=${encodeURIComponent(charge.payment_intent)}&limit=1`, {
    headers: { Authorization: `Bearer ${required('STRIPE_SECRET_KEY')}` }
  });
  const sessions = await lookup.json();
  if (!lookup.ok) throw new Error(sessions.error?.message || 'Could not look up the refunded checkout session.');
  const session = sessions.data[0];
  if (!session) return;   // a charge that didn't come from course checkout
  const response = await supabase(`/rest/v1/user_entitlements?stripe_checkout_session_id=eq.${encodeURIComponent(session.id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'revoked', updated_at: new Date().toISOString() })
  });
  if (!response.ok) throw new Error(`Could not revoke access: ${await response.text()}`);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  try {
    const payload = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    const signature = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
    if (!stripeSignatureIsValid(payload, signature)) return json(400, { error: 'Invalid signature.' });
    const stripeEvent = JSON.parse(payload);
    const object = stripeEvent.data.object;
    // Delayed payment methods complete checkout while still 'unpaid', then send async_payment_succeeded.
    if (stripeEvent.type === 'checkout.session.completed' && object.payment_status !== 'unpaid') await grantAccess(object);
    if (stripeEvent.type === 'checkout.session.async_payment_succeeded') await grantAccess(object);
    if (stripeEvent.type === 'charge.refunded') await revokeRefundedAccess(object);
    return json(200, { received: true });
  } catch (error) {
    console.error('[stripe-webhook]', error);
    return json(500, { error: 'Webhook processing failed.' });
  }
};
