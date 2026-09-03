const { catalogProducts } = require('../cart/_cart-utils');
const { sendJson } = require('../_utils');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { message: 'Metodo nao permitido.' });
  }

  try {
    const products = await catalogProducts();
    return sendJson(res, 200, {
      products: products.map(({ id, product_id, price }) => ({ id, product_id, price }))
    });
  } catch {
    return sendJson(res, 200, { products: [] });
  }
};
