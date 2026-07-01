const fs = require('fs');
const path = require('path');
const { readJson } = require('../_utils');

const COOKIE_NAME = 'divino_cart';
let catalogCache = null;

function decodeCookieValue(value) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readCartCookie(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${COOKIE_NAME}=`));

  return decodeCookieValue(match ? match.slice(COOKIE_NAME.length + 1) : '');
}

function writeCartCookie(res, items) {
  const value = encodeURIComponent(JSON.stringify(items));
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${value}; Path=/; SameSite=Lax; Max-Age=2592000`);
}

function clearCartCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; SameSite=Lax; Max-Age=0`);
}

function getCatalog() {
  if (catalogCache) {
    return catalogCache;
  }

  const productsDir = path.join(process.cwd(), 'www.hexadivinosdelivery.site', 'products');
  const products = new Map();

  for (const file of fs.readdirSync(productsDir)) {
    if (!file.endsWith('.js')) continue;

    const fullPath = path.join(productsDir, file);
    try {
      const product = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      const variant = Array.isArray(product.variants) ? product.variants[0] : null;
      if (!variant || !variant.id) continue;

      products.set(String(variant.id), {
        id: Number(variant.id),
        product_id: Number(product.id),
        title: product.title || variant.name || 'Produto',
        product_title: product.title || variant.name || 'Produto',
        handle: product.handle || '',
        price: Number(variant.price || product.price || 0),
        final_price: Number(variant.price || product.price || 0),
        image: normalizeImage(product.featured_image || product.images?.[0] || '')
      });
    } catch {
      continue;
    }
  }

  catalogCache = products;
  return products;
}

function normalizeImage(image) {
  if (!image) return null;
  if (image.startsWith('//')) return `https:${image}`;
  return image;
}

function cartResponse(items) {
  const catalog = getCatalog();
  const lines = items
    .map((item) => {
      const product = catalog.get(String(item.id));
      if (!product) return null;

      const quantity = Math.max(1, Number(item.quantity || 1));
      const linePrice = product.final_price * quantity;

      return {
        ...product,
        key: `${product.id}:default`,
        variant_id: product.id,
        quantity,
        line_price: linePrice,
        final_line_price: linePrice,
        url: product.handle ? `/products/${product.handle}` : null
      };
    })
    .filter(Boolean);

  const total = lines.reduce((sum, item) => sum + item.line_price, 0);

  return {
    token: 'divino-local-cart',
    item_count: lines.reduce((sum, item) => sum + item.quantity, 0),
    items: lines,
    total_price: total,
    items_subtotal_price: total,
    currency: 'BRL'
  };
}

async function readFormOrJson(req) {
  const body = await readJson(req);
  return body || {};
}

module.exports = {
  cartResponse,
  clearCartCookie,
  readCartCookie,
  readFormOrJson,
  writeCartCookie
};
