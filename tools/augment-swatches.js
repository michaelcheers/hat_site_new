#!/usr/bin/env node
/* ==============================================
   AUGMENT-SWATCHES.JS — add two-tone swatch hexes
   Re-derives swatchHex/swatchHex2 for every color in the
   already-built data/products.json (no image download), so
   two-color names ("Hot Pink / Black") render both colors.
   Run: node tools/augment-swatches.js
   ============================================== */

const fs = require('fs');
const path = require('path');
const { swatchHex, swatchHex2 } = require('./build-products.js');

const OUT = path.resolve(__dirname, '..', 'data', 'products.json');
const products = JSON.parse(fs.readFileSync(OUT, 'utf8'));

let dual = 0, total = 0;
for (const p of products) {
  for (const c of p.colors) {
    total++;
    c.swatchHex = swatchHex(c.name);
    const h2 = swatchHex2(c.name);
    if (h2) { c.swatchHex2 = h2; dual++; }
    else { delete c.swatchHex2; }
  }
}

fs.writeFileSync(OUT, JSON.stringify(products, null, 2) + '\n');
console.log(`Updated ${products.length} products, ${total} colors; ${dual} two-tone swatches.`);
