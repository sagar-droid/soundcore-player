/**
 * soundcore Studio Player — 3D Vitrine & WebGL Viewing Engine
 * Features:
 * - High-Resolution PBR Model with 8 Discrete Architectural Components:
 *   - chassis: CNC machined anodized aluminum unibody
 *   - screen_glass: Retina OLED display glass cover with IOR 1.45 transmission
 *   - click_wheel: Tactile micro-beveled circular click wheel ring
 *   - wheel_center: Center tactile mechanical select button
 *   - jack_rings: (misnamed in the GLB) roughly half of the unibody shell, shares the chassis finish
 *   - earbuds: Left and Right in-ear acoustic monitor pieces
 *   - audio_jack: 3.5mm gold-plated jack plug
 *   - wire: Physical flexible audio cable
 * - Interactive Multi-Part Physics & Direct Manipulation:
 *   - Click and drag the Earbuds: picks them up in 3D space, flexing and pulling the cable!
 *   - Click and drag the Audio Jack: unplugs and pulls the cable!
 *   - Click and drag the Player: tilts and shifts the unibody, dangling and swinging the earphones!
 *   - Click and drag the Cable: tugs and bends the wire with real-time elasticity!
 *   - Release any part: springs back into place with natural elastic-damper physics!
 *   - Click background: smooth 360° orbital camera rotation with inertia!
 * - Real-Time Verlet Rope Cable Physics & Dynamic Fluid Wave Ripples.
 * - Dynamic 3D Projected Hotspots: pins are projected in real time to 3D mesh coordinates
 *   and automatically hide when parts are isolated or rotated out of view.
 * - 6-Finish Color Synchronization: updates both player AND earphones simultaneously.
 */

const FINISH_COLORS = {
  orange:    { hex: 0xf06428, name: 'Sunset Orange' },
  spacegray: { hex: 0x38393d, name: 'Space Gray' },
  silver:    { hex: 0xd8dbe0, name: 'Silver' },
  blue:      { hex: 0x1d589c, name: 'Pacific Blue' },
  gold:      { hex: 0xd6bf94, name: 'Champagne Gold' },
  pink:      { hex: 0xe49ca8, name: 'Blush Pink' }
};

// Renderers output sRGB, so hex swatch values must be converted to linear space
const srgb = (hex) => new THREE.Color(hex).convertSRGBToLinear();

class Soundcore3DViewer {
  constructor() {
    this.heroContainer = document.getElementById('hero-3d-container');
    this.studioContainer = document.getElementById('studio-3d-container');
    this.activeColor = 'orange';
    this.currentViewMode = 'all'; // 'all' | 'player' | 'earphones'
    this.explodeFactor = 0;
    this.targetExplodeFactor = 0;
    this.targetCameraDistance = null;

    // Interaction impulse for fluid wire ripple
    this.wireImpulse = 0;

    this.heroScene = null;
    this.heroCamera = null;
    this.heroRenderer = null;
    this.heroModelRoot = null;
    this.heroParts = null;

    this.studioScene = null;
    this.studioCamera = null;
    this.studioRenderer = null;
    this.studioControls = null;
    this.studioModelRoot = null;
    this.studioInnerModel = null;
    this.studioParts = null;
    this.modelCenter = new THREE.Vector3();

    // Direct multi-part interactive drag & spring physics
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.isDraggingPart = false;
    this.activeDraggedPart = null;
    this.hoveredPart = null;
    this.dragPlane = new THREE.Plane();
    this.dragFrame = null;
    this.dragTarget = null;
    this.dragStartLocal = new THREE.Vector3();
    this.dragStartValue = new THREE.Vector3();

    // Physics state for Earbuds & Jack
    this.earbudsPhysPos = new THREE.Vector3();
    this.earbudsPhysVel = new THREE.Vector3();
    this.jackPhysPos = new THREE.Vector3();
    this.jackPhysVel = new THREE.Vector3();
    this.playerPhysOffset = new THREE.Vector3();
    this.playerPhysOffsetVel = new THREE.Vector3();

    // Cable skinning: per-vertex weights to the earbud/jack joints + a draggable grab point
    this.cableEarbudsWeights = null;
    this.cableJackWeights = null;
    this.cableGrabCenter = new THREE.Vector3();
    this.cableGrabOffset = new THREE.Vector3();
    this.cableGrabVel = new THREE.Vector3();
    this.wireAtRest = false;

    // Hotspot elements tracking
    this.hotspotElements = {};

    this.originalPlayerImage = null;
    this.originalPlayerTexture = null;
    this.originalEarphonesTexture = null;
    this.cachedTintedTextures = {};
    this.cachedEarphonesTextures = {};
    this.playerMaterials = [];
    this.earphonesMaterials = [];

    this.init();
  }

  init() {
    if (typeof THREE !== 'undefined') {
      this.initHeroScene();
      this.initStudioScene();

      // Create & apply Apple-style Photorealistic Studio Softbox Environment Map.
      // PMREM output is a render target bound to one WebGL context, so each renderer needs its own.
      if (this.heroScene) this.heroScene.environment = this.createStudioEnvironment(this.heroRenderer);
      if (this.studioScene) this.studioScene.environment = this.createStudioEnvironment(this.studioRenderer);

      this.loadModel('./mp3_player.glb?v=20261104_05');
    } else {
      console.warn('Three.js not detected from CDN. Initializing Canvas fallback.');
      this.initCanvasFallback();
    }

    this.cacheHotspotElements();
    this.bindEvents();
  }

  createStudioEnvironment(renderer) {
    try {
      if (typeof THREE.PMREMGenerator === 'undefined' || !renderer) return null;

      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      pmremGenerator.compileEquirectangularShader();

      // Create an offscreen panorama canvas of an Apple studio vitrine
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');

      // Studio ambient gradient (clean fog white to gentle studio horizon)
      const bg = ctx.createLinearGradient(0, 0, 0, 512);
      bg.addColorStop(0, '#f8f9fa');
      bg.addColorStop(0.35, '#f1f3f5');
      bg.addColorStop(0.65, '#e5e8ec');
      bg.addColorStop(1, '#d8dce2');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 1024, 512);

      // Key Softbox (Top-left 45° warm high-key studio softbox)
      const keySoftbox = ctx.createRadialGradient(280, 160, 20, 280, 160, 260);
      keySoftbox.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      keySoftbox.addColorStop(0.35, 'rgba(255, 252, 248, 0.9)');
      keySoftbox.addColorStop(0.75, 'rgba(248, 250, 252, 0.35)');
      keySoftbox.addColorStop(1, 'rgba(240, 242, 245, 0.0)');
      ctx.fillStyle = keySoftbox;
      ctx.fillRect(0, 0, 600, 360);

      // Rim / Edge Strip Softbox (Gives sleek Apple-style metallic rim highlights)
      const stripSoftbox = ctx.createLinearGradient(680, 100, 920, 260);
      stripSoftbox.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      stripSoftbox.addColorStop(0.5, 'rgba(235, 245, 255, 0.65)');
      stripSoftbox.addColorStop(1, 'rgba(225, 235, 245, 0.0)');
      ctx.fillStyle = stripSoftbox;
      ctx.beginPath();
      ctx.ellipse(800, 180, 160, 65, Math.PI / 6, 0, Math.PI * 2);
      ctx.fill();

      // Top Ceiling Strip (Crisp edge gleam across top chamfers, audio jack and click wheel)
      const topSoftbox = ctx.createRadialGradient(512, 35, 10, 512, 35, 150);
      topSoftbox.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
      topSoftbox.addColorStop(0.6, 'rgba(255, 255, 255, 0.45)');
      topSoftbox.addColorStop(1, 'rgba(240, 242, 245, 0.0)');
      ctx.fillStyle = topSoftbox;
      ctx.fillRect(320, 0, 384, 110);

      // Dark studio floor & horizon flags (give metal surfaces contrast instead of a flat white wash)
      const floor = ctx.createLinearGradient(0, 270, 0, 512);
      floor.addColorStop(0, 'rgba(40, 42, 48, 0.0)');
      floor.addColorStop(0.3, 'rgba(40, 42, 48, 0.75)');
      floor.addColorStop(1, 'rgba(22, 23, 26, 0.95)');
      ctx.fillStyle = floor;
      ctx.fillRect(0, 270, 1024, 242);

      ctx.fillStyle = 'rgba(30, 32, 36, 0.55)';
      ctx.fillRect(560, 60, 70, 260);
      ctx.fillRect(0, 80, 60, 240);

      const tex = new THREE.CanvasTexture(canvas);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const envMap = pmremGenerator.fromEquirectangular(tex).texture;
      tex.dispose();
      pmremGenerator.dispose();
      return envMap;
    } catch (e) {
      console.warn('Studio environment map generation fallback:', e);
      return null;
    }
  }

  /* ==========================================================================
     SHARED RENDERER & LIGHT RIG (Hero and Studio must render finishes identically)
     ========================================================================== */
  createRenderer(width, height) {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      logarithmicDepthBuffer: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    return renderer;
  }

  addStudioLights(scene) {
    // Low ambient keeps form shading; key/rim do the sculpting
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    const key = new THREE.DirectionalLight(0xfffbf2, 1.7);
    key.position.set(4, 7, 6);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xd9e5ff, 0.6);
    fill.position.set(-6, -2, 5);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 1.3);
    rim.position.set(0, 6, -6);
    scene.add(rim);

    // Soft gallery pedestal bounce
    const underBounce = new THREE.DirectionalLight(0xffeedd, 0.25);
    underBounce.position.set(0, -4, 2);
    scene.add(underBounce);
  }

  cacheHotspotElements() {
    this.hotspotElements = {
      screen: document.getElementById('hotspot-screen'),
      wheel: document.getElementById('hotspot-wheel'),
      jack: document.getElementById('hotspot-jack'),
      earbuds: document.getElementById('hotspot-earbuds'),
      wire: document.getElementById('hotspot-wire')
    };
  }

  /* ==========================================================================
     HERO 3D SCENE (Floating Vitrine in Morning Fog)
     ========================================================================== */
  initHeroScene() {
    if (!this.heroContainer) return;

    const width = this.heroContainer.clientWidth || 800;
    const height = this.heroContainer.clientHeight || 500;

    // No fog: it washed the hero finish out relative to the Studio vitrine
    this.heroScene = new THREE.Scene();

    this.heroCamera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
    this.heroCamera.position.set(0, 0.12, 6.8);

    this.heroRenderer = this.createRenderer(width, height);
    this.heroContainer.appendChild(this.heroRenderer.domElement);

    this.addStudioLights(this.heroScene);

    this.setupHeroInteraction();

    const animateHero = () => {
      requestAnimationFrame(animateHero);

      const time = performance.now() * 0.001;

      if (this.heroModelRoot) {
        this.heroModelRoot.position.y = 0.10 + Math.sin(time * 1.1) * 0.04;
        this.heroModelRoot.rotation.y += 0.0015;
      }

      if (this.heroParts && this.heroParts.wire) {
        this.updateWireWavePhysics(this.heroParts.wire, time, this.wireImpulse);
      }

      this.heroRenderer.render(this.heroScene, this.heroCamera);
    };

    animateHero();
  }

  setupHeroInteraction() {
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const dom = this.heroRenderer.domElement;

    dom.addEventListener('pointerdown', (e) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    });

    window.addEventListener('pointermove', (e) => {
      if (!isDragging || !this.heroModelRoot) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;

      this.heroModelRoot.rotation.y += deltaX * 0.008;
      this.heroModelRoot.rotation.x += deltaY * 0.006;

      const speed = Math.hypot(deltaX, deltaY);
      this.wireImpulse = Math.min(this.wireImpulse + speed * 0.05, 4.0);

      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    });

    window.addEventListener('pointerup', () => {
      isDragging = false;
    });

    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoom = e.deltaY * 0.003;
      this.heroCamera.position.z = THREE.MathUtils.clamp(this.heroCamera.position.z + zoom, 4.5, 11.0);
    }, { passive: false });
  }

  /* ==========================================================================
     STUDIO 3D SCENE (Dedicated Vitrine with Interactive Part Physics)
     ========================================================================== */
  initStudioScene() {
    if (!this.studioContainer) return;

    const width = this.studioContainer.clientWidth || 800;
    const height = this.studioContainer.clientHeight || 550;

    this.studioScene = new THREE.Scene();

    this.studioCamera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
    this.defaultStudioDistance = 6.2;
    this.studioCamera.position.set(0, 0.22, this.defaultStudioDistance);

    this.studioRenderer = this.createRenderer(width, height);
    this.studioContainer.appendChild(this.studioRenderer.domElement);

    this.addStudioLights(this.studioScene);

    if (typeof THREE.OrbitControls !== 'undefined') {
      this.studioControls = new THREE.OrbitControls(this.studioCamera, this.studioRenderer.domElement);
      this.studioControls.enableDamping = true;
      this.studioControls.dampingFactor = 0.05;
      // The full cable run is ~8 world units long, so allow pulling back far enough to see it all
      this.studioControls.maxDistance = 22;
      this.studioControls.minDistance = 3.0;
      this.studioControls.enablePan = false;
      // Manual zoom/orbit cancels any automatic camera framing in progress
      this.studioControls.addEventListener('start', () => { this.targetCameraDistance = null; });
    }

    this.setupStudioInteractiveDrag();

    const animateStudio = () => {
      requestAnimationFrame(animateStudio);

      const time = performance.now() * 0.001;

      // Exploded Architecture Lerp
      this.explodeFactor += (this.targetExplodeFactor - this.explodeFactor) * 0.08;
      const f = this.explodeFactor;

      if (this.studioParts) {
        const p = this.studioParts;

        // Explode separation offsets, sized to the ~0.09-unit player body so layers stay readable.
        // jack_rings is half of the body shell, so it travels with the chassis instead of flying off.
        if (p.screenGlass && p.screenGlass.userData.basePos) {
          p.screenGlass.position.y = p.screenGlass.userData.basePos.y + f * 0.04;
        }

        if (p.clickWheel && p.clickWheel.userData.basePos) {
          p.clickWheel.position.y = p.clickWheel.userData.basePos.y + f * 0.022;
        }

        if (p.wheelCenter && p.wheelCenter.userData.basePos) {
          p.wheelCenter.position.y = p.wheelCenter.userData.basePos.y + f * 0.032;
        }

        [p.chassis, p.jackRings].forEach(part => {
          if (part && part.userData.basePos) {
            part.position.y = part.userData.basePos.y - f * 0.012;
          }
        });

        // Apply interactive physics to earbuds, jack, and wire
        this.updateInteractivePartPhysics(time, f);
      }

      // Viscous decay on wave impulse
      this.wireImpulse *= 0.93;
      if (this.wireImpulse < 0.001) this.wireImpulse = 0;

      // Smooth automatic dolly (e.g. pulling back to frame the exploded view)
      if (this.targetCameraDistance != null) {
        const target = this.studioControls ? this.studioControls.target : new THREE.Vector3();
        const offset = this.studioCamera.position.clone().sub(target);
        const dist = offset.length();
        const next = dist + (this.targetCameraDistance - dist) * 0.08;
        this.studioCamera.position.copy(target).add(offset.setLength(next));
        if (Math.abs(this.targetCameraDistance - next) < 0.01) this.targetCameraDistance = null;
      }

      if (this.studioControls && this.studioControls.enabled) {
        this.studioControls.update();
      }

      this.studioRenderer.render(this.studioScene, this.studioCamera);
    };

    animateStudio();
  }

  /* ==========================================================================
     DIRECT MULTI-PART DRAG INTERACTION
     ========================================================================== */
  setupStudioInteractiveDrag() {
    const dom = this.studioRenderer.domElement;

    const getInteractiveMeshes = () => {
      if (!this.studioParts) return [];
      const parts = [];
      const p = this.studioParts;
      if (p.earbuds && p.earbuds.visible) parts.push(p.earbuds);
      if (p.audioJack && p.audioJack.visible) parts.push(p.audioJack);
      if (p.wire && p.wire.visible) parts.push(p.wire);
      if (p.chassis && p.chassis.visible) parts.push(p.chassis);
      if (p.jackRings && p.jackRings.visible) parts.push(p.jackRings);
      if (p.screenGlass && p.screenGlass.visible) parts.push(p.screenGlass);
      if (p.clickWheel && p.clickWheel.visible) parts.push(p.clickWheel);
      return parts;
    };

    const updateMouseCoords = (e) => {
      const rect = dom.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    dom.addEventListener('pointermove', (e) => {
      updateMouseCoords(e);

      if (this.isDraggingPart && this.activeDraggedPart) {
        // Dragging an interactive 3D part: move it by the pointer's delta since grab,
        // measured in a frame that the drag itself does not move (avoids feedback jitter)
        this.raycaster.setFromCamera(this.mouse, this.studioCamera);
        const intersect = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.dragPlane, intersect)) {
          const delta = this.dragFrame.worldToLocal(intersect).sub(this.dragStartLocal);
          this.dragTarget.copy(this.dragStartValue).add(delta);
          this.wireImpulse = Math.min(this.wireImpulse + 0.3, 4.0);
        }
      } else {
        // Hover raycasting
        this.raycaster.setFromCamera(this.mouse, this.studioCamera);
        const meshes = getInteractiveMeshes();
        const intersects = this.raycaster.intersectObjects(meshes, false);

        if (intersects.length > 0) {
          dom.style.cursor = 'grab';
          this.hoveredPart = intersects[0].object;
        } else {
          dom.style.cursor = 'default';
          this.hoveredPart = null;
        }
      }
    });

    dom.addEventListener('pointerdown', (e) => {
      updateMouseCoords(e);
      this.raycaster.setFromCamera(this.mouse, this.studioCamera);
      const meshes = getInteractiveMeshes();
      const intersects = this.raycaster.intersectObjects(meshes, false);

      if (intersects.length > 0) {
        const hit = intersects[0];
        const p = this.studioParts;
        this.isDraggingPart = true;
        this.activeDraggedPart = hit.object;

        if (this.studioControls) {
          this.studioControls.enabled = false;
        }
        this.targetCameraDistance = null;

        dom.style.cursor = 'grabbing';

        // Setup interaction plane facing the camera
        const planeNormal = this.studioCamera.getWorldDirection(new THREE.Vector3()).negate();
        this.dragPlane.setFromNormalAndCoplanarPoint(planeNormal, hit.point);

        // Pick which physics value this drag drives, and the (stationary) frame to measure in
        if (hit.object === p.earbuds) {
          this.dragFrame = p.earbuds.parent;
          this.dragTarget = this.earbudsPhysPos;
        } else if (hit.object === p.audioJack) {
          this.dragFrame = p.audioJack.parent;
          this.dragTarget = this.jackPhysPos;
        } else if (hit.object === p.wire) {
          this.dragFrame = p.wire.parent;
          this.dragTarget = this.cableGrabOffset;
          this.cableGrabCenter.copy(p.wire.parent.worldToLocal(hit.point.clone())).sub(this.cableGrabOffset);
        } else {
          // Player unibody moves the whole inner model, so measure in the fixed pivot frame
          this.dragFrame = this.studioModelRoot;
          this.dragTarget = this.playerPhysOffset;
        }
        this.dragStartLocal.copy(this.dragFrame.worldToLocal(hit.point.clone()));
        this.dragStartValue.copy(this.dragTarget);
      }
    });

    window.addEventListener('pointerup', () => {
      if (this.isDraggingPart) {
        this.isDraggingPart = false;
        this.activeDraggedPart = null;

        if (this.studioControls) {
          this.studioControls.enabled = true;
        }

        dom.style.cursor = this.hoveredPart ? 'grab' : 'default';
      }
    });
  }

  /* ==========================================================================
     CABLE SKINNING & SPRING PHYSICS
     Wire vertices are weighted by distance to the earbud and jack joints, so the cable
     follows those parts exactly where it meets them and can never tear apart.
     ========================================================================== */
  initCablePhysics(parts) {
    if (!parts || !parts.earbuds || !parts.audioJack || !parts.wire) return;

    const orig = parts.wire.geometry.userData.origPositions;
    const wireIndex = parts.wire.geometry.index.array;
    const wireVerts = Array.from(new Set(wireIndex));

    // Junctions: earbud / jack vertices that sit on the wire (all three share one vertex space)
    const findJunctions = (mesh, tolerance) => {
      const cell = tolerance;
      const grid = new Map();
      const key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
      for (const i of wireVerts) {
        const k = key(orig[i * 3], orig[i * 3 + 1], orig[i * 3 + 2]);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(i);
      }
      const junctions = [];
      for (const i of new Set(mesh.geometry.index.array)) {
        const x = orig[i * 3], y = orig[i * 3 + 1], z = orig[i * 3 + 2];
        const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
        let near = false;
        for (let dx = -1; dx <= 1 && !near; dx++) {
          for (let dy = -1; dy <= 1 && !near; dy++) {
            for (let dz = -1; dz <= 1 && !near; dz++) {
              const bucket = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
              if (bucket && bucket.some(j => Math.hypot(orig[j * 3] - x, orig[j * 3 + 1] - y, orig[j * 3 + 2] - z) < tolerance)) {
                near = true;
              }
            }
          }
        }
        if (near) junctions.push([x, y, z]);
      }
      return junctions;
    };

    const weightsFor = (junctions, radius) => {
      const w = new Float32Array(orig.length / 3);
      if (junctions.length === 0) return w;
      for (const i of wireVerts) {
        const x = orig[i * 3], y = orig[i * 3 + 1], z = orig[i * 3 + 2];
        let d = Infinity;
        for (const j of junctions) d = Math.min(d, Math.hypot(j[0] - x, j[1] - y, j[2] - z));
        const t = THREE.MathUtils.clamp(1 - d / radius, 0, 1);
        w[i] = t * t * (3 - 2 * t); // smoothstep falloff
      }
      return w;
    };

    this.cableEarbudsWeights = weightsFor(findJunctions(parts.earbuds, 0.002), 0.1);
    this.cableJackWeights = weightsFor(findJunctions(parts.audioJack, 0.002), 0.06);

    this.earbudsPhysPos.copy(parts.earbuds.userData.basePos);
    this.jackPhysPos.copy(parts.audioJack.userData.basePos);
    this.earbudsPhysVel.set(0, 0, 0);
    this.jackPhysVel.set(0, 0, 0);
    this.playerPhysOffset.set(0, 0, 0);
    this.playerPhysOffsetVel.set(0, 0, 0);
    this.cableGrabOffset.set(0, 0, 0);
    this.cableGrabVel.set(0, 0, 0);
    this.wireAtRest = false;
  }

  // Critically-damped-ish spring toward target (skipped while that value is being dragged)
  springTo(pos, vel, target, stiffness, damping) {
    vel.x = (vel.x + (target.x - pos.x) * stiffness) * damping;
    vel.y = (vel.y + (target.y - pos.y) * stiffness) * damping;
    vel.z = (vel.z + (target.z - pos.z) * stiffness) * damping;
    pos.add(vel);
    if (vel.lengthSq() < 1e-14 && pos.distanceToSquared(target) < 1e-12) {
      pos.copy(target);
      vel.set(0, 0, 0);
    }
  }

  updateInteractivePartPhysics(time, explodeFactor) {
    const p = this.studioParts;
    const dragged = this.isDraggingPart ? this.dragTarget : null;

    // 1. Earbuds
    const earbudsTarget = p.earbuds.userData.basePos.clone();
    earbudsTarget.x -= explodeFactor * 0.06;
    earbudsTarget.y += explodeFactor * 0.03;
    if (dragged !== this.earbudsPhysPos) {
      this.springTo(this.earbudsPhysPos, this.earbudsPhysVel, earbudsTarget, 0.14, 0.82);
    }
    p.earbuds.position.copy(this.earbudsPhysPos);

    // 2. Audio Jack
    const jackTarget = p.audioJack.userData.basePos.clone();
    jackTarget.x += explodeFactor * 0.03;
    jackTarget.y -= explodeFactor * 0.02;
    if (dragged !== this.jackPhysPos) {
      this.springTo(this.jackPhysPos, this.jackPhysVel, jackTarget, 0.16, 0.8);
    }
    p.audioJack.position.copy(this.jackPhysPos);

    // 3. Player unibody (moves the whole inner model)
    const zero = new THREE.Vector3();
    if (dragged !== this.playerPhysOffset) {
      this.springTo(this.playerPhysOffset, this.playerPhysOffsetVel, zero, 0.15, 0.8);
    }
    if (this.studioInnerModel) {
      this.studioInnerModel.position.set(
        -this.modelCenter.x + this.playerPhysOffset.x,
        -this.modelCenter.y + this.playerPhysOffset.y,
        -this.modelCenter.z + this.playerPhysOffset.z
      );
    }

    // 4. Cable grab point
    if (dragged !== this.cableGrabOffset) {
      this.springTo(this.cableGrabOffset, this.cableGrabVel, zero, 0.12, 0.8);
    }

    // 5. Skin the wire. Skip rewriting it once everything has settled (a static mesh can't shimmer)
    const earbudsDelta = this.earbudsPhysPos.clone().sub(p.earbuds.userData.basePos);
    const jackDelta = this.jackPhysPos.clone().sub(p.audioJack.userData.basePos);
    const settled = earbudsDelta.lengthSq() === 0 && jackDelta.lengthSq() === 0 &&
      this.cableGrabOffset.lengthSq() === 0 && this.wireImpulse === 0 && !this.isDraggingPart;
    if (settled && this.wireAtRest) return;
    this.wireAtRest = settled;

    if (!p.wire || !p.wire.geometry || !p.wire.geometry.userData.origPositions || !this.cableEarbudsWeights) return;

    const posAttr = p.wire.geometry.attributes.position;
    const arr = posAttr.array;
    const orig = p.wire.geometry.userData.origPositions;
    const we = this.cableEarbudsWeights;
    const wj = this.cableJackWeights;
    const g = this.cableGrabOffset;
    const gc = this.cableGrabCenter;
    const grabSigma2 = 2 * 0.04 * 0.04;
    const hasGrab = g.lengthSq() > 0;
    const rippleAmp = Math.min(this.wireImpulse, 4.0) * 0.00025;

    for (let i = 0; i < posAttr.count; i++) {
      const idx = i * 3;
      const ox = orig[idx];
      const oy = orig[idx + 1];
      const oz = orig[idx + 2];

      let dx = we[i] * earbudsDelta.x + wj[i] * jackDelta.x;
      let dy = we[i] * earbudsDelta.y + wj[i] * jackDelta.y;
      let dz = we[i] * earbudsDelta.z + wj[i] * jackDelta.z;

      if (hasGrab) {
        const d2 = (ox - gc.x) ** 2 + (oy - gc.y) ** 2 + (oz - gc.z) ** 2;
        const wg = Math.exp(-d2 / grabSigma2);
        dx += wg * g.x;
        dy += wg * g.y;
        dz += wg * g.z;
      }

      // Interaction ripple, decaying with the impulse and pinned to zero at the joints
      if (rippleAmp > 0) {
        const free = 1 - Math.max(we[i], wj[i]);
        dy += Math.sin(ox * 28.0 + oz * 16.0 + time * 3.4) * rippleAmp * free;
        dx += Math.cos(oz * 22.0 + time * 2.8) * rippleAmp * free;
      }

      arr[idx]     = ox + dx;
      arr[idx + 1] = oy + dy;
      arr[idx + 2] = oz + dz;
    }

    posAttr.needsUpdate = true;
  }

  /* ==========================================================================
     DYNAMIC 3D-PROJECTED HOTSPOTS (Disabled per user request - removes black dots)
     ========================================================================== */
  update3DHotspots() {
    if (this.hotspotElements) {
      Object.values(this.hotspotElements).forEach(pin => {
        if (pin) pin.style.display = 'none';
      });
    }
  }

  updateWireWavePhysics(wireMesh, time, impulse) {
    if (!wireMesh || !wireMesh.geometry || !wireMesh.geometry.userData.origPositions) return;

    const posAttr = wireMesh.geometry.attributes.position;
    const orig = wireMesh.geometry.userData.origPositions;
    const arr = posAttr.array;

    const imp = impulse || 0;
    const speed = time * 3.4;

    for (let i = 0; i < posAttr.count; i++) {
      const idx = i * 3;
      const ox = orig[idx];
      const oy = orig[idx + 1];
      const oz = orig[idx + 2];

      const waveY = Math.sin(ox * 28.0 + oz * 16.0 + speed + imp * 2.2) * 0.0036
                  + Math.cos(oz * 22.0 - speed * 0.8) * 0.0028
                  + Math.sin((ox + oz) * 36.0 + speed * 1.3) * 0.0018;

      const waveX = Math.cos(oz * 24.0 + speed * 0.9 + imp * 1.6) * 0.0030;
      const waveZ = Math.sin(ox * 18.0 - speed * 0.7) * 0.0026;

      arr[idx]     = ox + waveX;
      arr[idx + 1] = oy + waveY;
      arr[idx + 2] = oz + waveZ;
    }

    posAttr.needsUpdate = true;
  }

  extractParts(rootNode) {
    const chassis = rootNode.getObjectByName('chassis');
    const screenGlass = rootNode.getObjectByName('screen_glass');
    const clickWheel = rootNode.getObjectByName('click_wheel');
    const wheelCenter = rootNode.getObjectByName('wheel_center');
    const jackRings = rootNode.getObjectByName('jack_rings');
    const earbuds = rootNode.getObjectByName('earbuds');
    const audioJack = rootNode.getObjectByName('audio_jack');
    const wire = rootNode.getObjectByName('wire');

    const parts = { chassis, screenGlass, clickWheel, wheelCenter, jackRings, earbuds, audioJack, wire };

    for (const key in parts) {
      const part = parts[key];
      if (part) {
        part.userData.basePos = part.position.clone();
        part.userData.baseRot = part.rotation.clone();
      }
    }

    if (wire && wire.geometry && wire.geometry.attributes.position) {
      wire.geometry.userData.origPositions = new Float32Array(wire.geometry.attributes.position.array);
    }

    return parts;
  }

  /* ==========================================================================
     PHYSICAL PBR MATERIALS (True Apple CNC Aluminum, White Wheel, Glass, Silicone)
     ========================================================================== */
  setupMeshMaterials(rootNode, colorKey = 'orange') {
    const pal = FINISH_COLORS[colorKey] || FINISH_COLORS.orange;
    const parts = this.extractParts(rootNode);

    // 1. Chassis: CNC Aerospace Anodized Aluminum in selected finish, with a lacquer clearcoat for crisp highlights.
    //    The GLB's "jack_rings" primitive actually covers roughly half of the unibody shell
    //    (8k verts spanning the full chassis bounds), so it shares the body material.
    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: srgb(pal.hex),
      roughness: 0.35,
      metalness: 0.55,
      clearcoat: 0.6,
      clearcoatRoughness: 0.12,
      envMapIntensity: 0.9,
      side: THREE.DoubleSide
    });
    if (parts.chassis) parts.chassis.material = bodyMaterial;
    if (parts.jackRings) parts.jackRings.material = bodyMaterial;

    // 2. Click Wheel: Pure Apple Matte White Polycarbonate
    if (parts.clickWheel) {
      parts.clickWheel.material = new THREE.MeshStandardMaterial({
        color: srgb(0xf4f4f6),
        roughness: 0.38,
        metalness: 0.10,
        envMapIntensity: 0.85,
        side: THREE.DoubleSide
      });
    }

    // 3. Wheel Center: Crisp central selection button
    if (parts.wheelCenter) {
      parts.wheelCenter.material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.32,
        metalness: 0.12,
        envMapIntensity: 0.90,
        side: THREE.DoubleSide
      });
    }

    // 4. Retina Display Glass: Deep glossy OLED display glass reflecting studio softbox
    if (parts.screenGlass) {
      parts.screenGlass.material = new THREE.MeshStandardMaterial({
        color: srgb(0x06080c),
        roughness: 0.04,
        metalness: 0.18,
        transparent: true,
        opacity: 0.88,
        envMapIntensity: 2.5,
        side: THREE.DoubleSide
      });
    }

    // 5. Earbuds: Precision dynamic acoustic drivers in matching finish
    if (parts.earbuds) {
      parts.earbuds.material = new THREE.MeshPhysicalMaterial({
        color: srgb(pal.hex),
        roughness: 0.32,
        metalness: 0.5,
        clearcoat: 0.6,
        clearcoatRoughness: 0.12,
        envMapIntensity: 0.9,
        side: THREE.DoubleSide
      });
    }

    // 6. Audio Jack: Precision machined metal collar in matching finish
    if (parts.audioJack) {
      parts.audioJack.material = new THREE.MeshStandardMaterial({
        color: srgb(pal.hex),
        roughness: 0.16,
        metalness: 0.92,
        envMapIntensity: 2.0,
        side: THREE.DoubleSide
      });
    }

    // 7. Audio Cable: Clean Apple silicone white with soft matte drape (Zero rainbow, zero magenta)
    if (parts.wire) {
      parts.wire.material = new THREE.MeshStandardMaterial({
        color: srgb(0xf2f2f5),
        roughness: 0.88,
        metalness: 0.02,
        envMapIntensity: 0.35,
        side: THREE.DoubleSide
      });
    }

    return parts;
  }

  /* ==========================================================================
     MODEL LOADER (Loads partitioned mp3_player.glb)
     ========================================================================== */
  loadModel(urlOrFile, modelName = 'soundcore Studio Player') {
    if (typeof THREE.GLTFLoader === 'undefined') {
      setTimeout(() => this.loadModel(urlOrFile, modelName), 300);
      return;
    }

    const loader = new THREE.GLTFLoader();
    loader.load(
      urlOrFile,
      (gltf) => {
        this.loadedGlb = gltf.scene;

        // Compute Bounding Box & Target Scale
        const bbox = new THREE.Box3().setFromObject(this.loadedGlb);
        const center = bbox.getCenter(new THREE.Vector3());
        this.modelCenter.copy(center);
        const size = bbox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const targetScale = 6.6 / (maxDim || 1);

        // Mount to Hero Scene
        this.setupHeroGlbModel(center, targetScale);

        // Mount to Studio Scene
        this.setupStudioGlbModel(center, targetScale);

        // Immediately apply active finish (orange by default)
        this.updateColors(this.activeColor || 'orange');

        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toast-message');
        if (toast && toastMessage) {
          toastMessage.textContent = `soundcore Studio Player & Earphones Ready`;
          toast.classList.add('active');
          setTimeout(() => toast.classList.remove('active'), 3500);
        }
      },
      undefined,
      (err) => {
        console.error('Error loading GLTF model:', err);
      }
    );
  }

  setupHeroGlbModel(center, targetScale) {
    if (!this.heroScene || !this.loadedGlb) return;

    if (this.heroModelRoot) {
      this.heroScene.remove(this.heroModelRoot);
    }

    const heroPivot = new THREE.Group();
    const heroInner = this.loadedGlb.clone();

    this.heroParts = this.setupMeshMaterials(heroInner, this.activeColor || 'orange');

    heroInner.position.set(-center.x, -center.y, -center.z);
    heroPivot.add(heroInner);

    const scale = targetScale * 1.25;
    heroPivot.scale.set(scale, scale, scale);
    heroPivot.rotation.set(-Math.PI / 2.22, 0.20, -0.06);
    heroPivot.position.set(0.65, 0.10, 0);

    this.heroModelRoot = heroPivot;
    this.heroScene.add(this.heroModelRoot);
  }

  setupStudioGlbModel(center, targetScale) {
    if (!this.studioScene || !this.loadedGlb) return;

    if (this.studioModelRoot) {
      this.studioScene.remove(this.studioModelRoot);
    }

    const studioPivot = new THREE.Group();
    const studioInner = this.loadedGlb.clone();
    // Object3D.clone() shares geometry, and the GLB's earbuds/audio_jack/wire share one vertex
    // buffer. Give the Studio its own copies so wire deformation (here or in the hero) can't
    // leak into the earbuds and jack.
    ['wire', 'earbuds', 'audio_jack'].forEach(name => {
      const mesh = studioInner.getObjectByName(name);
      if (mesh) mesh.geometry = mesh.geometry.clone();
    });

    this.studioParts = this.setupMeshMaterials(studioInner, this.activeColor || 'orange');

    studioInner.position.set(-center.x, -center.y, -center.z);
    studioPivot.add(studioInner);

    const scale = targetScale * 1.30;
    studioPivot.scale.set(scale, scale, scale);
    studioPivot.rotation.set(-Math.PI / 2.22, 0.22, -0.06);
    studioPivot.position.set(0, 0.05, 0);

    this.initCablePhysics(this.studioParts);

    this.studioModelRoot = studioPivot;
    this.studioInnerModel = studioInner;

    this.studioScene.add(this.studioModelRoot);
  }

  /* ==========================================================================
     COLOR TRANSFORMATION (Shift player AND earphones in real-time)
     ========================================================================== */
  updateColors(colorKey) {
    this.activeColor = colorKey;
    const pal = FINISH_COLORS[colorKey] || FINISH_COLORS.orange;

    const color = srgb(pal.hex);

    [this.heroParts, this.studioParts].forEach(parts => {
      if (!parts) return;
      // chassis & jackRings share one body material
      [parts.chassis, parts.earbuds, parts.audioJack].forEach(part => {
        if (part && part.material) part.material.color.copy(color);
      });
    });
  }

  /* ==========================================================================
     VIEW MODES (All vs Player Focus vs Earphones Focus)
     ========================================================================== */
  setViewMode(mode) {
    this.currentViewMode = mode;
    if (!this.studioParts) return;

    const p = this.studioParts;
    const playerParts = [p.chassis, p.screenGlass, p.clickWheel, p.wheelCenter, p.jackRings];
    const earphoneParts = [p.earbuds, p.audioJack, p.wire];

    if (mode === 'all') {
      playerParts.forEach(part => { if (part) part.visible = true; });
      earphoneParts.forEach(part => { if (part) part.visible = true; });
    } else if (mode === 'player') {
      playerParts.forEach(part => { if (part) part.visible = true; });
      earphoneParts.forEach(part => { if (part) part.visible = false; });
    } else if (mode === 'earphones') {
      playerParts.forEach(part => { if (part) part.visible = false; });
      earphoneParts.forEach(part => { if (part) part.visible = true; });
    }

    this.update3DHotspots();
  }

  /* ==========================================================================
     EVENT BINDINGS
     ========================================================================== */
  bindEvents() {
    const btnAssembled = document.getElementById('btn-view-assembled');
    const btnExploded = document.getElementById('btn-view-exploded');
    const btnPlayer = document.getElementById('btn-view-player');
    const btnEarphones = document.getElementById('btn-view-earphones');
    const btnReset = document.getElementById('btn-reset-camera');
    const legend = document.getElementById('exploded-legend');

    if (btnAssembled) {
      btnAssembled.addEventListener('click', () => {
        this.setModeButtons(btnAssembled);
        this.targetExplodeFactor = 0;
        this.targetCameraDistance = this.defaultStudioDistance;
        this.setViewMode('all');
        if (legend) legend.classList.remove('active');
      });
    }

    if (btnExploded) {
      btnExploded.addEventListener('click', () => {
        this.setModeButtons(btnExploded);
        this.targetExplodeFactor = 1.0;
        this.setViewMode('all');
        if (legend) legend.classList.add('active');
        this.wireImpulse = 2.5;
        this.targetCameraDistance = this.getStudioFitDistance();
      });
    }

    if (btnPlayer) {
      btnPlayer.addEventListener('click', () => {
        this.setModeButtons(btnPlayer);
        this.targetExplodeFactor = 0;
        this.setViewMode('player');
        if (legend) legend.classList.remove('active');
      });
    }

    if (btnEarphones) {
      btnEarphones.addEventListener('click', () => {
        this.setModeButtons(btnEarphones);
        this.targetExplodeFactor = 0;
        this.setViewMode('earphones');
        if (legend) legend.classList.remove('active');
        this.wireImpulse = 3.0;
      });
    }

    if (btnReset && this.studioCamera) {
      btnReset.addEventListener('click', () => {
        this.targetCameraDistance = null;
        if (this.studioControls) this.studioControls.reset();
        this.targetExplodeFactor = 0;
        this.setViewMode('all');
        if (btnAssembled) this.setModeButtons(btnAssembled);
        if (legend) legend.classList.remove('active');
      });
    }

    window.addEventListener('resize', () => {
      this.handleResize();
    });
  }

  // Camera distance that fits the whole Studio model (cable, earbuds, player) in the viewport
  getStudioFitDistance() {
    if (!this.studioModelRoot) return this.defaultStudioDistance;
    const size = new THREE.Box3().setFromObject(this.studioModelRoot).getSize(new THREE.Vector3());
    const halfTan = Math.tan(THREE.MathUtils.degToRad(this.studioCamera.fov) / 2);
    const halfHeight = Math.max(size.y, size.x / this.studioCamera.aspect) / 2;
    const fit = halfHeight / halfTan * 0.95;
    return THREE.MathUtils.clamp(fit, this.defaultStudioDistance, this.studioControls ? this.studioControls.maxDistance : fit);
  }

  setModeButtons(activeBtn) {
    const btns = document.querySelectorAll('.toolbar-pill-btn');
    btns.forEach(b => b.classList.remove('active'));
    activeBtn.classList.add('active');
  }

  handleResize() {
    if (this.heroContainer && this.heroRenderer && this.heroCamera) {
      const w = this.heroContainer.clientWidth;
      const h = this.heroContainer.clientHeight;
      this.heroCamera.aspect = w / h;
      this.heroCamera.updateProjectionMatrix();
      this.heroRenderer.setSize(w, h);
    }

    if (this.studioContainer && this.studioRenderer && this.studioCamera) {
      const w = this.studioContainer.clientWidth;
      const h = this.studioContainer.clientHeight;
      this.studioCamera.aspect = w / h;
      this.studioCamera.updateProjectionMatrix();
      this.studioRenderer.setSize(w, h);
      this.update3DHotspots();
    }
  }

  initCanvasFallback() {
    [this.heroContainer, this.studioContainer].forEach(container => {
      if (!container) return;
      const canvas = document.createElement('canvas');
      canvas.width = container.clientWidth || 800;
      canvas.height = container.clientHeight || 500;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      container.appendChild(canvas);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#2e2e32';
      ctx.fillRect(container.clientWidth / 2 - 50, container.clientHeight / 2 - 80, 100, 160);
    });
  }
}

// Instantiate viewer after DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.soundcoreViewer = new Soundcore3DViewer();
});
