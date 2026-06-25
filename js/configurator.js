/* ==============================================
   CONFIGURATOR.JS — 10-Step Hat Configurator
   When launched from a product page (?id=xxx&configure=1),
   skips brand/model steps and starts at color selection.
   Updates 3D preview live as user makes choices.
   ============================================== */

const Configurator = (function() {
  // Full step list — steps are filtered based on context
  const ALL_STEPS = [
    { id: 'brand',       title: 'Select Hat Brand',      subtitle: 'Choose from our premium hat brands.' },
    { id: 'model',       title: 'Select Hat Model',      subtitle: 'Pick the hat style that fits your needs.' },
    { id: 'color',       title: 'Select Hat Color',       subtitle: 'Choose from available color options.' },
    { id: 'decoration',  title: 'Decoration Type',        subtitle: 'How would you like your hat decorated?' },
    { id: 'details',     title: 'Decoration Details',     subtitle: 'Configure your decoration options.' },
    { id: 'artwork',     title: 'Upload Artwork',         subtitle: 'Upload your logo or design file.' },
    { id: 'instructions',title: 'Special Instructions',   subtitle: 'Any notes for our production team?' },
    { id: 'quantity',    title: 'Quantity & Pricing',     subtitle: 'Select quantity to see volume pricing.' },
    { id: 'review',      title: 'Review Your Order',      subtitle: 'Double-check everything before adding to cart.' },
    { id: 'complete',    title: 'Added to Cart!',         subtitle: 'Your custom hat has been added.' },
  ];

  // Brand cards are derived from the loaded products so they never desync
  // from the catalog. Icons fall back to a generic glyph for any vendor.
  const BRAND_ICONS = {
    'richardson': '&#127913;', 'yupoong': '&#9889;', 'flexfit': '&#128170;',
    'legacy': '&#127942;', 'imperial': '&#128081;'
  };
  let BRANDS = [];

  function buildBrands(products) {
    const seen = new Map();
    products.forEach(p => {
      const id = p.brand.toLowerCase();
      if (!seen.has(id)) {
        seen.set(id, { id, name: p.brand, icon: BRAND_ICONS[id] || '&#127913;', desc: `${p.brand} headwear`, count: 0 });
      }
      seen.get(id).count++;
    });
    BRANDS = Array.from(seen.values()).map(b => ({ ...b, desc: `${b.count} model${b.count !== 1 ? 's' : ''} available` }));
  }

  let steps = [];        // The active steps for this session
  let currentStepIdx = 0;
  let allProducts = [];
  let hasPreselectedProduct = false;
  let config = {
    brand: null, model: null, product: null, color: null, colorObj: null,
    decorationType: null,
    decorationDetails: { location: 'front', puff3d: false, backEmbroidery: false, sideEmbroidery: false, patchType: 'leather', patchShape: 'rectangle' },
    artworkFile: null, artworkDataUrl: null, instructions: '', quantity: 24,
  };

  // Swatch hex comes baked into each color object from the build script.
  function swatchFor(colorObj) {
    return (colorObj && colorObj.swatchHex) ? colorObj.swatchHex : '#9a9a9a';
  }

  // Update the configure-mode image gallery to the chosen color's photos.
  function updateGallery() {
    if (typeof window._configUpdateGallery === 'function') {
      window._configUpdateGallery(config.colorObj || (config.product && config.product.colors[0]));
    }
  }

  function syncPreview() {
    updateGallery();
  }

  function updateHatInfoCard() {
    const el = document.getElementById('config-hat-info');
    if (!el || !config.product) return;
    el.innerHTML = `
      <div class="configure-preview__hat-name">${config.product.brand} ${config.product.model}</div>
      <div class="configure-preview__hat-meta">
        ${config.product.category.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
        &middot; ${config.product.profile} profile
        &middot; <span style="color:var(--color-accent)">${config.color || (config.product.colors[0] && config.product.colors[0].name)}</span>
        ${config.decorationType ? ' &middot; ' + config.decorationType.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) : ''}
      </div>
    `;
  }

  async function init() {
    const root = document.getElementById('configurator-root');
    if (!root) return;

    await PriceCalculator.loadPricing();

    const basePath = window.location.pathname.includes('/pages/') ? '../data/products.json' : 'data/products.json';
    allProducts = await (await fetch(basePath)).json();
    buildBrands(allProducts);

    // Check if product page passed us a pre-selected product
    const preProduct = window._configProduct;
    const params = new URLSearchParams(window.location.search);
    const preselectedId = params.get('id');

    if (preProduct || preselectedId) {
      const p = preProduct || allProducts.find(x => x.id === preselectedId);
      if (p) {
        hasPreselectedProduct = true;
        config.brand = p.brand.toLowerCase();
        config.model = p.id;
        config.product = p;
        // Honor a color pre-selected on the product detail page (?color=idx)
        // so clicking "Customize" doesn't reset the chosen color.
        const preColorIdx = parseInt(params.get('color'));
        const ci = (Number.isInteger(preColorIdx) && p.colors[preColorIdx]) ? preColorIdx : 0;
        config.colorObj = p.colors[ci];
        config.color = p.colors[ci] ? p.colors[ci].name : null;
        // Skip brand + model, start at color
        steps = ALL_STEPS.filter(s => s.id !== 'brand' && s.id !== 'model');
        currentStepIdx = 0; // color is now index 0
        syncPreview();
      }
    }

    if (!hasPreselectedProduct) {
      steps = [...ALL_STEPS];
      currentStepIdx = 0;
    }

    render(root);
  }

  function currentStep() { return steps[currentStepIdx]; }

  function render(root) {
    const totalVisible = steps.length - 1; // exclude 'complete' from progress
    root.innerHTML = `
      <div class="configurator">
        <div class="configurator__progress" id="config-progress">
          ${steps.slice(0, -1).map((s, i) => `
            <div class="progress-step ${i < currentStepIdx ? 'completed' : ''} ${i === currentStepIdx ? 'active' : ''}" data-step="${i}">
              ${i > 0 ? '<div class="progress-step__line"></div>' : ''}
              <div class="progress-step__circle">${i < currentStepIdx ? '&#10003;' : i + 1}</div>
            </div>
          `).join('')}
        </div>
        <div id="config-step-content"></div>
      </div>
    `;

    root.querySelectorAll('.progress-step').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.step);
        if (idx < currentStepIdx) { currentStepIdx = idx; render(root); }
      });
    });

    renderStep(root);
    updateHatInfoCard();
  }

  function renderStep(root) {
    const container = document.getElementById('config-step-content');
    const step = currentStep();
    const isLast = step.id === 'complete';
    const isReview = step.id === 'review';

    container.innerHTML = `
      <div class="config-step active">
        <h2 class="config-step__title">${step.title}</h2>
        <p class="config-step__subtitle">${step.subtitle}</p>
        <div id="step-body"></div>
        ${!isLast ? `
        <div class="config-nav">
          ${currentStepIdx > 0 ? '<button class="btn btn--outline" id="config-prev">Back</button>' : '<div></div>'}
          ${isReview ? '<button class="btn btn--primary btn--lg" id="config-add-cart">Add to Cart</button>' :
                       '<button class="btn btn--primary" id="config-next">Continue</button>'}
        </div>` : ''}
      </div>
    `;

    const body = document.getElementById('step-body');
    const renderers = {
      brand: renderBrandStep, model: renderModelStep, color: renderColorStep,
      decoration: renderDecorationStep, details: renderDetailsStep, artwork: renderArtworkStep,
      instructions: renderInstructionsStep, quantity: renderQuantityStep,
      review: renderReviewStep, complete: renderCompleteStep,
    };
    (renderers[step.id] || (() => {}))(body);

    const prevBtn = document.getElementById('config-prev');
    const nextBtn = document.getElementById('config-next');
    const addCartBtn = document.getElementById('config-add-cart');

    if (prevBtn) prevBtn.addEventListener('click', () => { currentStepIdx--; render(root); });
    if (nextBtn) nextBtn.addEventListener('click', () => { if (validateStep()) { currentStepIdx++; render(root); } });
    if (addCartBtn) addCartBtn.addEventListener('click', () => {
      addToCart();
      currentStepIdx = steps.length - 1; // go to 'complete'
      render(root);
    });
  }

  function validateStep() {
    const id = currentStep().id;
    if (id === 'brand') return !!config.brand || (alert('Please select a brand'), false);
    if (id === 'model') return !!config.model || (alert('Please select a model'), false);
    if (id === 'color') return !!config.color || (alert('Please select a color'), false);
    if (id === 'decoration') return !!config.decorationType || (alert('Please select a decoration type'), false);
    return true;
  }

  // ---- Step Renderers ----

  function renderBrandStep(body) {
    body.innerHTML = `<div class="option-grid">${BRANDS.map(b => `
      <div class="option-card ${config.brand === b.id ? 'selected' : ''}" data-brand="${b.id}">
        <div class="option-card__icon">${b.icon}</div>
        <div class="option-card__title">${b.name}</div>
        <div class="option-card__desc">${b.desc}</div>
      </div>`).join('')}</div>`;
    body.querySelectorAll('.option-card').forEach(card => {
      card.addEventListener('click', () => {
        config.brand = card.dataset.brand;
        config.model = null; config.product = null; config.color = null;
        body.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
    });
  }

  function renderModelStep(body) {
    const models = allProducts.filter(p => p.brand.toLowerCase() === config.brand);
    if (!models.length) { body.innerHTML = '<p>No models found. Go back and select a different brand.</p>'; return; }
    body.innerHTML = `<div class="option-grid">${models.map(m => `
      <div class="option-card ${config.model === m.id ? 'selected' : ''}" data-model="${m.id}">
        <div class="option-card__icon">&#127913;</div>
        <div class="option-card__title">${m.model}</div>
        <div class="option-card__desc">${m.category.replace(/-/g,' ')} &middot; ${m.profile} profile</div>
      </div>`).join('')}</div>`;
    body.querySelectorAll('.option-card').forEach(card => {
      card.addEventListener('click', () => {
        config.model = card.dataset.model;
        config.product = allProducts.find(p => p.id === config.model);
        config.colorObj = config.product.colors[0];
        config.color = config.product.colors[0] ? config.product.colors[0].name : null;
        body.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        syncPreview();
      });
    });
  }

  function renderColorStep(body) {
    const product = config.product;
    if (!product) { body.innerHTML = '<p>Please select a model first.</p>'; return; }

    body.innerHTML = `
      <div class="config-colors">
        ${product.colors.map((c, i) => `
          <div class="config-color-chip ${config.color === c.name ? 'selected' : ''}" data-idx="${i}">
            <span class="config-color-chip__swatch" style="${window.swatchStyle ? window.swatchStyle(c) : 'background:' + swatchFor(c)}"></span>
            ${c.name}
          </div>
        `).join('')}
      </div>
    `;
    body.querySelectorAll('.config-color-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        config.colorObj = product.colors[parseInt(chip.dataset.idx)];
        config.color = config.colorObj.name;
        body.querySelectorAll('.config-color-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        // Live update the image gallery to the chosen color's photos
        updateGallery();
        updateHatInfoCard();
      });
    });
  }

  function renderDecorationStep(body) {
    const types = [
      { id: 'embroidery', name: 'Embroidery', icon: '&#129525;', desc: 'Classic stitched design, durable and professional.' },
      { id: 'patch_leather', name: 'Leather Patch', icon: '&#129523;', desc: 'Premium debossed or engraved leather patch.' },
      { id: 'patch_pvc', name: 'PVC Patch', icon: '&#128736;', desc: 'Durable 3D rubber patch, weather-resistant.' },
      { id: 'patch_woven', name: 'Woven Patch', icon: '&#129526;', desc: 'Detailed woven fabric patch with fine detail.' },
    ];
    body.innerHTML = `<div class="option-grid">${types.map(t => `
      <div class="option-card ${config.decorationType === t.id ? 'selected' : ''}" data-type="${t.id}">
        <div class="option-card__icon">${t.icon}</div>
        <div class="option-card__title">${t.name}</div>
        <div class="option-card__desc">${t.desc}</div>
      </div>`).join('')}</div>`;
    body.querySelectorAll('.option-card').forEach(card => {
      card.addEventListener('click', () => {
        config.decorationType = card.dataset.type;
        body.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        updateHatInfoCard();
      });
    });
  }

  function renderDetailsStep(body) {
    const isEmbroidery = config.decorationType === 'embroidery';
    if (isEmbroidery) {
      body.innerHTML = `
        <div class="decoration-options">
          <div>
            <div class="form-group">
              <label class="form-label">Embroidery Location</label>
              <div class="radio-group">
                ${['Front Center', 'Front Left', 'Front Right', 'Back', 'Side Left', 'Side Right'].map(loc => {
                  const val = loc.toLowerCase().replace(/ /g,'_');
                  return `<label class="radio-option ${config.decorationDetails.location === val ? 'selected' : ''}">
                    <input type="radio" name="emb-location" value="${val}" ${config.decorationDetails.location === val ? 'checked' : ''}>
                    <span class="radio-option__label">${loc}</span>
                  </label>`;
                }).join('')}
              </div>
            </div>
          </div>
          <div>
            <div class="form-group">
              <label class="form-label">Add-Ons</label>
              <div class="radio-group">
                <label class="radio-option ${config.decorationDetails.puff3d ? 'selected' : ''}">
                  <input type="checkbox" id="opt-3dpuff" ${config.decorationDetails.puff3d ? 'checked' : ''}>
                  <span class="radio-option__label">3D Puff Embroidery</span>
                  <span class="radio-option__price">+$2.00/hat</span>
                </label>
                <label class="radio-option ${config.decorationDetails.backEmbroidery ? 'selected' : ''}">
                  <input type="checkbox" id="opt-back" ${config.decorationDetails.backEmbroidery ? 'checked' : ''}>
                  <span class="radio-option__label">Back Embroidery</span>
                  <span class="radio-option__price">+$3.00/hat</span>
                </label>
                <label class="radio-option ${config.decorationDetails.sideEmbroidery ? 'selected' : ''}">
                  <input type="checkbox" id="opt-side" ${config.decorationDetails.sideEmbroidery ? 'checked' : ''}>
                  <span class="radio-option__label">Side Embroidery</span>
                  <span class="radio-option__price">+$2.50/hat</span>
                </label>
              </div>
            </div>
          </div>
        </div>`;
      body.querySelectorAll('input[name="emb-location"]').forEach(r => {
        r.addEventListener('change', () => {
          config.decorationDetails.location = r.value;
          body.querySelectorAll('input[name="emb-location"]').forEach(x => x.closest('.radio-option').classList.remove('selected'));
          r.closest('.radio-option').classList.add('selected');
        });
      });
      const bindCb = (id, key) => {
        document.getElementById(id).addEventListener('change', e => {
          config.decorationDetails[key] = e.target.checked;
          e.target.closest('.radio-option').classList.toggle('selected', e.target.checked);
        });
      };
      bindCb('opt-3dpuff', 'puff3d');
      bindCb('opt-back', 'backEmbroidery');
      bindCb('opt-side', 'sideEmbroidery');
    } else {
      body.innerHTML = `
        <div class="decoration-options">
          <div>
            <div class="form-group">
              <label class="form-label">Patch Shape</label>
              <div class="radio-group">
                ${['Rectangle', 'Circle', 'Oval', 'Shield', 'Custom'].map(shape => {
                  const val = shape.toLowerCase();
                  return `<label class="radio-option ${config.decorationDetails.patchShape === val ? 'selected' : ''}">
                    <input type="radio" name="patch-shape" value="${val}" ${config.decorationDetails.patchShape === val ? 'checked' : ''}>
                    <span class="radio-option__label">${shape}</span>
                  </label>`;
                }).join('')}
              </div>
            </div>
          </div>
          <div>
            <div class="form-group">
              <label class="form-label">Placement</label>
              <div class="radio-group">
                ${['Front Center', 'Front Left', 'Side'].map(loc => {
                  const val = loc.toLowerCase().replace(/ /g,'_');
                  return `<label class="radio-option ${config.decorationDetails.location === val ? 'selected' : ''}">
                    <input type="radio" name="patch-location" value="${val}" ${config.decorationDetails.location === val ? 'checked' : ''}>
                    <span class="radio-option__label">${loc}</span>
                  </label>`;
                }).join('')}
              </div>
            </div>
          </div>
        </div>`;
      body.querySelectorAll('input[name="patch-shape"]').forEach(r => {
        r.addEventListener('change', () => {
          config.decorationDetails.patchShape = r.value;
          body.querySelectorAll('input[name="patch-shape"]').forEach(x => x.closest('.radio-option').classList.remove('selected'));
          r.closest('.radio-option').classList.add('selected');
        });
      });
      body.querySelectorAll('input[name="patch-location"]').forEach(r => {
        r.addEventListener('change', () => {
          config.decorationDetails.location = r.value;
          body.querySelectorAll('input[name="patch-location"]').forEach(x => x.closest('.radio-option').classList.remove('selected'));
          r.closest('.radio-option').classList.add('selected');
        });
      });
    }
  }

  function renderArtworkStep(body) {
    body.innerHTML = `
      <div class="file-upload-zone" id="upload-zone">
        <div class="file-upload-zone__icon">&#128228;</div>
        <p class="file-upload-zone__text">Drag & drop your logo here, or click to browse</p>
        <p class="file-upload-zone__hint">Accepted formats: PNG, JPG, SVG, AI, EPS, PDF &middot; Max 25MB</p>
        <input type="file" id="artwork-input" accept=".png,.jpg,.jpeg,.svg,.ai,.eps,.pdf" style="display:none">
      </div>
      <div id="uploaded-preview"></div>
      <p class="form-hint" style="margin-top:var(--space-md);">
        Don't have a logo ready? Skip this step and email it to us later, or our design team can help.
      </p>`;

    const zone = document.getElementById('upload-zone');
    const input = document.getElementById('artwork-input');
    const preview = document.getElementById('uploaded-preview');

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('dragover'); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); });
    input.addEventListener('change', () => { if (input.files.length) handleFile(input.files[0]); });

    function handleFile(file) {
      config.artworkFile = file.name;
      const reader = new FileReader();
      reader.onload = e => {
        config.artworkDataUrl = e.target.result;
        preview.innerHTML = `<div class="uploaded-file"><span>&#128196;</span>
          <span class="uploaded-file__name">${file.name} (${(file.size/1024).toFixed(1)} KB)</span>
          <span class="uploaded-file__remove" onclick="this.closest('.uploaded-file').remove(); window._configRemoveArt();">&times;</span></div>`;
      };
      reader.readAsDataURL(file);
    }
    window._configRemoveArt = () => {
      config.artworkFile = null; config.artworkDataUrl = null;
    };
    if (config.artworkFile) {
      preview.innerHTML = `<div class="uploaded-file"><span>&#128196;</span>
        <span class="uploaded-file__name">${config.artworkFile}</span>
        <span class="uploaded-file__remove" onclick="this.closest('.uploaded-file').remove(); window._configRemoveArt();">&times;</span></div>`;
    }
  }

  function renderInstructionsStep(body) {
    body.innerHTML = `<div class="form-group">
      <label class="form-label">Special Instructions (Optional)</label>
      <textarea class="form-textarea" id="instructions-input" placeholder="Thread colors, sizing notes, placement details..." rows="6">${config.instructions}</textarea>
      <p class="form-hint">Our team will review your instructions and reach out if we have questions.</p>
    </div>`;
    document.getElementById('instructions-input').addEventListener('input', e => { config.instructions = e.target.value; });
  }

  function renderQuantityStep(body) {
    const pricing = PriceCalculator.calculateTotal(config.decorationType, config.quantity);

    body.innerHTML = `
      <div class="quantity-pricing">
        <div>
          <div class="form-group">
            <label class="form-label">Quantity</label>
            <div class="quantity-input-wrap">
              <button class="qty-btn" id="qty-minus">-</button>
              <input type="number" class="qty-input" id="qty-input" value="${config.quantity}" min="1" max="10000">
              <button class="qty-btn" id="qty-plus">+</button>
            </div>
          </div>
          <p class="form-hint">Minimum order: 1 hat.</p>
          <div class="live-price-summary" id="price-summary">${renderPriceSummary(pricing)}</div>
        </div>
      </div>`;

    const qtyInput = document.getElementById('qty-input');
    const update = () => {
      config.quantity = Math.max(1, parseInt(qtyInput.value) || 1);
      qtyInput.value = config.quantity;
      const p = PriceCalculator.calculateTotal(config.decorationType, config.quantity);
      document.getElementById('price-summary').innerHTML = renderPriceSummary(p);
    };
    qtyInput.addEventListener('input', update);
    document.getElementById('qty-minus').addEventListener('click', () => { qtyInput.value = Math.max(1, config.quantity - 1); update(); });
    document.getElementById('qty-plus').addEventListener('click', () => { qtyInput.value = config.quantity + 1; update(); });
  }

  function renderPriceSummary(p) {
    return `
      <div class="live-price-summary__row"><span>Unit price</span><span>$${p.unitPrice.toFixed(2)}/hat</span></div>
      <div class="live-price-summary__row"><span>Quantity</span><span>&times; ${p.quantity}</span></div>
      <div class="live-price-summary__total"><span>Order Total</span><span>$${p.lineTotal.toFixed(2)}</span></div>`;
  }

  function renderReviewStep(body) {
    const pricing = PriceCalculator.calculateTotal(config.decorationType, config.quantity);
    const decType = (config.decorationType || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const addons = [];
    if (config.decorationDetails.puff3d) addons.push('3D Puff');
    if (config.decorationDetails.backEmbroidery) addons.push('Back Embroidery');
    if (config.decorationDetails.sideEmbroidery) addons.push('Side Embroidery');

    body.innerHTML = `
      <div class="review-card">
        <div class="review-card__title">Hat Selection</div>
        <div class="review-row"><span class="review-row__label">Brand</span><span class="review-row__value">${config.product?.brand || '-'}</span></div>
        <div class="review-row"><span class="review-row__label">Model</span><span class="review-row__value">${config.product?.model || '-'}</span></div>
        <div class="review-row"><span class="review-row__label">Color</span><span class="review-row__value">${config.color || '-'}</span></div>
      </div>
      <div class="review-card">
        <div class="review-card__title">Decoration</div>
        <div class="review-row"><span class="review-row__label">Type</span><span class="review-row__value">${decType}</span></div>
        <div class="review-row"><span class="review-row__label">Location</span><span class="review-row__value">${(config.decorationDetails.location||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</span></div>
        ${addons.length ? `<div class="review-row"><span class="review-row__label">Add-ons</span><span class="review-row__value">${addons.join(', ')}</span></div>` : ''}
        <div class="review-row"><span class="review-row__label">Artwork</span><span class="review-row__value">${config.artworkFile || 'None uploaded'}</span></div>
        ${config.instructions ? `<div class="review-row"><span class="review-row__label">Instructions</span><span class="review-row__value" style="max-width:300px;">${config.instructions}</span></div>` : ''}
      </div>
      <div class="review-card">
        <div class="review-card__title">Pricing</div>
        <div class="review-row"><span class="review-row__label">Quantity</span><span class="review-row__value">${pricing.quantity} hats</span></div>
        <div class="review-row"><span class="review-row__label">Unit Price</span><span class="review-row__value">$${pricing.unitPrice.toFixed(2)}/hat</span></div>
        <div class="review-row" style="font-weight:700;font-size:1.1rem;">
          <span class="review-row__label">Order Total</span>
          <span class="review-row__value" style="color:var(--color-accent);">$${pricing.lineTotal.toFixed(2)}</span>
        </div>
      </div>`;
  }

  function renderCompleteStep(body) {
    body.innerHTML = `
      <div class="text-center" style="padding: var(--space-2xl) 0;">
        <div style="font-size:4rem; margin-bottom:var(--space-lg);">&#9989;</div>
        <h3 style="font-size:1.5rem; margin-bottom:var(--space-md); color:var(--color-primary);">Custom Hat Added to Cart!</h3>
        <p style="color:var(--color-text-light); margin-bottom:var(--space-xl); max-width:500px; margin-left:auto; margin-right:auto;">
          Your ${config.product?.brand} ${config.product?.model} in ${config.color} with ${(config.decorationType||'').replace(/_/g,' ')} has been added.
        </p>
        <div style="display:flex; gap:var(--space-md); justify-content:center; flex-wrap:wrap;">
          <a href="collection.html" class="btn btn--outline">Continue Shopping</a>
          <a href="cart.html" class="btn btn--primary btn--lg">View Cart &amp; Checkout</a>
        </div>
      </div>`;
  }

  function addToCart() {
    const pricing = PriceCalculator.calculateTotal(config.decorationType, config.quantity);
    const colorImage = config.colorObj && config.colorObj.images ? config.colorObj.images.front : (config.product && config.product.defaultImage);

    const lineItem = {
      id: 'item_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      productId: config.product?.id || config.model,
      productHandle: config.product?.handle || config.product?.id || config.model,
      sku: config.colorObj ? config.colorObj.sku : null,
      brand: config.product?.brand || '', model: config.product?.model || '',
      color: config.color,
      image: colorImage || '',
      decorationType: config.decorationType,
      decorationDetails: { ...config.decorationDetails },
      artworkFile: config.artworkFile, instructions: config.instructions,
      quantity: config.quantity, unitPrice: pricing.unitPrice, lineTotal: pricing.lineTotal,
      addedAt: new Date().toISOString(),
    };

    const cart = JSON.parse(localStorage.getItem('hatCart') || '[]');
    cart.push(lineItem);
    localStorage.setItem('hatCart', JSON.stringify(cart));

    if (typeof updateCartBadge === 'function') updateCartBadge();
    if (typeof Cart !== 'undefined' && Cart.updateBadge) Cart.updateBadge();
    if (typeof showToast === 'function') showToast('Custom hat added to cart!');
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init, getConfig: () => config };
})();
