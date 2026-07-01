const {
  cartResponse,
  readCartCookie,
  readFormOrJson,
  writeCartCookie
} = require('./_cart-utils');
const { sendJson } = require('../_utils');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { message: 'Metodo nao permitido.' });
  }

  const body = await readFormOrJson(req);
  const id = String(body.id || body.variant_id || '');
  const quantity = Math.max(0, Number(body.quantity || 0));
  let items = readCartCookie(req);

  if (id) {
    items = items
      .map((item) => String(item.id) === id ? { ...item, quantity } : item)
      .filter((item) => Number(item.quantity || 0) > 0);
  }

  writeCartCookie(res, items);
  return sendJson(res, 200, cartResponse(items));
};
