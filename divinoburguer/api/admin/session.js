const { sendJson } = require('../_utils');
const { requireAdmin } = require('../_admin-auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { message: 'Metodo nao permitido.' });
  }

  const user = await requireAdmin(req, res);
  if (!user) return;

  return sendJson(res, 200, {
    authenticated: true,
    user: {
      id: user.id,
      email: user.email
    }
  });
};
