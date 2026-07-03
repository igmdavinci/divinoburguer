const {
  getOrderByTransactionId,
  insertCallback,
  readJson,
  requestBaseUrl,
  sendJson,
  updateOrderByIdentifier
} = require('../_utils');

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '') || null;
}

function extractIdentifier(payload, fallback) {
  return firstValue(
    fallback,
    payload.identifier,
    payload.clientIdentifier,
    payload.client_identifier,
    payload.externalIdentifier,
    payload.external_identifier,
    payload.metadata?.identifier,
    payload.data?.identifier,
    payload.data?.clientIdentifier,
    payload.data?.client_identifier,
    payload.data?.externalIdentifier,
    payload.data?.external_identifier,
    payload.data?.metadata?.identifier,
    payload.transfer?.identifier,
    payload.transfer?.clientIdentifier,
    payload.transfer?.client_identifier,
    payload.transfer?.metadata?.identifier
  );
}

function extractTransactionId(payload) {
  return firstValue(
    payload.transactionId,
    payload.transaction_id,
    payload.id,
    payload.data?.transactionId,
    payload.data?.transaction_id,
    payload.data?.id,
    payload.transfer?.transactionId,
    payload.transfer?.transaction_id,
    payload.transfer?.id
  );
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return sendJson(res, 405, { message: 'Metodo nao permitido.' });
    }

    const url = new URL(req.url, requestBaseUrl(req));
    const payload = (await readJson(req)) || {};
    let identifier = extractIdentifier(payload, url.searchParams.get('identifier'));
    const transactionId = extractTransactionId(payload);
    const status = payload.status || payload?.data?.status || payload?.transfer?.status || null;

    if (!identifier && transactionId) {
      const order = await getOrderByTransactionId(transactionId).catch(() => null);
      identifier = order?.identifier || null;
    }

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
