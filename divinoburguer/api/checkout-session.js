const {
  currencyAmountFromCart,
  getOrderBySession,
  insertOrder,
  makeIdentifier,
  productsFromCart,
  readJson,
  requestBaseUrl,
  sendJson
} = require('./_utils');

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, requestBaseUrl(req));
      const sessionId = url.searchParams.get('id') || url.searchParams.get('session');

      if (!sessionId) {
        return sendJson(res, 400, { message: 'Informe o id da sessao.' });
      }

      const order = await getOrderBySession(sessionId);
      if (!order) {
        return sendJson(res, 404, { message: 'Sessao nao encontrada.' });
      }

      return sendJson(res, 200, {
        sessionId: order.session_id,
        identifier: order.identifier,
        amount: order.amount,
        products: order.products || [],
        status: order.status
      });
    }

    if (req.method !== 'POST') {
      return sendJson(res, 405, { message: 'Metodo nao permitido.' });
    }

    const body = await readJson(req);
    const cartPayload = body.cart_payload || body.cartPayload || body.cart || {};
    const amount = currencyAmountFromCart(cartPayload);
    const products = productsFromCart(cartPayload);
    const sessionId = makeIdentifier('sess');
    const identifier = makeIdentifier('pix');
    const baseUrl = requestBaseUrl(req);

    await insertOrder({
      session_id: sessionId,
      identifier,
      status: 'CHECKOUT_STARTED',
      amount,
      products,
      cart_payload: cartPayload,
      metadata: {
        shop: body.shop || null,
        origin: body.origin || req.headers.host || null
      }
    });

    return sendJson(res, 200, {
      active: true,
      skip_cart: false,
      checkout_direct_url: `${baseUrl}/checkout.html?session=${encodeURIComponent(sessionId)}`,
      sessionId
    });
  } catch (error) {
    return sendJson(res, 500, {
      active: false,
      message: error.message || 'Erro ao criar checkout.'
    });
  }
};
