#!/usr/bin/env node
/* ==============================================
   BUILD-PRODUCTS.JS — CSV -> data/products.json
   Build-time only. Parses the Shopify product-import CSV
   (incoming_files/shopify_hats_import.csv) and emits the
   site's product catalog with per-color multi-angle image
   galleries. Run: node tools/build-products.js
   ============================================== */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CSV_PATH = path.join(ROOT, 'incoming_files', 'shopify_hats_import.csv');
const OUT_PATH = path.join(ROOT, 'data', 'products.json');
const ASSETS_DIR = path.join(ROOT, 'assets', 'products');   // downloaded product images live here

const FLAT_PRICE = 16.00;
const FEATURED_COUNT = 4;                          // first N products flagged featured
const BEST_SELLERS = ['richardson-115', 'yupoong-6606'];

// ---- Quote-aware CSV reader ----
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function stripHtml(html) {
  return (html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

// ---- Color name -> swatch hex ----
// Comprehensive map covering the CSV's color vocabulary. We resolve by the
// first token of the (possibly compound) color name, then fall back to a
// keyword family scan, then to neutral grey.
const COLOR_MAP = {
  'black': '#1c1c1c', 'white': '#ffffff', 'navy': '#1b3a5c', 'dark navy': '#16293f',
  'midnight navy': '#16263a', 'heather navy': '#3a4f66', 'red': '#cc2936',
  'dusty red': '#a85460', 'heather red': '#c0535f', 'nantucket red': '#c4575b',
  'dark red': '#8c1f29', 'cardinal': '#9b2335', 'scarlet': '#c52f33', 'cranberry': '#9c2542',
  'burgundy': '#6b1f2e', 'maroon': '#6b1c2a', 'royal': '#2659a8', 'royal blue': '#2659a8',
  'heather royal': '#4a6db0', 'blue': '#2e6db4', 'dark blue': '#1f3f78', 'light blue': '#9cc3e6',
  'powder blue': '#b0cde0', 'columbia blue': '#9bbfd4', 'carolina blue': '#7fa9d4',
  'sky blue': '#87b8e0', 'aqua': '#4cc4c4', 'cyan': '#3cc3d4', 'turquoise': '#3bb6a8',
  'aruba blue': '#3a9ec4', 'pacific blue': '#2d7fa6', 'lake blue': '#3f7fae', 'breaker blue': '#3a86b0',
  'dusty blue': '#7d99b3', 'slate blue': '#5f7791', 'steel blue': '#5b7a96', 'smoke blue': '#6d8fa7',
  'blue steel': '#5b7488', 'poseidon black': '#1e2b33',
  'charcoal': '#444a4f', 'melange charcoal': '#55595d', 'quarry grey': '#8b8d8c',
  'shark grey': '#6f7479', 'dark grey': '#3f4347', 'grey': '#8a8d90', 'gray': '#8a8d90',
  'silver': '#c7c9cb', 'melange silver': '#c2c4c6', 'heather grey': '#b3b6b9',
  'dark heather grey': '#6b6f73', 'heather': '#b9bcc0', 'stone': '#b5a997', 'putty': '#c7bba5',
  'sand dune': '#cbb994', 'tan': '#c9a96e', 'khaki': '#c3b091', 'pale khaki': '#cabd9c',
  'biscuit': '#d8c6a3', 'cream': '#f3ead6', 'birch': '#ddcfb4', 'natural': '#f0e4c8',
  'brown': '#6b3e26', 'buckthorn brown': '#7a4f2a', 'coyote brown': '#81633f', 'dark mocha': '#4b3528',
  'chocolate chip': '#5a4636', 'caramel': '#a9743b', 'carmel': '#a9743b', 'sienna': '#8a4b2d',
  'rustic orange': '#bf5a2a', 'orange': '#e2702a', 'dark orange': '#cc5a1c', 'mustard': '#d4a02a',
  'lemon': '#e8d44a', 'pale banana': '#eee0a0', 'sunkissed peach': '#f2c39a', 'pale peach': '#f4cdb0',
  'green': '#2f7d44', 'dark green': '#1a5c2e', 'kelly': '#2f9e44', 'moss': '#6b7d3a',
  'moss green': '#6b7d3a', 'olive': '#6b6b3a', 'olive green': '#5f6b34', 'loden': '#4e5b3a',
  'dark loden': '#3c4630', 'loden green': '#4e5b3a', 'spruce': '#2c4a3a', 'spruce green': '#2c4a3a',
  'evergreen': '#214a36', 'sage': '#9caa85', 'sawgrass': '#8a9a5b', 'patina green': '#6b9a7d',
  'pepper green': '#3f5c3a', 'heather dark green': '#3a5c44', 'pink': '#e58fb0', 'hot pink': '#e84d8a',
  'light pink': '#f4c2c2', 'dusty rose': '#c98a96', 'lilac': '#b79fd4', 'purple': '#6b3fa0',
  'biscuit ': '#d8c6a3'
};

// camo / pattern families get an earthy neutral
const PATTERN_KEYWORDS = ['camo', 'realtree', 'mossy oak', 'kryptek', 'multicam', 'veil', 'duck', 'digital', 'habitat', 'highlander'];
const FAMILY = [
  ['black', '#1c1c1c'], ['white', '#ffffff'], ['navy', '#1b3a5c'], ['blue', '#2e6db4'],
  ['red', '#cc2936'], ['green', '#2f7d44'], ['grey', '#8a8d90'], ['gray', '#8a8d90'],
  ['charcoal', '#444a4f'], ['brown', '#6b3e26'], ['tan', '#c9a96e'], ['khaki', '#c3b091'],
  ['orange', '#e2702a'], ['pink', '#e58fb0'], ['purple', '#6b3fa0'], ['olive', '#6b6b3a'],
  ['stone', '#b5a997'], ['sand', '#cbb994'], ['cream', '#f3ead6'], ['silver', '#c7c9cb'],
  ['maroon', '#6b1c2a'], ['burgundy', '#6b1f2e'], ['yellow', '#e8d44a'], ['gold', '#d4a02a']
];

function swatchHex(colorName) {
  const lower = colorName.toLowerCase();
  const first = lower.split('/')[0].trim();
  if (COLOR_MAP[first]) return COLOR_MAP[first];
  if (COLOR_MAP[lower]) return COLOR_MAP[lower];
  for (const kw of PATTERN_KEYWORDS) {
    if (lower.includes(kw)) return '#6f6048';
  }
  for (const [kw, hex] of FAMILY) {
    if (first.includes(kw) || lower.includes(kw)) return hex;
  }
  return '#9a9a9a';
}

// ---- Derivation rules for collection filters ----
function hay(tags, title) { return (tags.join(' ') + ' ' + title).toLowerCase(); }

function deriveCategory(tags, title) {
  const h = hay(tags, title);
  if (h.includes('trucker')) return 'trucker';
  if (h.includes('snapback')) return 'snapback';
  if (h.includes('dad')) return 'dad-hat';
  if (h.includes('fitted') || h.includes('flexfit')) return 'fitted';
  return 'cap';
}
function deriveProfile(tags, title) {
  const h = hay(tags, title);
  if (h.includes('low pro') || h.includes('low-pro') || h.includes('low')) return 'low';
  if (h.includes('high')) return 'high';
  return 'mid';
}
function deriveClosure(tags, title) {
  const h = hay(tags, title);
  if (h.includes('snapback')) return 'snapback';
  if (h.includes('strap')) return 'strapback';
  if (h.includes('buckle')) return 'buckle';
  if (h.includes('flexfit') || h.includes('stretch')) return 'fitted';
  if (h.includes('adjustable')) return 'adjustable';
  return 'snapback';
}

function normUrl(u) {
  u = (u || '').trim();
  if (!u) return '';
  if (u.startsWith('//')) return 'https:' + u;
  return u;
}

// ---- CDN URL -> local asset path ----
// Maps an SSActivewear CDN image URL to a root-relative local path under
// assets/products/, preserving the Color/ vs Style/ namespace to avoid id
// collisions. Returns null for anything that isn't a recognised CDN image.
function cdnToLocal(url) {
  if (!url) return null;
  const m = url.match(/cdn\.ssactivewear\.com\/Images\/(Color|Style)\/([^/?#]+)$/i);
  if (!m) return null;
  const sub = m[1].toLowerCase();        // 'color' | 'style'
  const file = m[2];
  return {
    url,
    web: `/assets/products/${sub}/${file}`,            // referenced by the site
    disk: path.join(ASSETS_DIR, sub, file)             // written to disk
  };
}

// ---- Download with bounded concurrency ----
async function downloadAll(urls, concurrency = 16) {
  const items = [];
  for (const url of urls) {
    const map = cdnToLocal(url);
    if (map) items.push(map);
  }
  const ok = new Map();     // url -> web path (successful)
  const failed = new Set(); // urls that 404'd / errored
  let done = 0;
  const total = items.length;

  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const it = items[cursor++];
      try {
        // Skip if already on disk and non-empty (idempotent re-runs).
        let need = true;
        try { if (fs.statSync(it.disk).size > 0) need = false; } catch (_) {}
        if (need) {
          fs.mkdirSync(path.dirname(it.disk), { recursive: true });
          const res = await fetch(it.url);
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const buf = Buffer.from(await res.arrayBuffer());
          if (!buf.length) throw new Error('empty');
          fs.writeFileSync(it.disk, buf);
        }
        ok.set(it.url, it.web);
      } catch (e) {
        failed.add(it.url);
      }
      done++;
      if (done % 100 === 0 || done === total) {
        process.stdout.write(`\r  downloaded ${done}/${total} (failed ${failed.size})   `);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  process.stdout.write('\n');
  return { ok, failed };
}

// Collect every CDN image URL referenced by the built product list.
function collectImageUrls(products) {
  const set = new Set();
  for (const p of products) {
    if (p.defaultImage) set.add(p.defaultImage);
    for (const u of (p.lifestyleImages || [])) set.add(u);
    for (const c of p.colors) {
      for (const k of ['front', 'detail', 'back']) {
        if (c.images[k]) set.add(c.images[k]);
      }
    }
  }
  return set;
}

// Rewrite all CDN URLs in the product list to their downloaded local paths.
// URLs that failed to download are dropped (set to '') so the gallery degrades
// gracefully — front images all exist; only some derived detail/back may 404.
function rewriteToLocal(products, ok) {
  const map = (u) => (u && ok.has(u) ? ok.get(u) : '');
  for (const p of products) {
    p.defaultImage = map(p.defaultImage);
    p.lifestyleImages = (p.lifestyleImages || []).map(map).filter(Boolean);
    for (const c of p.colors) {
      c.images.front = map(c.images.front);
      c.images.detail = map(c.images.detail);
      c.images.back = map(c.images.back);
    }
    // Ensure a usable defaultImage even if the first color's front 404'd.
    if (!p.defaultImage) {
      const fallback = p.colors.find(c => c.images.front);
      p.defaultImage = fallback ? fallback.images.front : '';
    }
  }
}

// Extract color name + angle from an Image Alt Text like
// "Richardson 115 — Low Pro Trucker Cap — White (front)".
function parseAlt(alt) {
  if (!alt) return null;
  const m = alt.match(/\(([^)]+)\)\s*$/);
  let angle = m ? m[1].trim().toLowerCase() : null;
  // color = text after the last em-dash separator, with the (angle) stripped
  let base = alt.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const parts = base.split(' — ');
  const color = parts.length ? parts[parts.length - 1].trim() : null;
  return { color, angle };
}

async function main() {
  const text = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(text);
  const header = rows[0];
  const idx = {};
  header.forEach((h, i) => { idx[h] = i; });
  const get = (row, name) => (row[idx[name]] || '').trim();

  const order = [];
  const byHandle = {};

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row.length || row.every(c => c === '')) continue;
    const handle = get(row, 'Handle');
    if (!handle) continue;
    if (!byHandle[handle]) {
      byHandle[handle] = { rows: [] };
      order.push(handle);
    }
    byHandle[handle].rows.push(row);
  }

  const products = order.map((handle, productIndex) => {
    const group = byHandle[handle].rows;
    const titledRow = group.find(row => get(row, 'Title')) || group[0];

    const title = get(titledRow, 'Title');
    const brand = get(titledRow, 'Vendor');
    const type = get(titledRow, 'Type') || 'Hat';
    const tagsRaw = get(titledRow, 'Tags');
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
    const description = stripHtml(get(titledRow, 'Body (HTML)'));

    // model = title with brand prefix stripped
    let model = title;
    if (brand && model.toLowerCase().startsWith(brand.toLowerCase())) {
      model = model.slice(brand.length).trim();
    }
    // also strip leading vendor synonyms like "YP Classics (Yupoong)"
    model = model.replace(/^[—–-]\s*/, '').trim();

    // ---- Colors (variant rows) ----
    const colorsByName = {};
    const colorOrder = [];
    for (const row of group) {
      const cname = get(row, 'Option1 Value');
      const sku = get(row, 'Variant SKU');
      if (cname && sku) {
        if (!colorsByName[cname]) {
          colorsByName[cname] = {
            name: cname,
            sku: sku,
            swatchHex: swatchHex(cname),
            images: { front: '', detail: '', back: '' }
          };
          colorOrder.push(cname);
        }
        const front = normUrl(get(row, 'Variant Image') || get(row, 'Image Src'));
        if (front && !colorsByName[cname].images.front) colorsByName[cname].images.front = front;
      }
    }

    // ---- Angle images + lifestyle (walk all image rows) ----
    const lifestyleImages = [];
    for (const row of group) {
      const src = normUrl(get(row, 'Image Src'));
      if (!src) continue;
      const alt = get(row, 'Image Alt Text');
      const isLifestyle = /lifestyle/i.test(alt) || /\/Images\/Style\//i.test(src);
      if (isLifestyle) {
        if (!lifestyleImages.includes(src)) lifestyleImages.push(src);
        continue;
      }
      const parsed = parseAlt(alt);
      if (!parsed || !parsed.color) continue;
      const color = colorsByName[parsed.color];
      if (!color) continue;
      const angle = parsed.angle;
      if (angle === 'front' && !color.images.front) color.images.front = src;
      else if (angle === 'detail' && !color.images.detail) color.images.detail = src;
      else if (angle === 'back' && !color.images.back) color.images.back = src;
    }

    // Fallback: derive detail/back from front URL pattern (_f_fl -> _d_fl/_b_fl)
    for (const cname of colorOrder) {
      const c = colorsByName[cname];
      if (c.images.front) {
        if (!c.images.detail) c.images.detail = c.images.front.replace('_f_fl', '_d_fl');
        if (!c.images.back) c.images.back = c.images.front.replace('_f_fl', '_b_fl');
      }
    }

    const colors = colorOrder.map(n => colorsByName[n]);
    const defaultImage = colors.length ? colors[0].images.front : '';

    const category = deriveCategory(tags, title);
    const profile = deriveProfile(tags, title);
    const closure = deriveClosure(tags, title);

    return {
      id: handle,
      handle,
      title,
      brand,
      model,
      description,
      type,
      tags,
      price: FLAT_PRICE,
      category,
      profile,
      closure,
      featured: productIndex < FEATURED_COUNT,
      bestSeller: BEST_SELLERS.includes(handle),
      defaultImage,
      lifestyleImages,
      colors
    };
  });

  // ---- Download images locally and rewrite URLs to local paths ----
  const urls = collectImageUrls(products);
  console.log(`Downloading ${urls.size} unique images into ${path.relative(ROOT, ASSETS_DIR)}/ ...`);
  const { ok, failed } = await downloadAll(urls);
  rewriteToLocal(products, ok);

  fs.writeFileSync(OUT_PATH, JSON.stringify(products, null, 2) + '\n');

  // ---- Report ----
  console.log(`Wrote ${products.length} products -> ${path.relative(ROOT, OUT_PATH)}`);
  let totalColors = 0, withAllAngles = 0, missingFront = 0;
  for (const p of products) {
    totalColors += p.colors.length;
    for (const c of p.colors) {
      if (!c.images.front) missingFront++;
      if (c.images.front && c.images.detail && c.images.back) withAllAngles++;
    }
    console.log(`  ${p.id}: ${p.colors.length} colors, ${p.lifestyleImages.length} lifestyle, cat=${p.category}/${p.profile}/${p.closure}`);
  }
  console.log(`Total colors: ${totalColors}, with front+detail+back: ${withAllAngles}, missing front: ${missingFront}`);
  console.log(`Images downloaded OK: ${ok.size}, failed: ${failed.size}`);
}

main();
