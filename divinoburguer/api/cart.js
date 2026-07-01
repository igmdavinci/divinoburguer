const { cartResponse, readCartCookie } = require('./cart/_cart-utils');
const { sendJson } = require('./_utils');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { message: 'Metodo nao permitido.' });
  }

  return sendJson(res, 200, cartResponse(readCartCookie(req)));
};
