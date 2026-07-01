const fs = require('fs');
const http = require('http');
const path = require('path');

const root = __dirname;
const port = Number(process.env.PORT || 3000);

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;

  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;

    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    value = value.replace(/^['"]|['"]$/g, '');

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(root, '.env.local'));

if (!process.env.PUBLIC_BASE_URL || process.env.PUBLIC_BASE_URL.includes('vercel.app')) {
  process.env.PUBLIC_BASE_URL = `http://localhost:${port}`;
}

const apiRoutes = new Map([
  ['/api/cart', './api/cart.js'],
  ['/cart.json', './api/cart.js'],
  ['/cart.js', './api/cart.js'],
  ['/api/cart/add', './api/cart/add.js'],
  ['/cart/add', './api/cart/add.js'],
  ['/cart/add.js', './api/cart/add.js'],
  ['/api/cart/change', './api/cart/change.js'],
  ['/cart/change.js', './api/cart/change.js'],
  ['/api/cart/clear', './api/cart/clear.js'],
  ['/cart/clear.js', './api/cart/clear.js'],
  ['/cart/clear177b.js', './api/cart/clear.js'],
  ['/api/checkout-session', './api/checkout-session.js'],
  ['/api/pix/receive', './api/pix/receive.js'],
  ['/api/pix/status', './api/pix/status.js'],
  ['/api/pix/callback', './api/pix/callback.js'],
  ['/.well-known/shopify/monorail/v1/produce', './api/monorail.js']
]);

const fileRoutes = new Map([
  ['/admin', './divinoburguer/admin.html'],
  ['/admin.html', './divinoburguer/admin.html'],
  ['/checkout', './divinoburguer/checkout.html'],
  ['/checkout.html', './divinoburguer/checkout.html'],
  ['/pix', './divinoburguer/pix.html'],
  ['/pix.html', './divinoburguer/pix.html']
]);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function redirect(res, location) {
  res.statusCode = 307;
  res.setHeader('Location', location);
  res.end(`Redirecting to ${location}`);
}

function sendFile(res, relativePath) {
  const fullPath = path.resolve(root, relativePath);
  if (!fullPath.startsWith(root) || !fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    res.statusCode = 404;
    res.end('404: NOT_FOUND');
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', contentTypes[path.extname(fullPath).toLowerCase()] || 'application/octet-stream');
  fs.createReadStream(fullPath).pipe(res);
}

function staticPath(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  return `.${normalized}`;
}

async function runApi(req, res, apiFile) {
  try {
    const fullPath = path.join(root, apiFile);
    delete require.cache[require.resolve(fullPath)];
    await require(fullPath)(req, res);
  } catch (error) {
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    res.statusCode = 500;
    res.end(JSON.stringify({ message: error.message || 'Erro interno.' }));
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || `localhost:${port}`}`);
  const pathname = url.pathname;

  if (pathname === '/') {
    redirect(res, '/divinoburguer/www.hexadivinosdelivery.site/index.html');
    return;
  }

  if (pathname === '/cart' || pathname === '/cart/') {
    redirect(res, '/divinoburguer/www.hexadivinosdelivery.site/cart.html');
    return;
  }

  if (apiRoutes.has(pathname)) {
    runApi(req, res, apiRoutes.get(pathname));
    return;
  }

  if (fileRoutes.has(pathname)) {
    sendFile(res, fileRoutes.get(pathname));
    return;
  }

  sendFile(res, staticPath(pathname));
});

server.listen(port, () => {
  console.log(`Local server ready: http://localhost:${port}`);
});
