const {
  insertCallback,
  readJson,
  requestBaseUrl,
  sendJson,
  updateOrderByIdentifier
} = require('../_utils');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return sendJson(res, 405, { message: 'Metodo nao permitido.' });
    }

    const url = new URL(req.url, requestBaseUrl(req));
    const identifier = url.searchParams.get('identifier');
    const payload = await readJson(req);
    const status = payload.status || payload?.data?.status || payload?.transfer?.status || null;

    await insertCallback({
      identifier,
      payload
    }).catch(() => null);

    if (identifier && status) {
      await updateOrderByIdentifier(identifier, {
        status,
        gateway_response: payload
      }).catch(() => null);
    }

    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return sendJson(res, 500, { message: error.message || 'Erro no callback.' });
  }
};
