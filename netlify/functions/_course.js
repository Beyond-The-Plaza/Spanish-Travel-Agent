const crypto = require('crypto');

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

/* Thrown when Supabase can't be reached or answers with a server error. Handlers turn it
   into a 503 so the browser can tell "backend down" apart from "not signed in" / "not paid". */
class BackendUnavailableError extends Error {
  constructor(message) { super(message); this.code = 'BACKEND_UNAVAILABLE'; }
}

function unavailable() {
  return json(503, { error: 'The course service is temporarily unavailable.', code: 'backend_unavailable' });
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} environment variable.`);
  return value;
}

async function authenticatedUser(event) {
  const authorization = event.headers.authorization || event.headers.Authorization;
  if (!authorization?.startsWith('Bearer ')) return null;
  let response;
  try {
    response = await fetch(`${required('SUPABASE_URL')}/auth/v1/user`, {
      headers: { apikey: required('SUPABASE_ANON_KEY'), Authorization: authorization }
    });
  } catch (error) {
    throw new BackendUnavailableError(`Supabase auth unreachable: ${error.message}`);
  }
  if (response.ok) return response.json();
  // A rejected token is a normal "not signed in"; anything else is Supabase being unwell.
  if ([400, 401, 403].includes(response.status)) return null;
  throw new BackendUnavailableError(`Supabase auth returned ${response.status}`);
}

async function supabase(path, options = {}) {
  try {
    return await fetch(`${required('SUPABASE_URL')}${path}`, {
      ...options,
      headers: { apikey: required('SUPABASE_SERVICE_ROLE_KEY'), Authorization: `Bearer ${required('SUPABASE_SERVICE_ROLE_KEY')}`, ...(options.headers || {}) }
    });
  } catch (error) {
    if (error.message?.startsWith('Missing ')) throw error;   // config problem, not an outage
    throw new BackendUnavailableError(`Supabase unreachable: ${error.message}`);
  }
}

async function hasCourseAccess(userId) {
  const response = await supabase(`/rest/v1/user_entitlements?user_id=eq.${encodeURIComponent(userId)}&product_key=eq.full-course&status=eq.active&select=id`, {
    headers: { Accept: 'application/json' }
  });
  // A failed lookup must never read as "not paid": that would show a buy button to a paying customer.
  if (!response.ok) throw new BackendUnavailableError(`Entitlement lookup returned ${response.status}`);
  return (await response.json()).length > 0;
}

function stripeSignatureIsValid(payload, signature) {
  const secret = required('STRIPE_WEBHOOK_SECRET');
  const parts = Object.fromEntries((signature || '').split(',').map((item) => item.split('=')));
  if (!parts.t || !parts.v1) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${payload}`, 'utf8').digest('hex');
  const actual = Buffer.from(parts.v1);
  const expectedBuffer = Buffer.from(expected);
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(expectedBuffer, actual);
}

module.exports = { json, unavailable, BackendUnavailableError, required, authenticatedUser, supabase, hasCourseAccess, stripeSignatureIsValid };
