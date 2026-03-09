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
    if (child.material && child.name !== 'hatDecal' && !child.material.transparent) {
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

function destroy() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  if (renderer) {
    renderer.dispose();
    renderer.domElement.remove();
  }
  window.removeEventListener('resize', onResize);
}

// Expose on window so non-module scripts (configurator.js) can call it
window.HatPreview = { init, updateColor, updateModel, updateDecal, destroy };

// Auto-init
const target = document.getElementById('hat-3d-container');
if (target) init('hat-3d-container');
