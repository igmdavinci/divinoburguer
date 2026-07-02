const { sendJson } = require('../_utils');
const { setSessionCookie } = require('../_admin-auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { message: 'Metodo nao permitido.' });
  }

  setSessionCookie(res, '', 0);
  return sendJson(res, 200, { ok: true });
};
