const { randomUUID } = require('crypto');

function sendJson(res, statusCode, payload) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = statusCode;
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      const params = new URLSearchParams(req.body);
      return Object.fromEntries(params.entries());
    }
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    const params = new URLSearchParams(raw);
    return Object.fromEntries(params.entries());
  }
}

function requestBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const protocol = host && String(host).includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

function makeIdentifier(prefix = 'divino') {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 18)}`;
}

function currencyAmountFromCart(cartPayload) {
  const total = Number(cartPayload?.total_price ?? cartPayload?.items_subtotal_price ?? 0);
  const amount = total > 1000 ? total / 100 : total;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Carrinho vazio ou valor invalido.');
  }

  return Number(amount.toFixed(2));
}

function productsFromCart(cartPayload) {
  const items = Array.isArray(cartPayload?.items) ? cartPayload.items : [];

  return items.map((item) => {
    const unitPrice = Number(item.final_price ?? item.price ?? item.line_price ?? 0) / 100;
    return {
      id: String(item.variant_id || item.product_id || item.id || item.key || makeIdentifier('item')),
      name: String(item.product_title || item.title || item.name || 'Produto'),
      quantity: Number(item.quantity || 1),
      price: Number((Number.isFinite(unitPrice) ? unitPrice : 0).toFixed(2))
    };
  });
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variavel de ambiente ausente: ${name}`);
  }
  return value;
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return {
    url: url.replace(/\/$/, ''),
    key
  };
}

async function supabaseRequest(path, options = {}) {
  const config = supabaseConfig();
  if (!config) {
    throw new Error('Supabase nao configurado.');
  }

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    throw new Error(typeof data === 'string' ? data : JSON.stringify(data));
  }

  return data;
}

async function insertOrder(row) {
  const data = await supabaseRequest('amplopay_orders', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation'
    },
    body: JSON.stringify(row)
  });

  return Array.isArray(data) ? data[0] : data;
}

async function updateOrderByIdentifier(identifier, patch) {
  const data = await supabaseRequest(`amplopay_orders?identifier=eq.${encodeURIComponent(identifier)}`, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      ...patch,
      updated_at: new Date().toISOString()
    })
  });

  return Array.isArray(data) ? data[0] : data;
}

async function getOrderBySession(sessionId) {
  const data = await supabaseRequest(
    `amplopay_orders?session_id=eq.${encodeURIComponent(sessionId)}&select=*&limit=1`,
    { method: 'GET' }
  );

  return Array.isArray(data) ? data[0] : null;
}

async function getOrderByIdentifier(identifier) {
  const data = await supabaseRequest(
    `amplopay_orders?identifier=eq.${encodeURIComponent(identifier)}&select=*&limit=1`,
    { method: 'GET' }
  );

  return Array.isArray(data) ? data[0] : null;
}

async function insertCallback(row) {
  return supabaseRequest('amplopay_callbacks', {
    method: 'POST',
    headers: {
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(row)
  });
}

module.exports = {
  currencyAmountFromCart,
  getOrderByIdentifier,
  getOrderBySession,
  insertCallback,
  insertOrder,
  makeIdentifier,
  productsFromCart,
  readJson,
  requestBaseUrl,
  requiredEnv,
  sendJson,
  updateOrderByIdentifier
};
