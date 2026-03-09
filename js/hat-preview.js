/* ==============================================
   HAT-PREVIEW.JS — Three.js 3D Hat Preview (ES Module)
   Programmatic geometry, no external model files.
   Modular: updateColor(), updateModel(), updateDecal()
   can be replaced with real .glb models later.
   ============================================== */

import * as THREE from 'three';

let scene, camera, renderer, hatGroup;
let currentColor = '#222222';
let currentProfile = 'trucker';
let decalTexture = null;
let currentDecorationType = null;
let currentDecorationDetails = {};
let animFrameId = null;
let container = null;

function init(containerId) {
  container = document.getElementById(containerId || 'hat-3d-container');
  if (!container) return false;

  // Clear/hide fallback
  const fallback = container.querySelector('#product-image-fallback, .product-gallery__main');
  if (fallback) fallback.style.display = 'none';

  const width = container.clientWidth;
  const height = container.clientHeight || width;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf8f9fa);

  // Camera
  camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
  camera.position.set(0, 1.5, 4);
  camera.lookAt(0, 0.5, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.borderRadius = 'var(--border-radius-lg, 12px)';

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(3, 5, 4);
  dirLight.castShadow = true;
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
  fillLight.position.set(-3, 2, -2);
  scene.add(fillLight);

  // Ground shadow
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.ShadowMaterial({ opacity: 0.15 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  scene.add(ground);

  // Build hat
  hatGroup = new THREE.Group();
  scene.add(hatGroup);
  buildHat(currentProfile);

  // Orbit controls
  initOrbitControls(renderer.domElement);

  window.addEventListener('resize', onResize);

  // "Drag to rotate" label
  if (!container.querySelector('.preview-3d-label')) {
    const lbl = document.createElement('div');
    lbl.className = 'preview-3d-label';
    lbl.textContent = 'Drag to rotate';
    container.style.position = 'relative';
    container.appendChild(lbl);
  }

  animate();
  return true;
}

function buildHat(profile) {
  while (hatGroup.children.length) hatGroup.remove(hatGroup.children[0]);

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(currentColor),
    roughness: 0.7,
    metalness: 0.05,
  });

  const meshMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(currentColor),
    roughness: 0.8,
    metalness: 0,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
  });

  // Crown — lathe geometry
  const crownPoints = [];
  const segments = 20;
  const crownHeight = profile === 'dad' ? 1.0 : 1.15;
  const crownRadius = 0.9;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    let r, y;
    if (t < 0.1) {
      r = crownRadius;
      y = t * 2;
    } else if (t < 0.85) {
      const bt = (t - 0.1) / 0.75;
      r = crownRadius - bt * bt * 0.15;
      y = 0.2 + bt * (crownHeight - 0.3);
    } else {
      const dt = (t - 0.85) / 0.15;
      r = (crownRadius - 0.15) * Math.cos(dt * Math.PI / 2) * 0.9;
      y = crownHeight - 0.1 + Math.sin(dt * Math.PI / 2) * 0.2;
    }
    crownPoints.push(new THREE.Vector2(r, y));
  }

  const crown = new THREE.Mesh(new THREE.LatheGeometry(crownPoints, 32), material);
  crown.castShadow = true;
  hatGroup.add(crown);

  // Button on top
  const button = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 8), material);
  button.position.y = crownHeight + 0.08;
  hatGroup.add(button);

  // Brim
  const brimShape = new THREE.Shape();
  const brimLength = profile === 'snapback' || profile === 'fitted' ? 1.1 : 0.95;
  const brimWidth = 1.05;

  brimShape.moveTo(-brimWidth, 0);
  brimShape.quadraticCurveTo(-brimWidth, brimLength, 0, brimLength + 0.1);
  brimShape.quadraticCurveTo(brimWidth, brimLength, brimWidth, 0);
  brimShape.quadraticCurveTo(brimWidth * 0.5, -0.15, 0, -0.15);
  brimShape.quadraticCurveTo(-brimWidth * 0.5, -0.15, -brimWidth, 0);

  const brimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(currentColor),
    roughness: 0.6,
    metalness: 0.05,
  });

  const brim = new THREE.Mesh(
    new THREE.ExtrudeGeometry(brimShape, {
      depth: 0.04, bevelEnabled: true,
      bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2,
    }),
    brimMat
  );
  brim.rotation.x = profile !== 'snapback' ? -Math.PI / 2 + 0.15 : -Math.PI / 2;
  brim.position.set(0, 0.18, 0.3);
  brim.castShadow = true;
  hatGroup.add(brim);

  // Mesh back for trucker caps
  if (profile === 'trucker') {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(crownRadius - 0.02, 32, 16, Math.PI * 0.3, Math.PI * 1.4, 0, Math.PI * 0.55),
      meshMaterial
    );
    mesh.position.y = 0.55;
    hatGroup.add(mesh);
  }

  // Sweatband
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(crownRadius - 0.02, 0.03, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 })
  );
  band.position.y = 0.22;
  band.rotation.x = Math.PI / 2;
  hatGroup.add(band);

  // Snapback closure
  if (profile === 'trucker' || profile === 'snapback') {
    const closure = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.12, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 })
    );
    closure.position.set(0, 0.35, -crownRadius + 0.05);
    hatGroup.add(closure);
  }

  hatGroup.position.y = -0.3;

  if (decalTexture) applyDecal();
  if (currentDecorationType) applyDecoration();
}

function applyDecal() {
  const existing = hatGroup.getObjectByName('hatDecal');
  if (existing) hatGroup.remove(existing);
  if (!decalTexture) return;

  const decal = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 0.4),
    new THREE.MeshStandardMaterial({
      map: decalTexture, transparent: true,
      roughness: 0.5, metalness: 0, depthWrite: false,
    })
  );
  decal.name = 'hatDecal';
  decal.position.set(0, 0.65, 0.91);
  hatGroup.add(decal);
}

function getDecorationPosition(location) {
  const r = 0.91; // crown surface radius
  switch (location) {
    case 'front_left':   return { pos: [-0.35, 0.65, r * 0.95], rot: [0, -0.35, 0] };
    case 'front_right':  return { pos: [0.35, 0.65, r * 0.95],  rot: [0, 0.35, 0] };
    case 'back':         return { pos: [0, 0.65, -r],           rot: [0, Math.PI, 0] };
    case 'side_left':    return { pos: [-r, 0.65, 0],           rot: [0, -Math.PI / 2, 0] };
    case 'side_right':   return { pos: [r, 0.65, 0],            rot: [0, Math.PI / 2, 0] };
    case 'side':         return { pos: [-r, 0.65, 0],           rot: [0, -Math.PI / 2, 0] };
    default:             return { pos: [0, 0.65, r],            rot: [0, 0, 0] }; // front_center
  }
}

function applyDecoration() {
  // Remove previous decoration group
  const existing = hatGroup.getObjectByName('decorationGroup');
  if (existing) hatGroup.remove(existing);
  if (!currentDecorationType) return;

  const group = new THREE.Group();
  group.name = 'decorationGroup';

  const loc = currentDecorationDetails.location || 'front_center';
  const placement = getDecorationPosition(loc);

  if (currentDecorationType === 'embroidery') {
    // Embroidery: slightly raised stitched area
    const is3dPuff = currentDecorationDetails.puff3d;
    const depth = is3dPuff ? 0.04 : 0.015;

    // Main embroidery area
    const embShape = new THREE.Shape();
    embShape.moveTo(-0.22, -0.12);
    embShape.lineTo(0.22, -0.12);
    embShape.quadraticCurveTo(0.25, -0.12, 0.25, -0.09);
    embShape.lineTo(0.25, 0.09);
    embShape.quadraticCurveTo(0.25, 0.12, 0.22, 0.12);
    embShape.lineTo(-0.22, 0.12);
    embShape.quadraticCurveTo(-0.25, 0.12, -0.25, 0.09);
    embShape.lineTo(-0.25, -0.09);
    embShape.quadraticCurveTo(-0.25, -0.12, -0.22, -0.12);

    const embMesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(embShape, { depth, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 2 }),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
        metalness: 0,
      })
    );
    group.add(embMesh);

    // Stitch lines to show it's embroidery
    const stitchMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 1.0 });
    for (let i = -2; i <= 2; i++) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.008, depth + 0.005),
        stitchMat
      );
      line.position.set(0, i * 0.04, 0);
      group.add(line);
    }

    // Add extra locations if selected
    if (currentDecorationDetails.backEmbroidery) {
      const backPos = getDecorationPosition('back');
      const backEmb = new THREE.Mesh(
        new THREE.ExtrudeGeometry(embShape, { depth: 0.01, bevelEnabled: false }),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 })
      );
      backEmb.name = 'backEmbroidery';
      backEmb.position.set(...backPos.pos);
      backEmb.rotation.set(...backPos.rot);
      hatGroup.add(backEmb);
    }
    if (currentDecorationDetails.sideEmbroidery) {
      const sidePos = getDecorationPosition('side_right');
      const sideEmb = new THREE.Mesh(
        new THREE.ExtrudeGeometry(embShape, { depth: 0.01, bevelEnabled: false }),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 })
      );
      sideEmb.name = 'sideEmbroidery';
      sideEmb.position.set(...sidePos.pos);
      sideEmb.rotation.set(...sidePos.rot);
      hatGroup.add(sideEmb);
    }

  } else if (currentDecorationType === 'patch_leather') {
    // Leather patch: thick brown rectangle with rounded look
    const patchGeo = createPatchGeometry(currentDecorationDetails.patchShape || 'rectangle');
    const patch = new THREE.Mesh(
      new THREE.ExtrudeGeometry(patchGeo, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3 }),
      new THREE.MeshStandardMaterial({
        color: 0x8B6914,
        roughness: 0.85,
        metalness: 0.05,
      })
    );
    group.add(patch);

    // Debossed border stitching
    const border = new THREE.Mesh(
      new THREE.ExtrudeGeometry(patchGeo, { depth: 0.001, bevelEnabled: false }),
      new THREE.MeshStandardMaterial({ color: 0x6B4F12, roughness: 0.9 })
    );
    border.position.z = 0.031;
    border.scale.set(0.92, 0.92, 1);
    group.add(border);

  } else if (currentDecorationType === 'patch_pvc') {
    // PVC patch: glossy, colorful rubber
    const patchGeo = createPatchGeometry(currentDecorationDetails.patchShape || 'rectangle');
    const patch = new THREE.Mesh(
      new THREE.ExtrudeGeometry(patchGeo, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 3 }),
      new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.15,
        metalness: 0.1,
      })
    );
    group.add(patch);

    // Inner raised detail
    const inner = new THREE.Mesh(
      new THREE.ExtrudeGeometry(patchGeo, { depth: 0.01, bevelEnabled: false }),
      new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.2, metalness: 0.05 })
    );
    inner.position.z = 0.046;
    inner.scale.set(0.75, 0.75, 1);
    group.add(inner);

  } else if (currentDecorationType === 'patch_woven') {
    // Woven patch: fabric-like, flat
    const patchGeo = createPatchGeometry(currentDecorationDetails.patchShape || 'rectangle');
    const patch = new THREE.Mesh(
      new THREE.ExtrudeGeometry(patchGeo, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 }),
      new THREE.MeshStandardMaterial({
        color: 0x2c2c2c,
        roughness: 0.95,
        metalness: 0,
      })
    );
    group.add(patch);

    // Woven thread lines
    const threadMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 1.0 });
    for (let i = -3; i <= 3; i++) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.003, 0.015), threadMat);
      h.position.set(0, i * 0.025, 0);
      group.add(h);
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.2, 0.015), threadMat);
      v.position.set(i * 0.05, 0, 0);
      group.add(v);
    }
  }

  group.position.set(...placement.pos);
  group.rotation.set(...placement.rot);
  hatGroup.add(group);
}

function createPatchGeometry(shape) {
  const s = new THREE.Shape();
  switch (shape) {
    case 'circle':
      s.absarc(0, 0, 0.15, 0, Math.PI * 2, false);
      break;
    case 'oval':
      s.absellipse(0, 0, 0.2, 0.13, 0, Math.PI * 2, false, 0);
      break;
    case 'shield': {
      s.moveTo(0, 0.17);
      s.lineTo(0.18, 0.1);
      s.lineTo(0.18, -0.05);
      s.quadraticCurveTo(0.15, -0.17, 0, -0.2);
      s.quadraticCurveTo(-0.15, -0.17, -0.18, -0.05);
      s.lineTo(-0.18, 0.1);
      s.lineTo(0, 0.17);
      break;
    }
    default: // rectangle
      const rw = 0.2, rh = 0.13, rc = 0.025;
      s.moveTo(-rw + rc, -rh);
      s.lineTo(rw - rc, -rh);
      s.quadraticCurveTo(rw, -rh, rw, -rh + rc);
      s.lineTo(rw, rh - rc);
      s.quadraticCurveTo(rw, rh, rw - rc, rh);
      s.lineTo(-rw + rc, rh);
      s.quadraticCurveTo(-rw, rh, -rw, rh - rc);
      s.lineTo(-rw, -rh + rc);
      s.quadraticCurveTo(-rw, -rh, -rw + rc, -rh);
      break;
  }
  return s;
}

function initOrbitControls(canvas) {
  let isDragging = false;
  let prevX = 0, prevY = 0;
  let rotY = 0, rotX = 0.2;
  let zoom = 4;

  function onStart(x, y) { isDragging = true; prevX = x; prevY = y; }
  function onMove(x, y) {
    if (!isDragging) return;
    rotY += (x - prevX) * 0.008;
    rotX = Math.max(-0.5, Math.min(1.2, rotX + (y - prevY) * 0.008));
    prevX = x; prevY = y;
    updateCam();
  }
  function onEnd() { isDragging = false; }
  function onZoom(delta) { zoom = Math.max(2, Math.min(8, zoom + delta * 0.01)); updateCam(); }
  function updateCam() {
    camera.position.x = zoom * Math.sin(rotY) * Math.cos(rotX);
    camera.position.y = zoom * Math.sin(rotX) + 0.5;
    camera.position.z = zoom * Math.cos(rotY) * Math.cos(rotX);
    camera.lookAt(0, 0.4, 0);
  }

  canvas.addEventListener('mousedown', e => onStart(e.clientX, e.clientY));
  canvas.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
  canvas.addEventListener('mouseup', onEnd);
  canvas.addEventListener('mouseleave', onEnd);
  canvas.addEventListener('wheel', e => { e.preventDefault(); onZoom(e.deltaY); }, { passive: false });
  canvas.addEventListener('touchstart', e => { if (e.touches.length === 1) onStart(e.touches[0].clientX, e.touches[0].clientY); });
  canvas.addEventListener('touchmove', e => { if (e.touches.length === 1) { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: false });
  canvas.addEventListener('touchend', onEnd);
  updateCam();
}

function animate() {
  animFrameId = requestAnimationFrame(animate);
  if (renderer && scene && camera) renderer.render(scene, camera);
}

function onResize() {
  if (!container || !renderer || !camera) return;
  const w = container.clientWidth;
  const h = container.clientHeight || w;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

// ---- Public API (exposed on window for non-module scripts) ----
function updateColor(hexColor) {
  currentColor = hexColor;
  if (!hatGroup) return;
  hatGroup.children.forEach(child => {
    // Skip decals, decorations, and transparent meshes (mesh back)
    if (child.name === 'hatDecal' || child.name === 'decorationGroup' ||
        child.name === 'backEmbroidery' || child.name === 'sideEmbroidery') return;
    if (child.material && !child.material.transparent) {
      child.material.color.set(hexColor);
    }
  });
}

function updateModel(profile) {
  currentProfile = profile;
  if (hatGroup) buildHat(profile);
}

function updateDecal(imageDataUrl) {
  if (!imageDataUrl) {
    decalTexture = null;
    const existing = hatGroup?.getObjectByName('hatDecal');
    if (existing) hatGroup.remove(existing);
    return;
  }
  new THREE.TextureLoader().load(imageDataUrl, texture => {
    decalTexture = texture;
    applyDecal();
  });
}

function updateDecoration(type, details) {
  currentDecorationType = type || null;
  currentDecorationDetails = details || {};
  if (hatGroup) {
    // Clean up extra embroidery spots
    const backEmb = hatGroup.getObjectByName('backEmbroidery');
    if (backEmb) hatGroup.remove(backEmb);
    const sideEmb = hatGroup.getObjectByName('sideEmbroidery');
    if (sideEmb) hatGroup.remove(sideEmb);
    applyDecoration();
  }
}

function destroy() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  if (renderer) {
    renderer.dispose();
    renderer.domElement.remove();
  }
  window.removeEventListener('resize', onResize);
}

// Expose on window so non-module scripts (configurator.js) can call it
window.HatPreview = { init, updateColor, updateModel, updateDecal, updateDecoration, destroy };

// Signal that the module is ready (page scripts call init explicitly)
window.dispatchEvent(new Event('hat-preview-ready'));
