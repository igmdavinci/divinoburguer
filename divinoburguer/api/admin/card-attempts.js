const { sendJson, supabaseRequest } = require('../_utils');
const { requireAdmin } = require('../_admin-auth');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return sendJson(res, 405, { message: 'Metodo nao permitido.' });
    }

    const user = await requireAdmin(req, res);
    if (!user) return;

    const rows = await supabaseRequest(
      'card_payment_attempts?select=id,phone,first_name,last_name,email,age,city,created_at&order=created_at.desc&limit=200',
      { method: 'GET' }
    );
    return sendJson(res, 200, { records: Array.isArray(rows) ? rows : [] });
  } catch (error) {
    return sendJson(res, 500, { message: error.message || 'Erro ao carregar os dados.' });
  }
};
