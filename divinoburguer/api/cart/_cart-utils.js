const fs = require('fs');
const path = require('path');
const { readJson, supabaseRequest } = require('../_utils');

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

  const productsDir = [
    path.join(process.cwd(), 'www.hexadivinosdelivery.site', 'products'),
    path.join(process.cwd(), 'divinoburguer', 'www.hexadivinosdelivery.site', 'products')
  ].find((candidate) => fs.existsSync(candidate));
  const products = new Map();

  if (!productsDir) {
    catalogCache = products;
    return products;
  }

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
        image: normalizeImage(product.featured_image || product.images?.[0] || '', productsDir)
      });
    } catch {
      continue;
    }
  }

  catalogCache = products;
  return products;
}

function normalizeImage(image, productsDir) {
  if (!image) return null;
  const fileName = String(image).split('?')[0].split('/').pop();
  const assetsDir = path.join(path.dirname(productsDir), 'cdn', 'shop', 'files');

  if (fileName && fs.existsSync(assetsDir)) {
    const baseName = path.parse(fileName).name;
    const localMatch = fs.readdirSync(assetsDir).find((candidate) => {
      return path.parse(candidate).name.startsWith(baseName);
    });
    if (localMatch) return `/cdn/shop/files/${encodeURIComponent(localMatch)}`;
  }

  if (image.startsWith('//')) return `https:${image}`;
  return image;
}

async function getPriceOverrides() {
  try {
    const rows = await supabaseRequest(
      'product_price_overrides?select=variant_id,title,price_cents,promotional_price_cents',
      { method: 'GET' }
    );
    return new Map((Array.isArray(rows) ? rows : []).map((row) => [
      String(row.variant_id),
      {
        price: Number(row.price_cents),
        title: String(row.title || '').trim(),
        promotionalPrice: row.promotional_price_cents === null || row.promotional_price_cents === undefined
          ? null
          : Number(row.promotional_price_cents)
      }
    ]));
  } catch {
    return new Map();
  }
}

function applyPriceOverrides(catalog, overrides) {
  return Array.from(catalog.values()).map((product) => {
    const override = overrides.get(String(product.id));
    if (Number.isInteger(override?.price) && override.price >= 0) {
      const promotionalPrice = Number.isInteger(override.promotionalPrice)
        && override.promotionalPrice >= 0
        && override.promotionalPrice < override.price
        ? override.promotionalPrice
        : null;
      return {
        ...product,
        title: override.title || product.title,
        product_title: override.title || product.product_title,
        regular_price: override.price,
        compare_at_price: promotionalPrice ? override.price : null,
        promotional_price: promotionalPrice,
        price: promotionalPrice ?? override.price,
        final_price: promotionalPrice ?? override.price
      };
    }
    return product;
  });
}

async function catalogProducts() {
  return applyPriceOverrides(getCatalog(), await getPriceOverrides());
}

async function cartResponse(items) {
  const catalog = getCatalog();
  const overrides = await getPriceOverrides();
  const lines = items
    .map((item) => {
      const sourceProduct = catalog.get(String(item.id));
      const override = overrides.get(String(item.id));
      const promotionalPrice = Number.isInteger(override?.promotionalPrice)
        && override.promotionalPrice >= 0
        && override.promotionalPrice < override.price
        ? override.promotionalPrice
        : null;
      const product = sourceProduct && Number.isInteger(override?.price) && override.price >= 0
        ? {
            ...sourceProduct,
            title: override.title || sourceProduct.title,
            product_title: override.title || sourceProduct.product_title,
            regular_price: override.price,
            compare_at_price: promotionalPrice ? override.price : null,
            promotional_price: promotionalPrice,
            price: promotionalPrice ?? override.price,
            final_price: promotionalPrice ?? override.price
          }
        : sourceProduct;
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

function resolveVariantId(id, productId) {
  if (id) {
    return String(id);
  }

  if (!productId) {
    return '';
  }

  const product = Array.from(getCatalog().values())
    .find((item) => String(item.product_id) === String(productId));

  return product ? String(product.id) : '';
}

async function readFormOrJson(req) {
  const body = await readJson(req);
  return body || {};
}

module.exports = {
  catalogProducts,
  cartResponse,
  clearCartCookie,
  readCartCookie,
  readFormOrJson,
  resolveVariantId,
  writeCartCookie
};
