const {
  getOrderByIdentifier,
  readJson,
  requestBaseUrl,
  requiredEnv,
  sendJson,
  updateOrderByIdentifier
} = require('../_utils');

function normalizeGatewayError(payload, statusCode) {
  const message = String(payload?.message || payload?.error || '');

  if (statusCode === 403 || /permiss[aã]o|Criar\/Consultar Transa/i.test(message)) {
    return {
      ...payload,
      message: 'A chave da Amplopay nao tem permissao para Criar/Consultar Transacoes. Ative essa permissao no painel da Amplopay ou solicite a liberacao ao suporte.'
    };
  }

  return payload;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      await readJson(req);
      return sendJson(res, 405, { message: 'Metodo nao permitido.' });
    }

    const url = new URL(req.url, requestBaseUrl(req));
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

    const payload = normalizeGatewayError(await response.json().catch(() => ({})), response.status);
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
