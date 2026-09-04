const { readJson, sendJson, supabaseRequest } = require('../_utils');
const { requireAdmin } = require('../_admin-auth');
const { catalogProducts } = require('../cart/_cart-utils');

function priceInCents(value) {
  const normalized = String(value ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}

module.exports = async function handler(req, res) {
  try {
    if (!['GET', 'PATCH', 'DELETE'].includes(req.method)) {
      return sendJson(res, 405, { message: 'Metodo nao permitido.' });
    }

    const user = await requireAdmin(req, res);
    if (!user) return;

    if (req.method === 'GET') {
      const products = await catalogProducts();
      return sendJson(res, 200, { products });
    }

    const body = await readJson(req);
    const variantId = String(body.variantId || body.variant_id || '').trim();
    const sourceProduct = (await catalogProducts()).find((product) => String(product.id) === variantId);
    if (!sourceProduct) {
      return sendJson(res, 404, { message: 'Produto nao encontrado.' });
    }

    if (req.method === 'DELETE') {
      await supabaseRequest(`product_price_overrides?variant_id=eq.${encodeURIComponent(variantId)}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' }
      });
      return sendJson(res, 200, { ok: true });
    }

    const cents = priceInCents(body.price);
    if (cents === null) {
      return sendJson(res, 400, { message: 'Informe um preco valido, com no maximo duas casas decimais.' });
    }
    const promotionValue = String(body.promotionalPrice ?? body.promotional_price ?? '').trim();
    const promotionalCents = promotionValue ? priceInCents(promotionValue) : null;
    if (promotionValue && promotionalCents === null) {
      return sendJson(res, 400, { message: 'Informe um preco promocional valido, com no maximo duas casas decimais.' });
    }
    if (promotionalCents !== null && promotionalCents >= cents) {
      return sendJson(res, 400, { message: 'O preco promocional precisa ser menor que o preco normal.' });
    }

    const rows = await supabaseRequest('product_price_overrides?on_conflict=variant_id', {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify({
        variant_id: Number(variantId),
        product_id: sourceProduct.product_id,
        title: sourceProduct.title,
        price_cents: cents,
        promotional_price_cents: promotionalCents,
        updated_at: new Date().toISOString()
      })
    });

    return sendJson(res, 200, { product: Array.isArray(rows) ? rows[0] : rows });
  } catch (error) {
    return sendJson(res, 500, { message: error.message || 'Erro ao atualizar o preco.' });
  }
};
