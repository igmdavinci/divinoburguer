const {
  requiredEnv,
  sendJson,
  supabaseRequest
} = require('./_utils');

const COOKIE_NAME = 'divino_admin_token';

function authConfig() {
  const url = requiredEnv('SUPABASE_URL').replace(/\/$/, '');
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!key) {
    throw new Error('Variavel de ambiente ausente: SUPABASE_ANON_KEY');
  }

  return { url, key };
}

function cookieValue(req, name) {
  const cookie = String(req.headers.cookie || '');
  const entry = cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));

  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : '';
}

function setSessionCookie(res, token, maxAge) {
  const secure = process.env.VERCEL ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=${Math.max(0, Number(maxAge || 0))}`
  );
}

async function authRequest(path, options = {}) {
  const config = authConfig();
  const response = await fetch(`${config.url}/auth/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.key,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.message || payload.error_description || 'Falha na autenticacao.');
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

async function signIn(email, password) {
  return authRequest('token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

async function getUser(token) {
  return authRequest('user', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

async function isAuthorizedAdmin(userId) {
  if (!userId) return false;

  const rows = await supabaseRequest(
    `admin_users?user_id=eq.${encodeURIComponent(userId)}&active=eq.true&select=user_id&limit=1`,
    { method: 'GET' }
  );
  return Array.isArray(rows) && rows.length === 1;
}

async function requireAdmin(req, res) {
  const token = cookieValue(req, COOKIE_NAME);
  if (!token) {
    sendJson(res, 401, { message: 'Autenticacao necessaria.' });
    return null;
  }

  try {
    const user = await getUser(token);
    if (!await isAuthorizedAdmin(user.id)) {
      sendJson(res, 403, { message: 'Usuario sem acesso administrativo.' });
      return null;
    }
    return user;
  } catch {
    setSessionCookie(res, '', 0);
    sendJson(res, 401, { message: 'Sessao expirada.' });
    return null;
  }
}

module.exports = {
  isAuthorizedAdmin,
  requireAdmin,
  setSessionCookie,
  signIn
};
