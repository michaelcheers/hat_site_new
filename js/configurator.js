/* ==============================================
   CONFIGURATOR.JS — 10-Step Hat Configurator
   ============================================== */

const Configurator = (function() {
  const STEPS = [
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

  const BRANDS = [
    { id: 'richardson', name: 'Richardson', icon: '&#127913;', desc: 'Industry standard headwear' },
    { id: 'yupoong',   name: 'Yupoong',   icon: '&#9889;',    desc: 'Original classics' },
    { id: 'flexfit',   name: 'Flexfit',    icon: '&#128170;',  desc: 'Stretch-fit comfort' },
    { id: 'pacific',   name: 'Pacific Headwear', icon: '&#127754;', desc: 'Performance headwear' },
  ];

  let currentStep = 0;
  let allProducts = [];
  let config = {
    brand: null,
    model: null,
    product: null,
    color: null,
    decorationType: null,
    decorationDetails: {
      location: 'front',
      puff3d: false,
      backEmbroidery: false,
      sideEmbroidery: false,
      patchType: 'leather',
      patchShape: 'rectangle',
    },
    artworkFile: null,
    artworkDataUrl: null,
    instructions: '',
    quantity: 24,
  };

  function getColorHex(colorName) {
    const map = {
      'black': '#222', 'white': '#fff', 'navy': '#1b3a5c', 'red': '#cc2936',
      'royal': '#2659a8', 'charcoal': '#555', 'stone': '#b5a997', 'khaki': '#c3b091',
      'natural': '#f5e6c8', 'dark green': '#1a5c2e', 'brown': '#6b3e26',
      'heather grey': '#b0b0b0', 'maroon': '#6b1c2a', 'light pink': '#f4c2c2',
      'smoke blue': '#6d8fa7', 'dark grey': '#444', 'graphite': '#666'
    };
    const name = colorName.toLowerCase().split('/')[0].trim();
    return map[name] || '#999';
  }

  async function init() {
    const root = document.getElementById('configurator-root');
    if (!root) return;

    await PriceCalculator.loadPricing();

    const basePath = window.location.pathname.includes('/pages/') ? '../data/products.json' : 'data/products.json';
    const res = await fetch(basePath);
    allProducts = await res.json();

    // Check URL for pre-selected product
    const params = new URLSearchParams(window.location.search);
    const preselectedId = params.get('id');
    if (preselectedId) {
      const p = allProducts.find(x => x.id === preselectedId);
      if (p) {
        config.brand = p.brand.toLowerCase();
        config.model = p.id;
        config.product = p;
        config.color = p.colors[0];
        currentStep = 2; // Jump to color selection
      }
    }

    render(root);
  }

  function render(root) {
    root.innerHTML = `
      <div class="configurator">
        <div class="configurator__progress" id="config-progress">
          ${STEPS.map((s, i) => `
            <div class="progress-step ${i < currentStep ? 'completed' : ''} ${i === currentStep ? 'active' : ''}" data-step="${i}">
              ${i > 0 ? '<div class="progress-step__line"></div>' : ''}
              <div class="progress-step__circle">${i < currentStep ? '&#10003;' : i + 1}</div>
            </div>
          `).join('')}
        </div>
        <div id="config-step-content"></div>
      </div>
    `;

    // Click on progress steps to navigate
    root.querySelectorAll('.progress-step').forEach(el => {
      el.addEventListener('click', () => {
        const step = parseInt(el.dataset.step);
        if (step < currentStep) {
          currentStep = step;
          render(root);
        }
      });
    });

    renderStep(root);
  }

  function renderStep(root) {
    const container = document.getElementById('config-step-content');
    const step = STEPS[currentStep];

    let content = `
      <div class="config-step active">
        <h2 class="config-step__title">${step.title}</h2>
        <p class="config-step__subtitle">${step.subtitle}</p>
        <div id="step-body"></div>
        ${currentStep < 9 ? `
        <div class="config-nav">
          ${currentStep > 0 ? '<button class="btn btn--outline" id="config-prev">Back</button>' : '<div></div>'}
          ${currentStep < 8 ? '<button class="btn btn--primary" id="config-next">Continue</button>' :
            currentStep === 8 ? '<button class="btn btn--primary btn--lg" id="config-add-cart">Add to Cart</button>' : ''}
        </div>` : ''}
      </div>
    `;
    container.innerHTML = content;

    // Render step-specific body
    const body = document.getElementById('step-body');
    switch(currentStep) {
      case 0: renderBrandStep(body); break;
      case 1: renderModelStep(body); break;
      case 2: renderColorStep(body); break;
      case 3: renderDecorationStep(body); break;
      case 4: renderDetailsStep(body); break;
      case 5: renderArtworkStep(body); break;
      case 6: renderInstructionsStep(body); break;
      case 7: renderQuantityStep(body); break;
      case 8: renderReviewStep(body); break;
      case 9: renderCompleteStep(body); break;
    }

    // Nav buttons
    const prevBtn = document.getElementById('config-prev');
    const nextBtn = document.getElementById('config-next');
    const addCartBtn = document.getElementById('config-add-cart');

    if (prevBtn) prevBtn.addEventListener('click', () => { currentStep--; render(root); });
    if (nextBtn) nextBtn.addEventListener('click', () => {
      if (validateStep()) { currentStep++; render(root); }
    });
    if (addCartBtn) addCartBtn.addEventListener('click', () => {
      addToCart();
      currentStep = 9;
      render(root);
    });
  }

  function validateStep() {
    switch(currentStep) {
      case 0: return !!config.brand || (alert('Please select a brand'), false);
      case 1: return !!config.model || (alert('Please select a model'), false);
      case 2: return !!config.color || (alert('Please select a color'), false);
      case 3: return !!config.decorationType || (alert('Please select a decoration type'), false);
      default: return true;
    }
  }

  // ---- Step Renderers ----

  function renderBrandStep(body) {
    body.innerHTML = `
      <div class="option-grid">
        ${BRANDS.map(b => `
          <div class="option-card ${config.brand === b.id ? 'selected' : ''}" data-brand="${b.id}">
            <div class="option-card__icon">${b.icon}</div>
            <div class="option-card__title">${b.name}</div>
            <div class="option-card__desc">${b.desc}</div>
          </div>
        `).join('')}
      </div>
    `;
    body.querySelectorAll('.option-card').forEach(card => {
      card.addEventListener('click', () => {
        config.brand = card.dataset.brand;
        config.model = null;
        config.product = null;
        config.color = null;
        body.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
    });
  }

  function renderModelStep(body) {
    const models = allProducts.filter(p => p.brand.toLowerCase() === config.brand);
    if (models.length === 0) {
      body.innerHTML = '<p>No models found for this brand. Please go back and select a different brand.</p>';
      return;
    }
    body.innerHTML = `
      <div class="option-grid">
        ${models.map(m => `
          <div class="option-card ${config.model === m.id ? 'selected' : ''}" data-model="${m.id}">
            <div class="option-card__icon">&#127913;</div>
            <div class="option-card__title">${m.model}</div>
            <div class="option-card__desc">${m.category.replace(/-/g,' ')} &middot; ${m.profile} profile</div>
          </div>
        `).join('')}
      </div>
    `;
    body.querySelectorAll('.option-card').forEach(card => {
      card.addEventListener('click', () => {
        config.model = card.dataset.model;
        config.product = allProducts.find(p => p.id === config.model);
        config.color = config.product.colors[0];
        body.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
    });
  }

  function renderColorStep(body) {
    const product = config.product || allProducts.find(p => p.id === config.model);
    if (!product) { body.innerHTML = '<p>Please select a model first.</p>'; return; }
    config.product = product;

    body.innerHTML = `
      <div class="config-colors">
        ${product.colors.map(c => `
          <div class="config-color-chip ${config.color === c ? 'selected' : ''}" data-color="${c}">
            <span class="config-color-chip__swatch" style="background:${getColorHex(c)}"></span>
            ${c}
          </div>
        `).join('')}
      </div>
    `;
    body.querySelectorAll('.config-color-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        config.color = chip.dataset.color;
        body.querySelectorAll('.config-color-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        // Update 3D preview if available
        if (typeof HatPreview !== 'undefined') {
          HatPreview.updateColor(getColorHex(config.color));
        }
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

    body.innerHTML = `
      <div class="option-grid">
        ${types.map(t => `
          <div class="option-card ${config.decorationType === t.id ? 'selected' : ''}" data-type="${t.id}">
            <div class="option-card__icon">${t.icon}</div>
            <div class="option-card__title">${t.name}</div>
            <div class="option-card__desc">${t.desc}</div>
          </div>
        `).join('')}
      </div>
    `;
    body.querySelectorAll('.option-card').forEach(card => {
      card.addEventListener('click', () => {
        config.decorationType = card.dataset.type;
        body.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
    });
  }

  function renderDetailsStep(body) {
    const isEmbroidery = config.decorationType === 'embroidery';
    const isPatch = config.decorationType && config.decorationType.startsWith('patch_');

    if (isEmbroidery) {
      body.innerHTML = `
        <div class="decoration-options">
          <div>
            <div class="form-group">
              <label class="form-label">Embroidery Location</label>
              <div class="radio-group">
                ${['Front Center', 'Front Left', 'Front Right', 'Back', 'Side Left', 'Side Right'].map(loc => `
                  <label class="radio-option ${config.decorationDetails.location === loc.toLowerCase().replace(/ /g,'_') ? 'selected' : ''}">
                    <input type="radio" name="emb-location" value="${loc.toLowerCase().replace(/ /g,'_')}"
                           ${config.decorationDetails.location === loc.toLowerCase().replace(/ /g,'_') ? 'checked' : ''}>
                    <span class="radio-option__label">${loc}</span>
                  </label>
                `).join('')}
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
        </div>
      `;

      body.querySelectorAll('input[name="emb-location"]').forEach(radio => {
        radio.addEventListener('change', () => {
          config.decorationDetails.location = radio.value;
          body.querySelectorAll('.radio-group .radio-option').forEach(r => r.classList.remove('selected'));
          radio.closest('.radio-option').classList.add('selected');
        });
      });

      document.getElementById('opt-3dpuff').addEventListener('change', (e) => {
        config.decorationDetails.puff3d = e.target.checked;
        e.target.closest('.radio-option').classList.toggle('selected', e.target.checked);
      });
      document.getElementById('opt-back').addEventListener('change', (e) => {
        config.decorationDetails.backEmbroidery = e.target.checked;
        e.target.closest('.radio-option').classList.toggle('selected', e.target.checked);
      });
      document.getElementById('opt-side').addEventListener('change', (e) => {
        config.decorationDetails.sideEmbroidery = e.target.checked;
        e.target.closest('.radio-option').classList.toggle('selected', e.target.checked);
      });
    } else if (isPatch) {
      const patchType = config.decorationType.replace('patch_', '');
      body.innerHTML = `
        <div class="decoration-options">
          <div>
            <div class="form-group">
              <label class="form-label">Patch Shape</label>
              <div class="radio-group">
                ${['Rectangle', 'Circle', 'Oval', 'Shield', 'Custom'].map(shape => `
                  <label class="radio-option ${config.decorationDetails.patchShape === shape.toLowerCase() ? 'selected' : ''}">
                    <input type="radio" name="patch-shape" value="${shape.toLowerCase()}"
                           ${config.decorationDetails.patchShape === shape.toLowerCase() ? 'checked' : ''}>
                    <span class="radio-option__label">${shape}</span>
                  </label>
                `).join('')}
              </div>
            </div>
          </div>
          <div>
            <div class="form-group">
              <label class="form-label">Placement</label>
              <div class="radio-group">
                ${['Front Center', 'Front Left', 'Side'].map(loc => `
                  <label class="radio-option ${config.decorationDetails.location === loc.toLowerCase().replace(/ /g,'_') ? 'selected' : ''}">
                    <input type="radio" name="patch-location" value="${loc.toLowerCase().replace(/ /g,'_')}"
                           ${config.decorationDetails.location === loc.toLowerCase().replace(/ /g,'_') ? 'checked' : ''}>
                    <span class="radio-option__label">${loc}</span>
                  </label>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      `;
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
    /* Liquid: Shopify file upload API — for now store as base64 blob */
    body.innerHTML = `
      <div class="file-upload-zone" id="upload-zone">
        <div class="file-upload-zone__icon">&#128228;</div>
        <p class="file-upload-zone__text">Drag & drop your logo here, or click to browse</p>
        <p class="file-upload-zone__hint">Accepted formats: PNG, JPG, SVG, AI, EPS, PDF &middot; Max 25MB</p>
        <input type="file" id="artwork-input" accept=".png,.jpg,.jpeg,.svg,.ai,.eps,.pdf" style="display:none">
      </div>
      <!-- Liquid: Use Shopify File Upload API for production -->
      <div id="uploaded-preview"></div>
      <p class="form-hint" style="margin-top:var(--space-md);">
        Don't have a logo ready? No problem — you can skip this step and email it to us later, or our design team can help create one.
      </p>
    `;

    const zone = document.getElementById('upload-zone');
    const input = document.getElementById('artwork-input');
    const preview = document.getElementById('uploaded-preview');

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', () => { if (input.files.length) handleFile(input.files[0]); });

    function handleFile(file) {
      config.artworkFile = file.name;
      const reader = new FileReader();
      reader.onload = (e) => {
        config.artworkDataUrl = e.target.result;
        preview.innerHTML = `
          <div class="uploaded-file">
            <span>&#128196;</span>
            <span class="uploaded-file__name">${file.name} (${(file.size / 1024).toFixed(1)} KB)</span>
            <span class="uploaded-file__remove" onclick="this.closest('.uploaded-file').remove(); window._configRemoveArt();">&times;</span>
          </div>
        `;
        if (typeof HatPreview !== 'undefined' && file.type.startsWith('image/')) {
          HatPreview.updateDecal(e.target.result);
        }
      };
      reader.readAsDataURL(file);
    }

    window._configRemoveArt = () => {
      config.artworkFile = null;
      config.artworkDataUrl = null;
    };

    // Show existing file
    if (config.artworkFile) {
      preview.innerHTML = `
        <div class="uploaded-file">
          <span>&#128196;</span>
          <span class="uploaded-file__name">${config.artworkFile}</span>
          <span class="uploaded-file__remove" onclick="this.closest('.uploaded-file').remove(); window._configRemoveArt();">&times;</span>
        </div>
      `;
    }
  }

  function renderInstructionsStep(body) {
    body.innerHTML = `
      <div class="form-group">
        <label class="form-label">Special Instructions (Optional)</label>
        <textarea class="form-textarea" id="instructions-input" placeholder="Thread colors, sizing notes, placement details, or any other notes for our team..."
                  rows="6">${config.instructions}</textarea>
        <p class="form-hint">Our team will review your instructions and reach out if we have questions.</p>
      </div>
    `;
    document.getElementById('instructions-input').addEventListener('input', (e) => {
      config.instructions = e.target.value;
    });
  }

  function renderQuantityStep(body) {
    const extras = {
      puff3d: config.decorationDetails.puff3d,
      backEmbroidery: config.decorationDetails.backEmbroidery,
      sideEmbroidery: config.decorationDetails.sideEmbroidery,
    };
    const pricing = PriceCalculator.calculateTotal(config.decorationType, config.quantity, extras);
    const table = PriceCalculator.getPricingTable(config.decorationType);

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
          <p class="form-hint">Minimum order: 1 hat. Best value at 48+ units.</p>

          <div class="live-price-summary" id="price-summary">
            ${renderPriceSummary(pricing, extras)}
          </div>
        </div>
        <div>
          <label class="form-label">Volume Pricing</label>
          <table class="pricing-table">
            <thead><tr><th>Quantity</th><th>Per Hat</th></tr></thead>
            <tbody>
              ${table.map(t => `
                <tr class="${t.tier === pricing.tierLabel ? 'active-tier' : ''}">
                  <td>${t.tier} hats</td>
                  <td>$${t.price.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${Object.keys(extras).some(k => extras[k]) ? `
          <p class="form-hint" style="margin-top:var(--space-md);">
            * Add-ons are added per hat on top of the base price shown above.
          </p>` : ''}
        </div>
      </div>
    `;

    const qtyInput = document.getElementById('qty-input');
    const update = () => {
      config.quantity = Math.max(1, parseInt(qtyInput.value) || 1);
      qtyInput.value = config.quantity;
      const newPricing = PriceCalculator.calculateTotal(config.decorationType, config.quantity, extras);
      document.getElementById('price-summary').innerHTML = renderPriceSummary(newPricing, extras);
      // Update active tier row
      body.querySelectorAll('.pricing-table tbody tr').forEach(tr => {
        const tierText = tr.querySelector('td').textContent.replace(' hats', '');
        tr.classList.toggle('active-tier', tierText === newPricing.tierLabel);
      });
    };

    qtyInput.addEventListener('input', update);
    document.getElementById('qty-minus').addEventListener('click', () => { qtyInput.value = Math.max(1, config.quantity - 1); update(); });
    document.getElementById('qty-plus').addEventListener('click', () => { qtyInput.value = config.quantity + 1; update(); });
  }

  function renderPriceSummary(pricing, extras) {
    return `
      <div class="live-price-summary__row">
        <span>Base price (${pricing.tierLabel} tier)</span>
        <span>$${pricing.basePrice.toFixed(2)}/hat</span>
      </div>
      ${pricing.extrasTotal > 0 ? `
      <div class="live-price-summary__row">
        <span>Add-ons</span>
        <span>+$${pricing.extrasTotal.toFixed(2)}/hat</span>
      </div>` : ''}
      <div class="live-price-summary__row">
        <span>Unit price</span>
        <span>$${pricing.unitPrice.toFixed(2)}/hat</span>
      </div>
      <div class="live-price-summary__row">
        <span>Quantity</span>
        <span>&times; ${pricing.quantity}</span>
      </div>
      <div class="live-price-summary__total">
        <span>Order Total</span>
        <span>$${pricing.lineTotal.toFixed(2)}</span>
      </div>
    `;
  }

  function renderReviewStep(body) {
    const extras = {
      puff3d: config.decorationDetails.puff3d,
      backEmbroidery: config.decorationDetails.backEmbroidery,
      sideEmbroidery: config.decorationDetails.sideEmbroidery,
    };
    const pricing = PriceCalculator.calculateTotal(config.decorationType, config.quantity, extras);
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
        <div class="review-row"><span class="review-row__label">Location</span><span class="review-row__value">${(config.decorationDetails.location || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span></div>
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
      </div>
    `;
  }

  function renderCompleteStep(body) {
    body.innerHTML = `
      <div class="text-center" style="padding: var(--space-2xl) 0;">
        <div style="font-size:4rem; margin-bottom:var(--space-lg);">&#9989;</div>
        <h3 style="font-size:1.5rem; margin-bottom:var(--space-md); color:var(--color-primary);">Custom Hat Added to Cart!</h3>
        <p style="color:var(--color-text-light); margin-bottom:var(--space-xl); max-width:500px; margin-left:auto; margin-right:auto;">
          Your ${config.product?.brand} ${config.product?.model} in ${config.color} with ${(config.decorationType || '').replace(/_/g,' ')} has been added. You can continue shopping or proceed to checkout.
        </p>
        <div style="display:flex; gap:var(--space-md); justify-content:center; flex-wrap:wrap;">
          <a href="collection.html" class="btn btn--outline">Continue Shopping</a>
          <a href="cart.html" class="btn btn--primary btn--lg">View Cart &amp; Checkout</a>
        </div>
      </div>
    `;
  }

  function addToCart() {
    const extras = {
      puff3d: config.decorationDetails.puff3d,
      backEmbroidery: config.decorationDetails.backEmbroidery,
      sideEmbroidery: config.decorationDetails.sideEmbroidery,
    };
    const pricing = PriceCalculator.calculateTotal(config.decorationType, config.quantity, extras);

    /* Liquid: Shopify Cart API /cart/add.js with line_item properties */
    const lineItem = {
      productId: config.product?.id || config.model,
      brand: config.product?.brand || '',
      model: config.product?.model || '',
      color: config.color,
      decorationType: config.decorationType,
      decorationDetails: { ...config.decorationDetails },
      artworkFile: config.artworkFile,
      instructions: config.instructions,
      quantity: config.quantity,
      unitPrice: pricing.unitPrice,
      lineTotal: pricing.lineTotal,
      addedAt: new Date().toISOString(),
    };

    const cart = JSON.parse(localStorage.getItem('hatCart') || '[]');
    cart.push(lineItem);
    localStorage.setItem('hatCart', JSON.stringify(cart));

    // Update badge
    if (typeof updateCartBadge === 'function') updateCartBadge();
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
