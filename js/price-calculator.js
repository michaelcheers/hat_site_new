/* ==============================================
   PRICE-CALCULATOR.JS — Pricing Engine with Bulk Tiers
   ============================================== */

const PriceCalculator = (function() {
  let pricingData = null;

  async function loadPricing() {
    if (pricingData) return pricingData;
    const basePath = window.location.pathname.includes('/pages/') ? '../data/pricing.json' : 'data/pricing.json';
    const res = await fetch(basePath);
    pricingData = await res.json();
    return pricingData;
  }

  function getTierLabel(quantity) {
    if (!pricingData) return '1-11';
    const tier = pricingData.tiers.find(t => quantity >= t.min && quantity <= t.max);
    return tier ? tier.label : '250+';
  }

  function getBasePrice(decorationType, quantity) {
    if (!pricingData) return 24.99;
    const tierLabel = getTierLabel(quantity);
    const typeKey = decorationType || 'embroidery';
    const priceTable = pricingData[typeKey];
    if (!priceTable) return 24.99;
    return priceTable[tierLabel] || 24.99;
  }

  function calculateExtras(options) {
    if (!pricingData || !options) return 0;
    let total = 0;
    const extras = pricingData.extras;
    if (options.puff3d) total += extras['3d_puff'] || 0;
    if (options.backEmbroidery) total += extras['back_embroidery'] || 0;
    if (options.sideEmbroidery) total += extras['side_embroidery'] || 0;
    if (options.insideLabel) total += extras['inside_label'] || 0;
    return total;
  }

  function calculateTotal(decorationType, quantity, extras) {
    const base = getBasePrice(decorationType, quantity);
    const extrasTotal = calculateExtras(extras);
    const unitPrice = base + extrasTotal;
    const lineTotal = unitPrice * quantity;
    return {
      unitPrice: Math.round(unitPrice * 100) / 100,
      lineTotal: Math.round(lineTotal * 100) / 100,
      basePrice: base,
      extrasTotal: extrasTotal,
      tierLabel: getTierLabel(quantity),
      quantity
    };
  }

  function getPricingTable(decorationType) {
    if (!pricingData) return [];
    const typeKey = decorationType || 'embroidery';
    const priceTable = pricingData[typeKey];
    if (!priceTable) return [];
    return Object.entries(priceTable).map(([tier, price]) => ({ tier, price }));
  }

  return {
    loadPricing,
    getBasePrice,
    calculateExtras,
    calculateTotal,
    getTierLabel,
    getPricingTable
  };
})();
