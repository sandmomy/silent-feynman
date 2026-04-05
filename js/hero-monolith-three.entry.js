import * as THREE from 'three';
import diffuseUrl from '../assets/textures/rock_01/rock_01_diff_2k.jpg';
import normalUrl from '../assets/textures/rock_01/rock_01_nor_gl_2k.jpg';
import roughnessUrl from '../assets/textures/rock_01/rock_01_rough_2k.jpg';

function initHeroMonolith() {
  const host = document.getElementById('hero-monolith-scene');
  const mount = host ? host.closest('.hero-p-monolith') : null;
  if (!host || !window.WebGLRenderingContext) return;
  if (mount) mount.setAttribute('data-monolith-ready', 'false');

  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.physicallyCorrectLights = true;
  host.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 30);
  camera.position.set(0, 0.42, 6.7);

  const rig = new THREE.Group();
  scene.add(rig);

  scene.add(new THREE.HemisphereLight(0xd7dce4, 0x05070a, 2));

  const key = new THREE.DirectionalLight(0xf6dfb4, 4.6);
  key.position.set(5, 6.8, 4.8);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x5f7399, 1.25);
  fill.position.set(-4.8, 2.6, -2.2);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 1.9);
  rim.position.set(-1.4, 4.1, 5.8);
  scene.add(rim);

  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  const shadowCtx = shadowCanvas.getContext('2d');
  if (shadowCtx) {
    const gradient = shadowCtx.createRadialGradient(128, 128, 20, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(0,0,0,0.54)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    shadowCtx.fillStyle = gradient;
    shadowCtx.fillRect(0, 0, 256, 256);
  }

  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    opacity: 0.55,
    depthWrite: false
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.28), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  const groundY = -2.65;
  shadow.position.set(0, groundY + 0.01, 0.02);
  scene.add(shadow);

  function renderScene() {
    renderer.render(scene, camera);
  }

  const textureLoader = new THREE.TextureLoader();

  function prepareTexture(tex) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(0.9, 2.45);
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }

  let frontBack;
  let side;
  let topBottom;

  function buildMonolith() {

    const width = 0.94;
    const height = 3.28;
    const depth = 0.5;

    const geometry = new THREE.BoxGeometry(width, height, depth, 8, 34, 8);
    const position = geometry.attributes.position;
    const vertex = new THREE.Vector3();

    // Add subtle stone irregularity while keeping the silhouette straight.
    for (let i = 0; i < position.count; i += 1) {
      vertex.fromBufferAttribute(position, i);
      const yNorm = (vertex.y + height / 2) / height;
      const edgeFactor = Math.max(Math.abs(vertex.x) / (width / 2), Math.abs(vertex.z) / (depth / 2));
      if (edgeFactor > 0.88) {
        vertex.x += Math.sin(vertex.y * 2.1 + vertex.z * 6.5) * 0.01;
        vertex.z += Math.cos(vertex.y * 2.6 + vertex.x * 5.9) * 0.008;
      }
      const taper = THREE.MathUtils.lerp(1.005, 0.975, yNorm);
      vertex.x *= taper;
      position.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();

    frontBack = new THREE.MeshPhysicalMaterial({
      roughness: 0.92,
      metalness: 0.02,
      clearcoat: 0.06,
      clearcoatRoughness: 0.88,
      color: new THREE.Color(0x7b8188),
      normalScale: new THREE.Vector2(1.35, 1.35)
    });

    side = new THREE.MeshPhysicalMaterial({
      roughness: 0.95,
      metalness: 0.01,
      color: new THREE.Color(0x434950),
      normalScale: new THREE.Vector2(1.1, 1.1)
    });

    topBottom = new THREE.MeshPhysicalMaterial({
      roughness: 0.9,
      metalness: 0.01,
      color: new THREE.Color(0x5d646c),
      normalScale: new THREE.Vector2(0.9, 0.9)
    });

    const monolith = new THREE.Mesh(geometry, [
      side,
      side.clone(),
      topBottom,
      topBottom.clone(),
      frontBack,
      frontBack.clone()
    ]);

    // Straight frontal placement and base touching the ground plane.
    monolith.position.set(0, groundY + height / 2, 0);
    monolith.rotation.set(0, 0, 0);
    rig.add(monolith);
    if (mount) mount.setAttribute('data-monolith-ready', 'true');
    renderScene();
  }

  function applyTextures() {
    let loaded = 0;
    let failed = false;
    const readyAfter = 3;
    const textures = { map: null, normalMap: null, roughnessMap: null };

    function onDone() {
      loaded += 1;
      if (loaded < readyAfter || failed) return;

      prepareTexture(textures.map);
      prepareTexture(textures.normalMap);
      prepareTexture(textures.roughnessMap);
      textures.map.colorSpace = THREE.SRGBColorSpace;

      [frontBack, side, topBottom].forEach((material) => {
        if (!material) return;
        material.map = textures.map;
        material.normalMap = textures.normalMap;
        material.roughnessMap = textures.roughnessMap;
        material.needsUpdate = true;
      });
      renderScene();
    }

    function onError() {
      failed = true;
      host.setAttribute('data-monolith-failed', 'true');
      renderScene();
    }

    textures.map = textureLoader.load(diffuseUrl, onDone, undefined, onError);
    textures.normalMap = textureLoader.load(normalUrl, onDone, undefined, onError);
    textures.roughnessMap = textureLoader.load(roughnessUrl, onDone, undefined, onError);
  }

  function resize() {
    const width = host.clientWidth || 220;
    const height = host.clientHeight || 460;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderScene();
  }

  resize();
  if ('ResizeObserver' in window) {
    new ResizeObserver(resize).observe(host);
  } else {
    window.addEventListener('resize', resize);
  }

  buildMonolith();
  applyTextures();
  renderScene();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHeroMonolith, { once: true });
} else {
  initHeroMonolith();
}
