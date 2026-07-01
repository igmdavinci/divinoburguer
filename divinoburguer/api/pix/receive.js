const {
  getOrderBySession,
  readJson,
  requestBaseUrl,
  requiredEnv,
  sendJson,
  updateOrderByIdentifier
} = require('../_utils');

function tomorrowDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return sendJson(res, 405, { message: 'Metodo nao permitido.' });
    }

    const body = await readJson(req);
    const sessionId = body.sessionId || body.session_id;
    const client = body.client || {};

    if (!sessionId) {
      return sendJson(res, 400, { message: 'Sessao ausente.' });
    }

    if (!client.name || !client.email || !client.phone || !client.document) {
      return sendJson(res, 400, { message: 'Preencha nome, email, telefone e CPF.' });
    }

    const order = await getOrderBySession(sessionId);
    if (!order) {
      return sendJson(res, 404, { message: 'Sessao nao encontrada.' });
    }

    const apiBaseUrl = (process.env.AMPLOPAY_API_BASE_URL || 'https://app.amplopay.com/api/v1').replace(/\/$/, '');
    const publicKey = requiredEnv('AMPLOPAY_PUBLIC_KEY');
    const secretKey = requiredEnv('AMPLOPAY_SECRET_KEY');
    const baseUrl = requestBaseUrl(req);
    const payload = {
      identifier: order.identifier,
      amount: Number(order.amount),
      client,
      products: order.products || [],
      dueDate: tomorrowDate(),
      metadata: {
        sessionId,
        source: 'divinoburguer'
      },
      callbackUrl: `${baseUrl}/api/pix/callback?identifier=${encodeURIComponent(order.identifier)}`
    };

    const response = await fetch(`${apiBaseUrl}/gateway/pix/receive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-public-key': publicKey,
        'x-secret-key': secretKey
      },
      body: JSON.stringify(payload)
    });

    const gatewayResponse = await response.json().catch(() => ({}));
    if (!response.ok || gatewayResponse.statusCode >= 400) {
      await updateOrderByIdentifier(order.identifier, {
        status: 'PIX_FAILED',
        client,
        gateway_response: gatewayResponse
      });

      return sendJson(res, response.status || 400, gatewayResponse);
    }

    await updateOrderByIdentifier(order.identifier, {
      transaction_id: gatewayResponse.transactionId || null,
      status: gatewayResponse.status || 'PIX_CREATED',
      client,
      pix: gatewayResponse.pix || null,
      gateway_response: gatewayResponse
    });

    return sendJson(res, 200, {
      ...gatewayResponse,
      identifier: order.identifier,
      sessionId
    });
  } catch (error) {
    return sendJson(res, 500, { message: error.message || 'Erro ao gerar Pix.' });
  }
};
