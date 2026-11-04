/**
 * soundcore Studio Player — 3D Vitrine & WebGL Viewing Engine
 * Features:
 * - High-Resolution PBR Model with 8 Discrete Architectural Components:
 *   - chassis: CNC machined anodized aluminum unibody
 *   - screen_glass: Retina OLED display glass cover with IOR 1.45 transmission
 *   - click_wheel: Tactile micro-beveled circular click wheel ring
 *   - wheel_center: Center tactile mechanical select button
 *   - jack_rings: Gold-plated dual headphone output ports & internal chamber
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

class Soundcore3DViewer {
  constructor() {
    this.heroContainer = document.getElementById('hero-3d-container');
    this.studioContainer = document.getElementById('studio-3d-container');
    this.activeColor = 'orange';
    this.currentViewMode = 'all'; // 'all' | 'player' | 'earphones'
    this.explodeFactor = 0;
    this.targetExplodeFactor = 0;

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
    this.dragPlaneOffset = new THREE.Vector3();

    // Physics state for Earbuds & Jack
    this.earbudsPhysPos = new THREE.Vector3();
    this.earbudsPhysVel = new THREE.Vector3();
    this.jackPhysPos = new THREE.Vector3();
    this.jackPhysVel = new THREE.Vector3();
    this.playerPhysOffset = new THREE.Vector3();
    this.playerPhysOffsetVel = new THREE.Vector3();

    // Cable Verlet Physics Nodes (chain connecting Jack -> Cable -> Earbuds)
    this.numCableNodes = 16;
    this.cableNodes = [];
    this.cableRestLengths = [];
    this.cableGrabNodeIndex = -1;

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

      // Create & apply Apple-style Photorealistic Studio Softbox Environment Map
      this.studioEnvMap = this.createStudioEnvironment(this.heroRenderer);
      if (this.studioEnvMap) {
        if (this.heroScene) this.heroScene.environment = this.studioEnvMap;
        if (this.studioScene) this.studioScene.environment = this.studioEnvMap;
      }

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

      // Gallery Pedestal Ground Bounce (Simulates pure white acrylic reflection)
      const groundBounce = ctx.createLinearGradient(0, 410, 0, 512);
      groundBounce.addColorStop(0, 'rgba(245, 245, 247, 0.0)');
      groundBounce.addColorStop(1, 'rgba(255, 255, 255, 0.6)');
      ctx.fillStyle = groundBounce;
      ctx.fillRect(0, 410, 1024, 102);

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

    this.heroScene = new THREE.Scene();
    this.heroScene.fog = new THREE.FogExp2(0xf5f5f7, 0.04);

    this.heroCamera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
    this.heroCamera.position.set(0, 0.12, 6.8);

    this.heroRenderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      logarithmicDepthBuffer: true
    });
    this.heroRenderer.setSize(width, height);
    this.heroRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.heroRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.heroRenderer.toneMappingExposure = 1.15;

    this.heroContainer.appendChild(this.heroRenderer.domElement);

    const amb = new THREE.AmbientLight(0xffffff, 1.25);
    this.heroScene.add(amb);

    const key = new THREE.DirectionalLight(0xfffbf2, 1.35);
    key.position.set(4, 7, 6);
    this.heroScene.add(key);

    const fill = new THREE.DirectionalLight(0xd9e5ff, 0.75);
    fill.position.set(-6, -2, 5);
    this.heroScene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.95);
    rim.position.set(0, 6, -6);
    this.heroScene.add(rim);

    // Soft gallery pedestal bounce
    const underBounce = new THREE.DirectionalLight(0xffeedd, 0.35);
    underBounce.position.set(0, -4, 2);
    this.heroScene.add(underBounce);

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
    this.studioCamera.position.set(0, 0.22, 6.2);

    this.studioRenderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      logarithmicDepthBuffer: true
    });
    this.studioRenderer.setSize(width, height);
    this.studioRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.studioRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.studioRenderer.toneMappingExposure = 1.15;

    this.studioContainer.appendChild(this.studioRenderer.domElement);

    const amb = new THREE.AmbientLight(0xffffff, 1.25);
    this.studioScene.add(amb);

    const dir1 = new THREE.DirectionalLight(0xfffbf2, 1.35);
    dir1.position.set(4, 7, 6);
    this.studioScene.add(dir1);

    const dir2 = new THREE.DirectionalLight(0xd9e5ff, 0.75);
    dir2.position.set(-5, -2, 4);
    this.studioScene.add(dir2);

    const rim = new THREE.DirectionalLight(0xffffff, 0.95);
    rim.position.set(0, 5, -5);
    this.studioScene.add(rim);

    // Subtle bottom bounce
    const underBounce = new THREE.DirectionalLight(0xffeedd, 0.35);
    underBounce.position.set(0, -4, 2);
    this.studioScene.add(underBounce);

    if (typeof THREE.OrbitControls !== 'undefined') {
      this.studioControls = new THREE.OrbitControls(this.studioCamera, this.studioRenderer.domElement);
      this.studioControls.enableDamping = true;
      this.studioControls.dampingFactor = 0.05;
      this.studioControls.maxDistance = 11;
      this.studioControls.minDistance = 4.0;
      this.studioControls.enablePan = false;
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

        // Explode separation offsets (Generous architectural float)
        if (p.screenGlass && p.screenGlass.userData.basePos) {
          p.screenGlass.position.y = p.screenGlass.userData.basePos.y + f * 0.16;
          p.screenGlass.position.z = p.screenGlass.userData.basePos.z - f * 0.015;
        }

        if (p.clickWheel && p.clickWheel.userData.basePos) {
          p.clickWheel.position.y = p.clickWheel.userData.basePos.y + f * 0.095;
        }

        if (p.wheelCenter && p.wheelCenter.userData.basePos) {
          p.wheelCenter.position.y = p.wheelCenter.userData.basePos.y + f * 0.135;
        }

        if (p.jackRings && p.jackRings.userData.basePos) {
          p.jackRings.position.z = p.jackRings.userData.basePos.z - f * 0.11;
        }

        if (p.chassis && p.chassis.userData.basePos) {
          p.chassis.position.y = p.chassis.userData.basePos.y - f * 0.045;
        }

        // Apply interactive physics to earbuds, jack, and wire
        this.updateInteractivePartPhysics(time, f);
      }

      // Viscous decay on wave impulse
      this.wireImpulse *= 0.93;

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
        // Dragging an interactive 3D part
        this.raycaster.setFromCamera(this.mouse, this.studioCamera);
        const intersect = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.dragPlane, intersect)) {
          intersect.sub(this.dragPlaneOffset);

          // Convert to local coordinates within studioInnerModel
          if (this.studioInnerModel) {
            const localTarget = this.studioInnerModel.worldToLocal(intersect);

            if (this.activeDraggedPart === this.studioParts.earbuds) {
              this.earbudsPhysPos.copy(localTarget);
              this.wireImpulse = Math.min(this.wireImpulse + 0.35, 4.5);
            } else if (this.activeDraggedPart === this.studioParts.audioJack) {
              this.jackPhysPos.copy(localTarget);
              this.wireImpulse = Math.min(this.wireImpulse + 0.35, 4.5);
            } else if (this.activeDraggedPart === this.studioParts.wire) {
              if (this.cableGrabNodeIndex >= 0 && this.cableGrabNodeIndex < this.cableNodes.length) {
                this.cableNodes[this.cableGrabNodeIndex].x = localTarget.x;
                this.cableNodes[this.cableGrabNodeIndex].y = localTarget.y;
                this.cableNodes[this.cableGrabNodeIndex].z = localTarget.z;
              }
              this.wireImpulse = Math.min(this.wireImpulse + 0.30, 4.0);
            } else {
              // Dragging the player unibody (chassis / wheel / screen)
              const base = this.studioParts.chassis.userData.basePos;
              this.playerPhysOffset.copy(localTarget).sub(base);
              this.wireImpulse = Math.min(this.wireImpulse + 0.25, 4.0);
            }
          }
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
        this.isDraggingPart = true;
        this.activeDraggedPart = hit.object;

        if (this.studioControls) {
          this.studioControls.enabled = false;
        }

        dom.style.cursor = 'grabbing';

        // Setup interaction plane facing the camera
        const planeNormal = this.studioCamera.getWorldDirection(new THREE.Vector3()).negate();
        this.dragPlane.setFromNormalAndCoplanarPoint(planeNormal, hit.point);

        const objWorldPos = hit.object.getWorldPosition(new THREE.Vector3());
        this.dragPlaneOffset.copy(hit.point).sub(objWorldPos);

        // If wire clicked, grab the closest node
        if (this.activeDraggedPart === this.studioParts.wire && this.studioInnerModel) {
          const localHit = this.studioInnerModel.worldToLocal(hit.point.clone());
          let closestIdx = 8;
          let closestDist = Infinity;
          for (let i = 0; i < this.cableNodes.length; i++) {
            const n = this.cableNodes[i];
            const d = Math.hypot(n.x - localHit.x, n.y - localHit.y, n.z - localHit.z);
            if (d < closestDist) {
              closestDist = d;
              closestIdx = i;
            }
          }
          this.cableGrabNodeIndex = closestIdx;
        }
      }
    });

    window.addEventListener('pointerup', () => {
      if (this.isDraggingPart) {
        this.isDraggingPart = false;
        this.activeDraggedPart = null;
        this.cableGrabNodeIndex = -1;

        if (this.studioControls) {
          this.studioControls.enabled = true;
        }

        dom.style.cursor = this.hoveredPart ? 'grab' : 'default';
      }
    });
  }

  /* ==========================================================================
     PHYSICS SIMULATION & WIRE CABLE VERLET CHAIN
     ========================================================================== */
  initCablePhysics(parts) {
    if (!parts || !parts.earbuds || !parts.audioJack) return;

    this.cableNodes = [];
    this.cableRestLengths = [];

    const start = parts.audioJack.userData.basePos || parts.audioJack.position;
    const end = parts.earbuds.userData.basePos || parts.earbuds.position;

    for (let i = 0; i < this.numCableNodes; i++) {
      const alpha = i / (this.numCableNodes - 1);
      // Natural sagging catenary curve
      const sag = Math.sin(alpha * Math.PI) * 0.05;
      const x = THREE.MathUtils.lerp(start.x, end.x, alpha);
      const y = THREE.MathUtils.lerp(start.y, end.y, alpha) - sag;
      const z = THREE.MathUtils.lerp(start.z, end.z, alpha) + sag * 0.5;

      this.cableNodes.push({
        x, y, z,
        oldX: x, oldY: y, oldZ: z,
        restX: x, restY: y, restZ: z
      });
    }

    for (let i = 0; i < this.numCableNodes - 1; i++) {
      const a = this.cableNodes[i];
      const b = this.cableNodes[i + 1];
      this.cableRestLengths.push(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
    }

    this.earbudsPhysPos.copy(parts.earbuds.userData.basePos);
    this.jackPhysPos.copy(parts.audioJack.userData.basePos);
    this.playerPhysOffset.set(0, 0, 0);
  }

  updateInteractivePartPhysics(time, explodeFactor) {
    const p = this.studioParts;
    const last = this.cableNodes.length - 1;

    // 1. Spring-mass return for Earbuds
    const earbudsTarget = p.earbuds.userData.basePos.clone();
    if (explodeFactor > 0.01) {
      earbudsTarget.x -= explodeFactor * 0.28;
      earbudsTarget.y += explodeFactor * 0.20;
      earbudsTarget.z += explodeFactor * 0.14;
    }

    if (!this.isDraggingPart || this.activeDraggedPart !== p.earbuds) {
      const fx = (earbudsTarget.x - this.earbudsPhysPos.x) * 0.14;
      const fy = (earbudsTarget.y - this.earbudsPhysPos.y) * 0.14;
      const fz = (earbudsTarget.z - this.earbudsPhysPos.z) * 0.14;

      this.earbudsPhysVel.x = (this.earbudsPhysVel.x + fx) * 0.86;
      this.earbudsPhysVel.y = (this.earbudsPhysVel.y + fy) * 0.86;
      this.earbudsPhysVel.z = (this.earbudsPhysVel.z + fz) * 0.86;

      this.earbudsPhysPos.add(this.earbudsPhysVel);
    }
    p.earbuds.position.copy(this.earbudsPhysPos);

    // 2. Spring-mass return for Audio Jack
    const jackTarget = p.audioJack.userData.basePos.clone();
    if (explodeFactor > 0.01) {
      jackTarget.x += explodeFactor * 0.24;
      jackTarget.y -= explodeFactor * 0.18;
      jackTarget.z -= explodeFactor * 0.16;
    }

    if (!this.isDraggingPart || this.activeDraggedPart !== p.audioJack) {
      const fx = (jackTarget.x - this.jackPhysPos.x) * 0.16;
      const fy = (jackTarget.y - this.jackPhysPos.y) * 0.16;
      const fz = (jackTarget.z - this.jackPhysPos.z) * 0.16;

      this.jackPhysVel.x = (this.jackPhysVel.x + fx) * 0.84;
      this.jackPhysVel.y = (this.jackPhysVel.y + fy) * 0.84;
      this.jackPhysVel.z = (this.jackPhysVel.z + fz) * 0.84;

      this.jackPhysPos.add(this.jackPhysVel);
    }
    p.audioJack.position.copy(this.jackPhysPos);

    // 3. Spring-mass return for Player unibody
    const isDraggingPlayer = this.isDraggingPart && (
      this.activeDraggedPart === p.chassis ||
      this.activeDraggedPart === p.screenGlass ||
      this.activeDraggedPart === p.clickWheel
    );

    if (!isDraggingPlayer) {
      this.playerPhysOffsetVel.x = (this.playerPhysOffsetVel.x - this.playerPhysOffset.x * 0.15) * 0.84;
      this.playerPhysOffsetVel.y = (this.playerPhysOffsetVel.y - this.playerPhysOffset.y * 0.15) * 0.84;
      this.playerPhysOffsetVel.z = (this.playerPhysOffsetVel.z - this.playerPhysOffset.z * 0.15) * 0.84;
      this.playerPhysOffset.add(this.playerPhysOffsetVel);
    }

    if (this.studioInnerModel) {
      this.studioInnerModel.position.set(
        -this.modelCenter.x + this.playerPhysOffset.x,
        -this.modelCenter.y + this.playerPhysOffset.y,
        -this.modelCenter.z + this.playerPhysOffset.z
      );
    }

    // 4. Update Verlet Cable Nodes
    if (this.cableNodes.length > 0) {
      // Pin ends to Jack and Earbuds
      this.cableNodes[0].x = this.jackPhysPos.x;
      this.cableNodes[0].y = this.jackPhysPos.y;
      this.cableNodes[0].z = this.jackPhysPos.z;

      this.cableNodes[last].x = this.earbudsPhysPos.x;
      this.cableNodes[last].y = this.earbudsPhysPos.y;
      this.cableNodes[last].z = this.earbudsPhysPos.z;

      // Verlet momentum & gravity
      for (let i = 1; i < last; i++) {
        if (i === this.cableGrabNodeIndex) continue;
        const n = this.cableNodes[i];
        const vx = (n.x - n.oldX) * 0.92;
        const vy = (n.y - n.oldY) * 0.92;
        const vz = (n.z - n.oldZ) * 0.92;

        n.oldX = n.x;
        n.oldY = n.y;
        n.oldZ = n.z;

        const fluidWave = Math.sin(n.x * 25 + time * 3.5 + this.wireImpulse * 2.2) * 0.0004;
        n.x += vx;
        n.y += vy - 0.0002 + fluidWave;
        n.z += vz;
      }

      // Relaxation constraints (4 passes)
      for (let iter = 0; iter < 4; iter++) {
        for (let i = 0; i < last; i++) {
          const a = this.cableNodes[i];
          const b = this.cableNodes[i + 1];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dz = b.z - a.z;
          const dist = Math.hypot(dx, dy, dz);
          const rest = this.cableRestLengths[i] || 0.02;
          if (dist > 1e-6) {
            const factor = (dist - rest) / dist * 0.5;
            if (i > 0 && i !== this.cableGrabNodeIndex) {
              a.x += dx * factor;
              a.y += dy * factor;
              a.z += dz * factor;
            }
            if (i + 1 < last && (i + 1) !== this.cableGrabNodeIndex) {
              b.x -= dx * factor;
              b.y -= dy * factor;
              b.z -= dz * factor;
            }
          }
        }
      }

      // 5. Deform physical Wire Mesh along Verlet curve + harmonic water ripples
      if (p.wire && p.wire.geometry && p.wire.geometry.userData.origPositions) {
        const posAttr = p.wire.geometry.attributes.position;
        const arr = posAttr.array;
        const orig = p.wire.geometry.userData.origPositions;

        for (let i = 0; i < posAttr.count; i++) {
          const idx = i * 3;
          const ox = orig[idx];
          const oy = orig[idx + 1];
          const oz = orig[idx + 2];

          // Normalize along cable X-span: earbuds (~ -0.13) to jack (~ 0.19)
          const t = THREE.MathUtils.clamp((ox + 0.128) / (0.186 + 0.128), 0, 1);
          const nodeT = (1 - t) * last;
          const nIdx = Math.floor(nodeT);
          const frac = nodeT - nIdx;
          const n0 = this.cableNodes[Math.min(nIdx, last)];
          const n1 = this.cableNodes[Math.min(nIdx + 1, last)];

          const offX = THREE.MathUtils.lerp(n0.x - n0.restX, n1.x - n1.restX, frac);
          const offY = THREE.MathUtils.lerp(n0.y - n0.restY, n1.y - n1.restY, frac);
          const offZ = THREE.MathUtils.lerp(n0.z - n0.restZ, n1.z - n1.restZ, frac);

          // Superimposed flowing water ripples
          const waveY = Math.sin(ox * 28.0 + oz * 16.0 + time * 3.4 + this.wireImpulse * 2.2) * 0.0034
                      + Math.cos(oz * 20.0 - time * 2.6) * 0.0024;
          const waveX = Math.cos(oz * 22.0 + time * 2.8 + this.wireImpulse * 1.5) * 0.0028;

          arr[idx]     = ox + offX + waveX;
          arr[idx + 1] = oy + offY + waveY;
          arr[idx + 2] = oz + offZ;
        }

        posAttr.needsUpdate = true;
      }
    }
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

    // 1. Chassis: CNC Aerospace Anodized Aluminum in selected finish
    if (parts.chassis) {
      parts.chassis.material = new THREE.MeshStandardMaterial({
        color: pal.hex,
        roughness: 0.22,
        metalness: 0.88,
        envMapIntensity: 1.6,
        side: THREE.DoubleSide
      });
    }

    // 2. Click Wheel: Pure Apple Matte White Polycarbonate
    if (parts.clickWheel) {
      parts.clickWheel.material = new THREE.MeshStandardMaterial({
        color: 0xf4f4f6,
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
        color: 0x06080c,
        roughness: 0.04,
        metalness: 0.18,
        transparent: true,
        opacity: 0.88,
        envMapIntensity: 2.5,
        side: THREE.DoubleSide
      });
    }

    // 5. 3.5mm Headphone Jack Ports: 24K Gold-plated mirror finish
    if (parts.jackRings) {
      parts.jackRings.material = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        roughness: 0.12,
        metalness: 0.98,
        envMapIntensity: 2.5,
        side: THREE.DoubleSide
      });
    }

    // 6. Earbuds: Precision dynamic acoustic drivers in matching finish
    if (parts.earbuds) {
      parts.earbuds.material = new THREE.MeshStandardMaterial({
        color: pal.hex,
        roughness: 0.26,
        metalness: 0.78,
        envMapIntensity: 1.5,
        side: THREE.DoubleSide
      });
    }

    // 7. Audio Jack: Precision machined metal collar in matching finish
    if (parts.audioJack) {
      parts.audioJack.material = new THREE.MeshStandardMaterial({
        color: pal.hex,
        roughness: 0.16,
        metalness: 0.92,
        envMapIntensity: 2.0,
        side: THREE.DoubleSide
      });
    }

    // 8. Audio Cable: Clean Apple silicone white with soft matte drape (Zero rainbow, zero magenta)
    if (parts.wire) {
      parts.wire.material = new THREE.MeshStandardMaterial({
        color: 0xf2f2f5,
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

    [this.heroParts, this.studioParts].forEach(parts => {
      if (!parts) return;
      if (parts.chassis && parts.chassis.material) {
        parts.chassis.material.color.setHex(pal.hex);
        parts.chassis.material.needsUpdate = true;
      }
      if (parts.earbuds && parts.earbuds.material) {
        parts.earbuds.material.color.setHex(pal.hex);
        parts.earbuds.material.needsUpdate = true;
      }
      if (parts.audioJack && parts.audioJack.material) {
        parts.audioJack.material.color.setHex(pal.hex);
        parts.audioJack.material.needsUpdate = true;
      }
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
        this.studioCamera.position.set(0, 0.35, 7.8);
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
