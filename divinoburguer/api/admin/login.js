const { readJson, sendJson } = require('../_utils');
const {
  isAuthorizedAdmin,
  setSessionCookie,
  signIn
} = require('../_admin-auth');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return sendJson(res, 405, { message: 'Metodo nao permitido.' });
    }

    const body = await readJson(req);
    const email = String(body.email || '').trim();
    const password = String(body.password || '');

    if (!email || !password) {
      return sendJson(res, 400, { message: 'Informe email e senha.' });
    }

    const session = await signIn(email, password);
    if (!await isAuthorizedAdmin(session.user?.id)) {
      return sendJson(res, 403, { message: 'Usuario sem acesso administrativo.' });
    }

    setSessionCookie(res, session.access_token, session.expires_in || 3600);
    return sendJson(res, 200, {
      ok: true,
      user: {
        id: session.user.id,
        email: session.user.email
      }
    });
  } catch {
    return sendJson(res, 401, { message: 'Email ou senha invalidos.' });
  }
};
