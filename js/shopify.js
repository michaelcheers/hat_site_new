/* ==============================================
   SHOPIFY.JS — Storefront API checkout (redirect flow)
   Resolves each cart line to a Shopify variant GID, creates
   a cart via the Storefront GraphQL API, then redirects the
   customer to Shopify's hosted, PCI-compliant checkout.
   Decoration choices ride along as per-line attributes so the
   production team sees the customization in the Shopify order.
   ============================================== */

const Shopify = (function() {

  function cfg() {
    return window.SHOPIFY_CONFIG || {};
  }

  function isConfigured() {
    const c = cfg();
    return c.domain && c.storefrontToken &&
      c.domain !== 'your-store.myshopify.com' &&
      c.storefrontToken !== 'STOREFRONT_PUBLIC_TOKEN';
  }

  function endpoint() {
    const c = cfg();
    return `https://${c.domain}/api/${c.apiVersion || '2024-07'}/graphql.json`;
  }

  async function gql(query, variables) {
    const c = cfg();
    const res = await fetch(endpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': c.storefrontToken
      },
      body: JSON.stringify({ query, variables })
    });
    if (!res.ok) throw new Error(`Storefront API HTTP ${res.status}`);
    const json = await res.json();
    if (json.errors && json.errors.length) {
      throw new Error(json.errors.map(e => e.message).join('; '));
    }
    return json.data;
  }

  const PRODUCT_VARIANTS_QUERY = `
    query($handle: String!) {
      product(handle: $handle) {
        variants(first: 100) {
          nodes { id sku title selectedOptions { name value } }
        }
      }
    }`;

  const CART_CREATE_MUTATION = `
    mutation($lines: [CartLineInput!]!) {
      cartCreate(input: { lines: $lines }) {
        cart { checkoutUrl }
        userErrors { field message }
      }
    }`;

  function normalize(str) {
    return (str || '').toLowerCase().replace(/\s+/g, '').replace(/[\/]+/g, '/');
  }

  // Resolve a single cart line to a Shopify variant GID.
  // Match primarily by SKU (exact CSV SKU on the line), fall back
  // to the selected color option value.
  async function resolveVariantId(line) {
    const handle = line.productHandle || line.productId;
    if (!handle) throw new Error('Cart line is missing a product handle.');
    const data = await gql(PRODUCT_VARIANTS_QUERY, { handle });
    const nodes = (data.product && data.product.variants && data.product.variants.nodes) || [];
    if (!nodes.length) throw new Error(`No variants found for "${handle}".`);

    if (line.sku) {
      const bySku = nodes.find(v => v.sku && v.sku === line.sku);
      if (bySku) return bySku.id;
    }
    if (line.color) {
      const target = normalize(line.color);
      const byColor = nodes.find(v =>
        (v.selectedOptions || []).some(o => o.name.toLowerCase() === 'color' && normalize(o.value) === target)
      );
      if (byColor) return byColor.id;
      const byTitle = nodes.find(v => normalize(v.title) === target);
      if (byTitle) return byTitle.id;
    }
    throw new Error(`Could not match a variant for "${handle}" (${line.color || line.sku || 'unknown'}).`);
  }

  function lineAttributes(line) {
    const attrs = [];
    if (line.decorationType) {
      attrs.push({ key: 'Decoration', value: String(line.decorationType).replace(/_/g, ' ') });
    }
    if (line.decorationDetails && line.decorationDetails.location) {
      attrs.push({ key: 'Placement', value: String(line.decorationDetails.location).replace(/_/g, ' ') });
    }
    if (line.artworkFile) {
      attrs.push({ key: 'Artwork', value: line.artworkFile });
    }
    if (line.instructions) {
      attrs.push({ key: 'Instructions', value: line.instructions.slice(0, 500) });
    }
    return attrs;
  }

  async function beginCheckout(cart) {
    if (!Array.isArray(cart) || cart.length === 0) {
      if (typeof showToast === 'function') showToast('Your cart is empty.', 'error');
      return;
    }
    if (!isConfigured()) {
      if (typeof showToast === 'function') {
        showToast('Shopify store is not configured yet. Set domain + Storefront token in js/shopify-config.js.', 'error', 5000);
      }
      return;
    }

    const btn = document.querySelector('.cart-summary .btn--primary');
    const originalLabel = btn ? btn.textContent : null;
    if (btn) { btn.disabled = true; btn.textContent = 'Redirecting to secure checkout…'; }

    try {
      const lines = [];
      for (const item of cart) {
        const merchandiseId = await resolveVariantId(item);
        lines.push({
          merchandiseId,
          quantity: item.quantity || 1,
          attributes: lineAttributes(item)
        });
      }

      const data = await gql(CART_CREATE_MUTATION, { lines });
      const result = data.cartCreate;
      if (result.userErrors && result.userErrors.length) {
        throw new Error(result.userErrors.map(e => e.message).join('; '));
      }
      const url = result.cart && result.cart.checkoutUrl;
      if (!url) throw new Error('Shopify did not return a checkout URL.');
      window.location.href = url;
    } catch (err) {
      console.error('Shopify checkout failed:', err);
      if (typeof showToast === 'function') {
        showToast('Checkout failed: ' + err.message, 'error', 5000);
      }
      if (btn) { btn.disabled = false; if (originalLabel) btn.textContent = originalLabel; }
    }
  }

  return { beginCheckout, resolveVariantId, isConfigured };
})();
