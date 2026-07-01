const {
  cartResponse,
  readCartCookie,
  readFormOrJson,
  resolveVariantId,
  writeCartCookie
} = require('./_cart-utils');
const { sendJson } = require('../_utils');

function isLocalRequest(req) {
  const host = String(req.headers.host || req.headers['x-forwarded-host'] || '');
  return host.includes('localhost') || host.includes('127.0.0.1');
}

function bodyDebug(req, body) {
  return {
    fields: body && typeof body === 'object' ? Object.keys(body) : [],
    bodyType: req.body === undefined ? 'undefined' : typeof req.body,
    bodyIsBuffer: Buffer.isBuffer(req.body),
    contentType: req.headers['content-type'] || null
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { message: 'Metodo nao permitido.' });
  }

  const body = await readFormOrJson(req);
  const id = resolveVariantId(body.id || body.variant_id, body['product-id'] || body.product_id);
  const quantity = Math.max(1, Number(body.quantity || 1));

  if (!id) {
    if (isLocalRequest(req)) {
      return sendJson(res, 400, {
        message: 'Produto invalido.',
        debug: bodyDebug(req, body)
      });
    }

    return sendJson(res, 400, { message: 'Produto invalido.' });
  }

  const items = readCartCookie(req);
  const existing = items.find((item) => String(item.id) === id);

  if (existing) {
    existing.quantity = Number(existing.quantity || 1) + quantity;
  } else {
    items.push({ id, quantity });
  }

  writeCartCookie(res, items);

  const wantsJson = req.url.endsWith('.js') || String(req.headers.accept || '').includes('application/json');
  if (wantsJson) {
    return sendJson(res, 200, cartResponse(items));
  }

  res.statusCode = 303;
  res.setHeader('Location', '/cart');
  res.end();
};
