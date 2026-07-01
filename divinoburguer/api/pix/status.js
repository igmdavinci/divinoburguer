const {
  getOrderByIdentifier,
  readJson,
  requiredEnv,
  sendJson,
  updateOrderByIdentifier
} = require('../_utils');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      await readJson(req);
      return sendJson(res, 405, { message: 'Metodo nao permitido.' });
    }

    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const id = url.searchParams.get('id') || url.searchParams.get('transactionId');
    const clientIdentifier = url.searchParams.get('clientIdentifier') || url.searchParams.get('identifier');

    if (!id && !clientIdentifier) {
      return sendJson(res, 400, { message: 'Informe id ou clientIdentifier.' });
    }

    const apiBaseUrl = (process.env.AMPLOPAY_API_BASE_URL || 'https://app.amplopay.com/api/v1').replace(/\/$/, '');
    const params = new URLSearchParams();
    if (id) params.set('id', id);
    if (clientIdentifier) params.set('clientIdentifier', clientIdentifier);

    const response = await fetch(`${apiBaseUrl}/gateway/transfers?${params.toString()}`, {
      method: 'GET',
      headers: {
        'x-public-key': requiredEnv('AMPLOPAY_PUBLIC_KEY'),
        'x-secret-key': requiredEnv('AMPLOPAY_SECRET_KEY')
      }
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return sendJson(res, response.status, payload);
    }

    if (clientIdentifier) {
      const order = await getOrderByIdentifier(clientIdentifier).catch(() => null);
      if (order) {
        await updateOrderByIdentifier(clientIdentifier, {
          status: payload.status || order.status,
          gateway_response: payload
        });
      }
    }

    return sendJson(res, 200, payload);
  } catch (error) {
    return sendJson(res, 500, { message: error.message || 'Erro ao consultar Pix.' });
  }
};
