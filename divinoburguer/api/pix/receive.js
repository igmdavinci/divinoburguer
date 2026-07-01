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

function amplopayCallbackBaseUrl(req) {
  const configured = process.env.AMPLOPAY_CALLBACK_BASE_URL || process.env.PUBLIC_CALLBACK_BASE_URL;
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  const host = String(req.headers.host || req.headers['x-forwarded-host'] || '');
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) {
    return 'https://divinoburguer.vercel.app';
  }

  return requestBaseUrl(req);
}

function normalizeGatewayError(payload, statusCode) {
  const message = String(payload?.message || payload?.error || '');

  if (statusCode === 403 && !message) {
    return {
      ...payload,
      message: 'A Amplopay bloqueou a requisicao. Em teste local, use uma URL publica para callback e confira se a credencial esta ativa.'
    };
  }

  if (/permiss[aã]o|Criar\/Consultar Transa/i.test(message)) {
    return {
      ...payload,
      message: 'A chave da Amplopay nao tem permissao para Criar/Consultar Transacoes. Ative essa permissao no painel da Amplopay ou solicite a liberacao ao suporte.'
    };
  }

  return payload;
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

    if (Number(order.amount) < 15) {
      return sendJson(res, 400, {
        message: 'O pedido minimo para gerar Pix e R$ 15,00. Adicione mais itens ao carrinho.'
      });
    }

    const apiBaseUrl = (process.env.AMPLOPAY_API_BASE_URL || 'https://app.amplopay.com/api/v1').replace(/\/$/, '');
    const publicKey = requiredEnv('AMPLOPAY_PUBLIC_KEY');
    const secretKey = requiredEnv('AMPLOPAY_SECRET_KEY');
    const baseUrl = amplopayCallbackBaseUrl(req);
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
    const gatewayPayload = normalizeGatewayError(gatewayResponse, response.status);
    if (!response.ok || gatewayResponse.statusCode >= 400) {
      await updateOrderByIdentifier(order.identifier, {
        status: 'PIX_FAILED',
        client,
        gateway_response: gatewayPayload
      });

      return sendJson(res, response.status || 400, gatewayPayload);
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
