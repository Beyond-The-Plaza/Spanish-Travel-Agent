const { json, unavailable, authenticatedUser, hasCourseAccess } = require('./_course');

exports.handler = async (event) => {
  try {
    const user = await authenticatedUser(event);
    if (!user) return json(401, { error: 'Sign in required.' });
    return json(200, { paid: await hasCourseAccess(user.id), user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error('[access-status]', error);
    if (error.code === 'BACKEND_UNAVAILABLE') return unavailable();
    return json(500, { error: 'Unable to check access.' });
  }
};
