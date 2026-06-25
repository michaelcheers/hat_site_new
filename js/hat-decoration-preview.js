/* ==============================================
   HAT-DECORATION-PREVIEW.JS — Three.js decoration renderer (ES Module)
   Reuses the EXACT same decoration geometry/material logic the old 3D hat
   preview used (applyDecoration / applyDecal / createPatchGeometry), but
   renders ONLY the decoration — head-on, on a transparent background — to a
   PNG data URL that gets overlaid on the real hat photo for the matching
   angle. This is the same rendering logic as the retired 3D model version,
   just composited onto the product photography instead of a procedural hat.
   ============================================== */

import * as THREE from 'three';

let scene, camera, renderer, decoGroup;
let ready = false;
let renderQueue = Promise.resolve();

function ensureRenderer() {
  if (ready) return true;

  const SIZE = 320;
  scene = new THREE.Scene();
  scene.background = null; // transparent

  // Orthographic, head-on camera framing the ~±0.45 decoration region.
  const half = 0.45;
  camera = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 10);
  camera.position.set(0, 0, 3);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(SIZE, SIZE);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  // Lighting mirrors the old preview so embroidery/patch shading matches.
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
  dirLight.position.set(0.4, 0.8, 2.5);
  scene.add(dirLight);
  const fill = new THREE.DirectionalLight(0xffffff, 0.3);
  fill.position.set(-0.6, -0.3, 1.5);
  scene.add(fill);

  ready = true;
  return true;
}

/* ---- geometry helpers (verbatim from the old hat-preview.js 3D logic) ---- */

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
    default: { // rectangle
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
  }
  return s;
}

function buildDecorationGroup(type, details) {
  const group = new THREE.Group();
  group.name = 'decorationGroup';
  details = details || {};

  if (type === 'embroidery') {
    const is3dPuff = details.puff3d;
    const depth = is3dPuff ? 0.04 : 0.015;

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
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 })
    );
    group.add(embMesh);

    const stitchMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 1.0 });
    for (let i = -2; i <= 2; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.008, depth + 0.005), stitchMat);
      line.position.set(0, i * 0.04, 0);
      group.add(line);
    }
  } else if (type === 'patch_leather') {
    const patchGeo = createPatchGeometry(details.patchShape || 'rectangle');
    const patch = new THREE.Mesh(
      new THREE.ExtrudeGeometry(patchGeo, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3 }),
      new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.85, metalness: 0.05 })
    );
    group.add(patch);
    const border = new THREE.Mesh(
      new THREE.ExtrudeGeometry(patchGeo, { depth: 0.001, bevelEnabled: false }),
      new THREE.MeshStandardMaterial({ color: 0x6B4F12, roughness: 0.9 })
    );
    border.position.z = 0.031;
    border.scale.set(0.92, 0.92, 1);
    group.add(border);
  } else if (type === 'patch_pvc') {
    const patchGeo = createPatchGeometry(details.patchShape || 'rectangle');
    const patch = new THREE.Mesh(
      new THREE.ExtrudeGeometry(patchGeo, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 3 }),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.15, metalness: 0.1 })
    );
    group.add(patch);
    const inner = new THREE.Mesh(
      new THREE.ExtrudeGeometry(patchGeo, { depth: 0.01, bevelEnabled: false }),
      new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.2, metalness: 0.05 })
    );
    inner.position.z = 0.046;
    inner.scale.set(0.75, 0.75, 1);
    group.add(inner);
  } else if (type === 'patch_woven') {
    const patchGeo = createPatchGeometry(details.patchShape || 'rectangle');
    const patch = new THREE.Mesh(
      new THREE.ExtrudeGeometry(patchGeo, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 }),
      new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.95, metalness: 0 })
    );
    group.add(patch);
    const threadMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 1.0 });
    for (let i = -3; i <= 3; i++) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.003, 0.015), threadMat);
      h.position.set(0, i * 0.025, 0);
      group.add(h);
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.2, 0.015), threadMat);
      v.position.set(i * 0.05, 0, 0);
      group.add(v);
    }
  } else {
    return null;
  }
  return group;
}

function applyDecal(group, type, details, decalTexture) {
  if (!decalTexture) return;
  // Sit the artwork clearly in front of the decoration's extruded front face.
  // The old 3D preview viewed this on a curved surface at an angle; rendering
  // head-on with an orthographic camera needs a larger forward offset to avoid
  // z-fighting with the decoration mesh.
  const CLEAR = 0.03;
  let depth, w, h;
  if (type === 'embroidery') {
    depth = ((details && details.puff3d) ? 0.04 : 0.015) + 0.005 + CLEAR;
    w = 0.4; h = 0.2;
  } else if (type === 'patch_leather') {
    depth = 0.03 + 0.008 + CLEAR; w = 0.3; h = 0.2;
  } else if (type === 'patch_pvc') {
    depth = 0.045 + 0.01 + CLEAR; w = 0.28; h = 0.18;
  } else if (type === 'patch_woven') {
    depth = 0.012 + 0.003 + CLEAR; w = 0.32; h = 0.2;
  } else {
    depth = 0.02 + CLEAR; w = 0.35; h = 0.22;
  }
  const decal = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: decalTexture, transparent: true, roughness: 0.4, metalness: 0, depthWrite: false })
  );
  decal.name = 'hatDecal';
  decal.position.set(0, 0, depth);
  group.add(decal);
}

function disposeGroup(g) {
  g.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  });
}

function loadTexture(dataUrl) {
  return new Promise(resolve => {
    if (!dataUrl || !/^data:image\//.test(dataUrl)) { resolve(null); return; }
    new THREE.TextureLoader().load(dataUrl, t => { t.colorSpace = THREE.SRGBColorSpace; resolve(t); }, undefined, () => resolve(null));
  });
}

function renderOnce(type, details, decalTexture) {
  ensureRenderer();
  if (decoGroup) { scene.remove(decoGroup); disposeGroup(decoGroup); decoGroup = null; }
  const group = buildDecorationGroup(type, details);
  if (!group) return null;
  applyDecal(group, type, details, decalTexture);
  decoGroup = group;
  scene.add(group);
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/png');
}

/**
 * Render the decoration (optionally with an uploaded artwork decal on top) to a
 * transparent PNG data URL. Renders are serialized so the shared WebGL context
 * is never used concurrently. Returns null if there is no renderable decoration.
 */
function toImage(type, details, artworkDataUrl) {
  const job = renderQueue.then(async () => {
    if (!type) return null;
    const tex = await loadTexture(artworkDataUrl);
    try {
      return renderOnce(type, details, tex);
    } finally {
      if (tex) tex.dispose();
    }
  });
  // Keep the chain alive even if a job throws.
  renderQueue = job.catch(() => {});
  return job;
}

window.HatDecorationPreview = { toImage };
window.dispatchEvent(new Event('hat-decoration-preview-ready'));
