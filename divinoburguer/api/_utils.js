const { randomUUID } = require('crypto');

function sendJson(res, statusCode, payload) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = statusCode;
  res.end(JSON.stringify(payload));
}

function parseFormBody(raw, contentType = '') {
  if (raw && typeof raw === 'object') {
    if (Buffer.isBuffer(raw)) {
      return parseFormBody(raw.toString('utf8'), contentType);
    }

    if (raw instanceof ArrayBuffer) {
      return parseFormBody(Buffer.from(raw).toString('utf8'), contentType);
    }

    if (Buffer.isBuffer(raw.body) || typeof raw.body === 'string') {
      return parseFormBody(raw.body, contentType);
    }

    if (raw.fields && typeof raw.fields === 'object') {
      return raw.fields;
    }

    return raw;
  }

  if (contentType.includes('multipart/form-data')) {
    return parseMultipartForm(raw, contentType);
  }

  try {
    return JSON.parse(raw);
  } catch {
    const params = new URLSearchParams(raw);
    return Object.fromEntries(params.entries());
  }
}

function parseMultipartForm(raw, contentType) {
  const boundaryMatch = contentType.match(/boundary="?([^";]+)"?/i);
  if (!boundaryMatch) {
    return {};
  }

  const fields = {};
  const boundary = `--${boundaryMatch[1]}`;
  const normalized = String(raw).replace(/\r\n/g, '\n');

  normalized.split(boundary).forEach((part) => {
    const separator = part.indexOf('\n\n');
    if (separator === -1) {
      return;
    }

    const header = part.slice(0, separator);
    const nameMatch = header.match(/name="([^"]+)"/i);
    if (!nameMatch || /filename="/i.test(header)) {
      return;
    }

    let value = part.slice(separator + 2);
    value = value.replace(/\n--$/, '').replace(/\n$/, '');
    fields[nameMatch[1]] = value;
  });

  return fields;
}

async function readJson(req) {
  const contentType = String(req.headers['content-type'] || '');

  if (Buffer.isBuffer(req.body)) {
    return parseFormBody(req.body.toString('utf8'), contentType);
  }

  if (req.body instanceof ArrayBuffer) {
    return parseFormBody(Buffer.from(req.body).toString('utf8'), contentType);
  }

  if (typeof req.body === 'string') {
    return parseFormBody(req.body, contentType);
  }

  if (req.body && typeof req.body === 'object') {
    return parseFormBody(req.body, contentType);
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) {
    return {};
  }

  return parseFormBody(raw, contentType);
}

function requestBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  return `${protocol}://${host}`;
}

function makeIdentifier(prefix = 'divino') {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 18)}`;
}

function currencyAmountFromCart(cartPayload) {
  const explicitTotal = Number(cartPayload?.total_price ?? cartPayload?.items_subtotal_price ?? 0);
  const items = Array.isArray(cartPayload?.items) ? cartPayload.items : [];
  const itemTotal = items.reduce((sum, item) => {
    const linePrice = Number(item.final_line_price ?? item.line_price ?? 0);
    const unitPrice = Number(item.final_price ?? item.price ?? 0);
    const quantity = Number(item.quantity || 1);
    return sum + (linePrice || (unitPrice * quantity) || 0);
  }, 0);
  const total = explicitTotal || itemTotal;
  const amount = total / 100;

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
      price: Number((Number.isFinite(unitPrice) ? unitPrice : 0).toFixed(2)),
      image: item.image || item.featured_image || null
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

async function getOrderByTransactionId(transactionId) {
  const data = await supabaseRequest(
    `amplopay_orders?transaction_id=eq.${encodeURIComponent(transactionId)}&select=*&limit=1`,
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

async function insertCardAttempt(row) {
  const data = await supabaseRequest('card_payment_attempts', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation'
    },
    body: JSON.stringify(row)
  });

  return Array.isArray(data) ? data[0] : data;
}

module.exports = {
  currencyAmountFromCart,
  getOrderByIdentifier,
  getOrderBySession,
  getOrderByTransactionId,
  insertCallback,
  insertCardAttempt,
  insertOrder,
  makeIdentifier,
  productsFromCart,
  readJson,
  requestBaseUrl,
  requiredEnv,
  sendJson,
  supabaseRequest,
  updateOrderByIdentifier
};
