/* ==============================================
   HAT-PREVIEW.JS — Three.js 3D Hat Preview
   Programmatic geometry, no external model files.
   Modular: updateColor(), updateModel(), updateDecal()
   can be replaced with real .glb models later.
   ============================================== */

const HatPreview = (function() {
  let scene, camera, renderer, hatGroup, controls;
  let currentColor = '#222222';
  let currentProfile = 'trucker'; // trucker, dad, snapback, fitted
  let decalTexture = null;
  let animFrameId = null;
  let container = null;

  function init(containerId) {
    if (typeof THREE === 'undefined') {
      console.warn('Three.js not loaded — 3D preview unavailable');
      return false;
    }

    container = document.getElementById(containerId || 'hat-3d-container');
    if (!container) return false;

    // Clear container
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
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(3, 5, 4);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-3, 2, -2);
    scene.add(fillLight);

    // Ground plane for shadow
    const groundGeo = new THREE.PlaneGeometry(10, 10);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.15 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);

    // Build hat
    hatGroup = new THREE.Group();
    scene.add(hatGroup);
    buildHat(currentProfile);

    // Orbit controls (manual, no import needed)
    initOrbitControls(renderer.domElement);

    // Handle resize
    window.addEventListener('resize', onResize);

    // Label
    const label = container.querySelector('.preview-3d-label');
    if (!label) {
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
    // Clear existing
    while (hatGroup.children.length) {
      hatGroup.remove(hatGroup.children[0]);
    }

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
        // Bottom rim
        r = crownRadius;
        y = t * 2;
      } else if (t < 0.85) {
        // Body
        const bt = (t - 0.1) / 0.75;
        r = crownRadius - bt * bt * 0.15;
        y = 0.2 + bt * (crownHeight - 0.3);
      } else {
        // Top dome
        const dt = (t - 0.85) / 0.15;
        r = (crownRadius - 0.15) * Math.cos(dt * Math.PI / 2) * 0.9;
        y = crownHeight - 0.1 + Math.sin(dt * Math.PI / 2) * 0.2;
      }
      crownPoints.push(new THREE.Vector2(r, y));
    }

    const crownGeo = new THREE.LatheGeometry(crownPoints, 32);
    const crown = new THREE.Mesh(crownGeo, material);
    crown.castShadow = true;
    hatGroup.add(crown);

    // Button on top
    const buttonGeo = new THREE.SphereGeometry(0.06, 16, 8);
    const button = new THREE.Mesh(buttonGeo, material);
    button.position.y = crownHeight + 0.08;
    hatGroup.add(button);

    // Brim
    const brimShape = new THREE.Shape();
    const brimLength = profile === 'snapback' || profile === 'fitted' ? 1.1 : 0.95;
    const brimWidth = 1.05;

    // Elliptical brim
    brimShape.moveTo(-brimWidth, 0);
    brimShape.quadraticCurveTo(-brimWidth, brimLength, 0, brimLength + 0.1);
    brimShape.quadraticCurveTo(brimWidth, brimLength, brimWidth, 0);
    brimShape.quadraticCurveTo(brimWidth * 0.5, -0.15, 0, -0.15);
    brimShape.quadraticCurveTo(-brimWidth * 0.5, -0.15, -brimWidth, 0);

    const brimGeo = new THREE.ExtrudeGeometry(brimShape, {
      depth: 0.04,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 2,
    });

    const brimMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(currentColor),
      roughness: 0.6,
      metalness: 0.05,
    });

    const brim = new THREE.Mesh(brimGeo, brimMat);
    brim.rotation.x = -Math.PI / 2;
    brim.position.set(0, 0.18, 0.3);

    // Curve the brim for non-flat profiles
    if (profile !== 'snapback') {
      brim.rotation.x = -Math.PI / 2 + 0.15;
    }

    brim.castShadow = true;
    hatGroup.add(brim);

    // Mesh back for trucker caps
    if (profile === 'trucker') {
      const meshGeo = new THREE.SphereGeometry(crownRadius - 0.02, 32, 16, Math.PI * 0.3, Math.PI * 1.4, 0, Math.PI * 0.55);
      const mesh = new THREE.Mesh(meshGeo, meshMaterial);
      mesh.position.y = 0.55;
      mesh.castShadow = false;
      hatGroup.add(mesh);
    }

    // Sweatband (inside rim)
    const bandGeo = new THREE.TorusGeometry(crownRadius - 0.02, 0.03, 8, 32);
    const bandMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.position.y = 0.22;
    band.rotation.x = Math.PI / 2;
    hatGroup.add(band);

    // Snapback/closure indicator
    if (profile === 'trucker' || profile === 'snapback') {
      const closureGeo = new THREE.BoxGeometry(0.3, 0.12, 0.05);
      const closureMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 });
      const closure = new THREE.Mesh(closureGeo, closureMat);
      closure.position.set(0, 0.35, -crownRadius + 0.05);
      hatGroup.add(closure);
    }

    // Position hat group
    hatGroup.position.y = -0.3;

    // Add decal if we have one
    if (decalTexture) {
      applyDecal();
    }
  }

  function applyDecal() {
    // Remove existing decal
    const existing = hatGroup.getObjectByName('hatDecal');
    if (existing) hatGroup.remove(existing);

    if (!decalTexture) return;

    const decalGeo = new THREE.PlaneGeometry(0.6, 0.4);
    const decalMat = new THREE.MeshStandardMaterial({
      map: decalTexture,
      transparent: true,
      roughness: 0.5,
      metalness: 0,
      depthWrite: false,
    });

    const decal = new THREE.Mesh(decalGeo, decalMat);
    decal.name = 'hatDecal';
    decal.position.set(0, 0.65, 0.91);
    hatGroup.add(decal);
  }

  // Simple orbit controls without importing OrbitControls
  function initOrbitControls(canvas) {
    let isDragging = false;
    let prevX = 0, prevY = 0;
    let rotY = 0, rotX = 0.2;
    let zoom = 4;

    function onStart(x, y) {
      isDragging = true;
      prevX = x;
      prevY = y;
    }

    function onMove(x, y) {
      if (!isDragging) return;
      const dx = x - prevX;
      const dy = y - prevY;
      rotY += dx * 0.008;
      rotX = Math.max(-0.5, Math.min(1.2, rotX + dy * 0.008));
      prevX = x;
      prevY = y;
      updateCamera();
    }

    function onEnd() {
      isDragging = false;
    }

    function onZoom(delta) {
      zoom = Math.max(2, Math.min(8, zoom + delta * 0.01));
      updateCamera();
    }

    function updateCamera() {
      camera.position.x = zoom * Math.sin(rotY) * Math.cos(rotX);
      camera.position.y = zoom * Math.sin(rotX) + 0.5;
      camera.position.z = zoom * Math.cos(rotY) * Math.cos(rotX);
      camera.lookAt(0, 0.4, 0);
    }

    canvas.addEventListener('mousedown', (e) => onStart(e.clientX, e.clientY));
    canvas.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
    canvas.addEventListener('mouseup', onEnd);
    canvas.addEventListener('mouseleave', onEnd);
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); onZoom(e.deltaY); }, { passive: false });

    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) onStart(e.touches[0].clientX, e.touches[0].clientY);
    });
    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });
    canvas.addEventListener('touchend', onEnd);

    updateCamera();
  }

  function animate() {
    animFrameId = requestAnimationFrame(animate);
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }

  function onResize() {
    if (!container || !renderer || !camera) return;
    const width = container.clientWidth;
    const height = container.clientHeight || width;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  // ---- Public API ----

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
    if (typeof THREE === 'undefined') return;
    if (!imageDataUrl) {
      decalTexture = null;
      const existing = hatGroup?.getObjectByName('hatDecal');
      if (existing) hatGroup.remove(existing);
      return;
    }
    const loader = new THREE.TextureLoader();
    loader.load(imageDataUrl, (texture) => {
      decalTexture = texture;
      applyDecal();
    });
  }

  function destroy() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    if (renderer) {
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    }
    window.removeEventListener('resize', onResize);
  }

  // Auto-init on DOM ready
  function autoInit() {
    const target = document.getElementById('hat-3d-container');
    if (target && typeof THREE !== 'undefined') {
      init('hat-3d-container');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    // Delay to let Three.js load from CDN
    setTimeout(autoInit, 100);
  }

  return { init, updateColor, updateModel, updateDecal, destroy };
})();
