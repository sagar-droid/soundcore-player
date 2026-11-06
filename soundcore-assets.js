/**
 * soundcore Studio Player — Editorial Illustration Engine
 * Every 2D illustration is drawn from the same geometry as the 3D model (mp3_player.glb):
 * a clip-style landscape unibody (~1.5 : 1 : 0.32) with capsule-rounded edges, a white
 * click wheel on the left, the display on the right, and silver inset side panels.
 * Finish colours are read from FINISH_COLORS (three-viewer.js) so 2D and 3D always match.
 */

const SoundcoreAssets = {
  FONT: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif',

  // Player geometry in model millimetres, centred on the body. x = length, y = width, z = up.
  PLAYER: {
    L: 90, W: 60, T: 19, corner: 7,
    wheel: { x: -18, y: 0, r: 16, center: 6 },
    screen: { x: 19, y: 0, w: 28, h: 32, r: 3 }
  },

  // Signal colours shared by the DAC diagram legend and traces
  CHANNEL_L: '#0a84ff',
  CHANNEL_R: '#bf5af2',

  // Used only if three-viewer.js has not defined FINISH_COLORS
  fallbackFinishes: {
    orange: 0xf06428, spacegray: 0x38393d, silver: 0xd8dbe0,
    blue: 0x1d589c, gold: 0xd6bf94, pink: 0xe49ca8
  },

  activeColor: 'orange',

  init() {
    this.renderAll();
  },

  setColor(colorName) {
    if (this.fallbackFinishes[colorName] === undefined) return;
    this.activeColor = colorName;
    this.renderAll();
  },

  renderAll() {
    this.renderAcousticChamber();
    this.renderWheelMacro();
    this.renderScreenUI();
    this.renderMaterialBody();
    this.renderMaterialJack();
    this.renderMaterialStorage();
    this.renderModalThumb();
  },

  /* ==========================================================================
     COLOUR, CANVAS & GEOMETRY HELPERS
     ========================================================================== */
  finishHex() {
    const shared = typeof FINISH_COLORS !== 'undefined' ? FINISH_COLORS[this.activeColor] : null;
    const hex = shared ? shared.hex : this.fallbackFinishes[this.activeColor];
    return '#' + hex.toString(16).padStart(6, '0');
  },

  hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },

  // amt > 0 mixes toward white, amt < 0 toward black
  shade(hex, amt) {
    const target = amt < 0 ? 0 : 255;
    const p = Math.abs(amt);
    const [r, g, b] = this.hexToRgb(hex).map(c => Math.round(c + (target - c) * p));
    return `rgb(${r}, ${g}, ${b})`;
  },

  palette() {
    const base = this.finishHex();
    const [r, g, b] = this.hexToRgb(base);
    return {
      base,
      light: this.shade(base, 0.22),
      highlight: this.shade(base, 0.5),
      dark: this.shade(base, -0.25),
      darker: this.shade(base, -0.45),
      isLight: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6
    };
  },

  // Backs each canvas with devicePixelRatio pixels while keeping its HTML width/height as drawing units
  setupCanvas(id) {
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    if (!canvas.dataset.logicalWidth) {
      canvas.dataset.logicalWidth = canvas.width;
      canvas.dataset.logicalHeight = canvas.height;
    }
    const w = Number(canvas.dataset.logicalWidth);
    const h = Number(canvas.dataset.logicalHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== w * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { canvas, ctx, w, h, dpr };
  },

  roundRectPath(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  // Soft-fade the left/right edges of a cropped macro shot into the card background
  fadeEdges(ctx, w, h, left, right) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, left ? 'rgba(0,0,0,0)' : '#000');
    g.addColorStop(left / w, '#000');
    g.addColorStop(1 - right / w, '#000');
    g.addColorStop(1, right ? 'rgba(0,0,0,0)' : '#000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  },

  // Three-quarter axonometric projection in model units
  makeProjection(ox, oy, k, ux = [0.94, 0.34], uy = [-0.5, 0.46]) {
    return {
      point: (x, y, z) => [ox + (x * ux[0] + y * uy[0]) * k, oy + (x * ux[1] + y * uy[1] - z) * k],
      // Horizontal plane at height z, drawn in (x, y)
      plane: (ctx, z) => ctx.transform(ux[0] * k, ux[1] * k, uy[0] * k, uy[1] * k, ox, oy - z * k),
      // Vertical plane facing the viewer at y = yPlane, drawn in (x, z)
      side: (ctx, yPlane) => ctx.transform(ux[0] * k, ux[1] * k, 0, -k, ox + yPlane * uy[0] * k, oy + yPlane * uy[1] * k),
      // Vertical end plane at x = xPlane, drawn in (y, z)
      end: (ctx, xPlane) => ctx.transform(uy[0] * k, uy[1] * k, 0, -k, ox + xPlane * ux[0] * k, oy + xPlane * ux[1] * k)
    };
  },

  label(ctx, text, x, y, { size = 13, weight = 400, color = '#1d1d1f', align = 'left', baseline = 'alphabetic', spacing = 0 } = {}) {
    ctx.font = `${weight} ${size}px ${this.FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
    ctx.fillText(text, x, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  },

  // Label on a white pill so it stays legible over any finish or the display
  pillLabel(ctx, text, x, y, { color = '#1d1d1f', align = 'left' } = {}) {
    ctx.font = `600 13px ${this.FONT}`;
    const tw = ctx.measureText(text).width;
    const pw = tw + 20, ph = 26;
    const px = align === 'right' ? x - pw : align === 'center' ? x - pw / 2 : x;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.14)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;
    this.roundRectPath(ctx, px, y - ph / 2, pw, ph, ph / 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.fill();
    ctx.restore();
    this.label(ctx, text, px + pw / 2, y + 0.5, { size: 13, weight: 600, color, align: 'center', baseline: 'middle' });
    return { x: px, w: pw };
  },

  /* ==========================================================================
     PLAYER PARTS (drawn in model units under whatever transform is active)
     ========================================================================== */
  drawFace(ctx, pal, { detail = true, screen = true } = {}) {
    const { L, W, corner, wheel } = this.PLAYER;

    // Anodized face with a soft studio gradient
    const g = ctx.createLinearGradient(-L / 2, -W / 2, L / 2, W / 2);
    g.addColorStop(0, pal.light);
    g.addColorStop(0.55, pal.base);
    g.addColorStop(1, pal.dark);
    this.roundRectPath(ctx, -L / 2, -W / 2, L, W, corner);
    ctx.fillStyle = g;
    ctx.fill();

    // Brushed hairlines (deterministic so redraws don't shimmer)
    if (detail) {
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = pal.isLight ? 'rgba(0, 0, 0, 0.035)' : 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 0.15;
      for (let y = -W / 2; y < W / 2; y += 0.9) {
        ctx.beginPath();
        ctx.moveTo(-L / 2, y);
        ctx.lineTo(L / 2, y + Math.sin(y * 12.9) * 0.2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Diamond-cut chamfer catching the light
    this.roundRectPath(ctx, -L / 2 + 0.6, -W / 2 + 0.6, L - 1.2, W - 1.2, corner - 0.6);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 0.6;
    ctx.stroke();

    this.drawWheel(ctx, wheel, detail);
    if (screen) this.drawScreen(ctx, this.PLAYER.screen, detail);
  },

  drawWheel(ctx, w, detail = true) {
    // Recess shadow
    ctx.beginPath();
    ctx.arc(w.x, w.y + 0.4, w.r + 0.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fill();

    // Matte white polycarbonate ring
    const g = ctx.createRadialGradient(w.x - w.r * 0.3, w.y - w.r * 0.4, w.r * 0.1, w.x, w.y, w.r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.7, '#f2f2f4');
    g.addColorStop(1, '#dcdce0');
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    if (detail) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.035)';
      ctx.lineWidth = 0.12;
      for (let r = w.center + 1.5; r < w.r - 0.5; r += 0.8) {
        ctx.beginPath();
        ctx.arc(w.x, w.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    this.drawWheelIcons(ctx, w);

    // Centre select button
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.center + 0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.fill();
    const c = ctx.createRadialGradient(w.x - 1.5, w.y - 2, 0.5, w.x, w.y, w.center);
    c.addColorStop(0, '#ffffff');
    c.addColorStop(1, '#ebebee');
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.center, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
  },

  drawWheelIcons(ctx, w) {
    const d = w.r * 0.7;
    const s = w.r * 0.09;
    ctx.fillStyle = '#8e8e93';
    ctx.strokeStyle = '#8e8e93';
    ctx.lineWidth = s * 0.5;
    ctx.lineCap = 'round';

    // Volume + / −
    ctx.beginPath();
    ctx.moveTo(w.x - s, w.y - d); ctx.lineTo(w.x + s, w.y - d);
    ctx.moveTo(w.x, w.y - d - s); ctx.lineTo(w.x, w.y - d + s);
    ctx.moveTo(w.x - s, w.y + d); ctx.lineTo(w.x + s, w.y + d);
    ctx.stroke();

    // Previous / next
    const skip = (x, y, dir) => {
      const a = s * 1.1 * dir;
      ctx.beginPath();
      ctx.moveTo(x - a, y - s); ctx.lineTo(x, y); ctx.lineTo(x - a, y + s); ctx.closePath();
      ctx.moveTo(x, y - s); ctx.lineTo(x + a, y); ctx.lineTo(x, y + s); ctx.closePath();
      ctx.fill();
      ctx.fillRect(Math.min(x + a, x + a + s * 0.35 * dir), y - s, s * 0.35, s * 2);
    };
    skip(w.x - d, w.y, -1);
    skip(w.x + d, w.y, 1);
  },

  drawAlbumArt(ctx, x, y, size) {
    const g = ctx.createLinearGradient(x, y, x + size, y + size);
    g.addColorStop(0, '#0894ff');
    g.addColorStop(0.5, '#c959dd');
    g.addColorStop(1, '#ff2e54');
    this.roundRectPath(ctx, x, y, size, size, size * 0.08);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = size * 0.025;
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(x + size * 0.3, y + size * 0.72, size * 0.16 * i, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  },

  drawScreen(ctx, s, detail = true) {
    const x = s.x - s.w / 2;
    const y = s.y - s.h / 2;

    // Edge-to-edge black glass
    this.roundRectPath(ctx, x, y, s.w, s.h, s.r);
    ctx.fillStyle = '#050608';
    ctx.fill();

    const ix = x + 1.6, iy = y + 1.6, iw = s.w - 3.2, ih = s.h - 3.2;
    const bg = ctx.createLinearGradient(ix, iy, ix, iy + ih);
    bg.addColorStop(0, '#111827');
    bg.addColorStop(1, '#06070b');
    this.roundRectPath(ctx, ix, iy, iw, ih, 1.2);
    ctx.fillStyle = bg;
    ctx.fill();

    // Now-playing layout in miniature
    const a = iw * 0.46;
    this.drawAlbumArt(ctx, ix + 1.8, iy + 2.2, a);
    const tx = ix + a + 3.5, tw = iw - a - 5.5;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(tx, iy + 3.4, tw, 1.4);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(tx, iy + 6.4, tw * 0.7, 1.1);
    ctx.fillStyle = 'rgba(10, 132, 255, 0.6)';
    ctx.fillRect(tx, iy + 9.4, tw * 0.6, 1.8);

    if (detail) {
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i === 0 ? 'rgba(10, 132, 255, 0.35)' : 'rgba(255, 255, 255, 0.16)';
        ctx.fillRect(ix + 1.8, iy + a + 4.6 + i * 3.4, iw - 3.6, 1.2);
      }
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(ix + 1.8, iy + ih - 2.6, iw - 3.6, 0.7);
    ctx.fillStyle = this.CHANNEL_L;
    ctx.fillRect(ix + 1.8, iy + ih - 2.6, (iw - 3.6) * 0.55, 0.7);

    this.drawGlassReflection(ctx, x, y, s.w, s.h, s.r);
  },

  drawGlassReflection(ctx, x, y, w, h, r) {
    ctx.save();
    this.roundRectPath(ctx, x, y, w, h, r);
    ctx.clip();
    const gl = ctx.createLinearGradient(x, y, x + w * 0.7, y + h * 0.7);
    gl.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
    gl.addColorStop(0.5, 'rgba(255, 255, 255, 0.03)');
    gl.addColorStop(0.501, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gl;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  },

  // Flat top-down view (used by the macro cards and the modal thumbnail)
  drawTopView(ctx, cx, cy, s, pal, opts = {}) {
    const { L, W, corner } = this.PLAYER;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);

    // Body thickness peeking out below the face, with a soft contact shadow
    ctx.save();
    this.roundRectPath(ctx, -L / 2, -W / 2 + 1.4, L, W, corner);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
    ctx.shadowBlur = opts.shadow !== undefined ? opts.shadow : 24;
    ctx.shadowOffsetY = ctx.shadowBlur * 0.45;
    ctx.fillStyle = pal.darker;
    ctx.fill();
    ctx.restore();

    this.drawFace(ctx, pal, opts);
    ctx.restore();
  },

  // Extruded capsule-edged body between fractions [from, to] of its thickness
  drawBody(ctx, proj, pal, { z0 = 0, from = 0, to = 1, steps = 36 } = {}) {
    const { L, W, T, corner } = this.PLAYER;
    const R = T / 2;
    for (let i = 0; i <= steps; i++) {
      const t = from + (to - from) * (i / steps);
      const u = 2 * t - 1;
      const inset = R * (1 - Math.sqrt(Math.max(0, 1 - u * u))) * 0.85;
      // Darker underneath, brightest just under the top edge
      const light = t < 0.5 ? -0.45 + t * 0.7 : -0.1 + (t - 0.5) * 0.5;
      ctx.save();
      proj.plane(ctx, z0 + t * T);
      this.roundRectPath(ctx, -L / 2 + inset, -W / 2 + inset, L - 2 * inset, W - 2 * inset, Math.max(corner - inset * 0.3, 1));
      ctx.fillStyle = this.shade(pal.base, light);
      ctx.fill();
      ctx.restore();
    }
  },

  // Silver inset side panel (as on the model), drawn in a side or end plane in (u, z) units
  drawSidePanel(ctx, u0, u1, z0, z1) {
    const g = ctx.createLinearGradient(0, z1, 0, z0);
    g.addColorStop(0, '#f6f6f8');
    g.addColorStop(1, '#cfd0d5');
    this.roundRectPath(ctx, u0, z0, u1 - u0, z1 - z0, (z1 - z0) / 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.lineWidth = 0.25;
    ctx.stroke();
  },

  // Side elevation: horizontal capsule body spanning x0..x1, centred on cy, height h (screen units)
  drawCapsuleSide(ctx, pal, x0, x1, cy, h) {
    const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
    g.addColorStop(0, pal.dark);
    g.addColorStop(0.16, pal.light);
    g.addColorStop(0.5, pal.base);
    g.addColorStop(1, pal.darker);
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 18;
    this.roundRectPath(ctx, x0, cy - h / 2, x1 - x0, h, h / 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();

    // Specular band along the upper radius
    ctx.save();
    this.roundRectPath(ctx, x0, cy - h / 2, x1 - x0, h, h / 2);
    ctx.clip();
    const spec = ctx.createLinearGradient(0, cy - h / 2, 0, cy - h / 2 + h * 0.3);
    spec.addColorStop(0, 'rgba(255, 255, 255, 0)');
    spec.addColorStop(0.5, 'rgba(255, 255, 255, 0.35)');
    spec.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = spec;
    ctx.fillRect(x0, cy - h / 2, x1 - x0, h * 0.3);
    ctx.restore();
  },

  drawPanelInset(ctx, x0, x1, cy, h) {
    const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
    g.addColorStop(0, '#f7f7f9');
    g.addColorStop(1, '#d4d5da');
    this.roundRectPath(ctx, x0, cy - h / 2, x1 - x0, h, h / 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.14)';
    ctx.lineWidth = 1;
    ctx.stroke();
  },

  drawGoldJack(ctx, x, y, r) {
    const ring = ctx.createRadialGradient(x - r * 0.4, y - r * 0.5, r * 0.1, x, y, r);
    ring.addColorStop(0, '#fff1b8');
    ring.addColorStop(0.45, '#e2b544');
    ring.addColorStop(1, '#9a7420');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = ring;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = '#121214';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - r * 0.12, y - r * 0.15, r * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fill();
  },

  drawChip(ctx, cx, cy, size, title, sub, accent) {
    const x = cx - size / 2, y = cy - size / 2;
    // Gold pins on all four sides
    ctx.fillStyle = '#d6b45a';
    const pins = Math.max(3, Math.round(size / 1.6));
    for (let i = 0; i < pins; i++) {
      const p = x + size * (i + 0.5) / pins - 0.25;
      const q = y + size * (i + 0.5) / pins - 0.25;
      ctx.fillRect(p, y - 0.9, 0.5, 0.9);
      ctx.fillRect(p, y + size, 0.5, 0.9);
      ctx.fillRect(x - 0.9, q, 0.9, 0.5);
      ctx.fillRect(x + size, q, 0.9, 0.5);
    }
    // Package with a lit top edge
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 6;
    this.roundRectPath(ctx, x, y, size, size, 0.6);
    ctx.fillStyle = '#1b1d22';
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = accent || 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 0.3;
    ctx.stroke();
    if (title) {
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `600 ${size * 0.17}px ${this.FONT}`;
      ctx.fillText(title, cx, cy - (sub ? size * 0.1 : 0));
      if (sub) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.font = `500 ${size * 0.12}px ${this.FONT}`;
        ctx.fillText(sub, cx, cy + size * 0.16);
      }
    }
  },

  drawTrace(ctx, points, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.8;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.restore();
  },

  /**
   * 1. Acoustics & DAC — exploded view of the player: lower shell, signal board, top shell
   */
  renderAcousticChamber() {
    const c = this.setupCanvas('acoustic-chamber-canvas');
    if (!c) return;
    const { ctx } = c;
    const pal = this.palette();
    const { L, W, T, corner, wheel } = this.PLAYER;

    const proj = this.makeProjection(430, 497, 4.6);
    const zPcb = T / 2 + 17;
    const pcbT = 1.6;
    const zPcbTop = zPcb + pcbT;
    const zTopShell = zPcbTop + 38 - T / 2; // body z0 for the upper half

    // Contact shadow under the stack
    ctx.save();
    proj.plane(ctx, 0);
    this.roundRectPath(ctx, -L / 2, -W / 2, L, W, corner);
    ctx.restore();
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.16)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 24;
    ctx.fillStyle = pal.darker;
    ctx.fill();
    ctx.restore();

    // --- Lower shell with battery cell
    this.drawBody(ctx, proj, pal, { z0: 0, from: 0, to: 0.5, steps: 18 });
    ctx.save();
    proj.plane(ctx, T / 2);
    this.roundRectPath(ctx, -L / 2 + 2.2, -W / 2 + 2.2, L - 4.4, W - 4.4, corner - 1.5);
    ctx.fillStyle = this.shade(pal.base, -0.6);
    ctx.fill();
    const cell = ctx.createLinearGradient(-38, -22, 10, 22);
    cell.addColorStop(0, '#e9eaee');
    cell.addColorStop(1, '#b9bcc4');
    this.roundRectPath(ctx, -38, -22, 52, 44, 3);
    ctx.fillStyle = cell;
    ctx.fill();
    ctx.fillStyle = 'rgba(29, 29, 31, 0.55)';
    ctx.font = `600 3.6px ${this.FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('40-HOUR CELL', -12, 0);
    ctx.restore();

    // Explosion guides at the silhouette corners
    ctx.save();
    ctx.strokeStyle = 'rgba(29, 29, 31, 0.22)';
    ctx.setLineDash([4, 5]);
    ctx.lineWidth = 1;
    [[-L / 2 + 3, W / 2 - 3], [L / 2 - 3, -W / 2 + 3], [L / 2 - 3, W / 2 - 3]].forEach(([x, y]) => {
      const a = proj.point(x, y, T / 2);
      const b = proj.point(x, y, zTopShell + T / 2);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    });
    ctx.restore();

    // --- Signal board
    for (let i = 0; i <= 3; i++) {
      ctx.save();
      proj.plane(ctx, zPcb + (pcbT * i) / 3);
      this.roundRectPath(ctx, -L / 2 + 3, -W / 2 + 3, L - 6, W - 6, corner - 2);
      ctx.fillStyle = i < 3 ? '#0a1d15' : '#123527';
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    proj.plane(ctx, zPcbTop);
    const board = ctx.createLinearGradient(-L / 2, -W / 2, L / 2, W / 2);
    board.addColorStop(0, '#17402f');
    board.addColorStop(1, '#0d281d');
    this.roundRectPath(ctx, -L / 2 + 3, -W / 2 + 3, L - 6, W - 6, corner - 2);
    ctx.fillStyle = board;
    ctx.fill();
    ctx.strokeStyle = 'rgba(214, 180, 90, 0.55)';
    ctx.lineWidth = 0.35;
    ctx.stroke();

    // Mounting holes
    [[-L / 2 + 7, -W / 2 + 7], [L / 2 - 7, -W / 2 + 7], [-L / 2 + 7, W / 2 - 7], [L / 2 - 7, W / 2 - 7]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.strokeStyle = '#d6b45a';
      ctx.lineWidth = 0.6;
      ctx.stroke();
    });

    // Optical encoder that reads the click wheel above it
    ctx.strokeStyle = 'rgba(190, 230, 210, 0.55)';
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.arc(wheel.x, wheel.y, wheel.r - 0.5, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(wheel.x + Math.cos(a) * (wheel.r - 3), wheel.y + Math.sin(a) * (wheel.r - 3));
      ctx.lineTo(wheel.x + Math.cos(a) * (wheel.r - 1), wheel.y + Math.sin(a) * (wheel.r - 1));
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(wheel.x, wheel.y, wheel.center, 0, Math.PI * 2);
    ctx.stroke();

    // Signal traces: storage -> SoC -> DAC L/R -> amp L/R -> output
    this.drawTrace(ctx, [[-10, 22], [6, 22], [6, 6]], 'rgba(200, 205, 215, 0.7)');
    this.drawTrace(ctx, [[12, -3], [14, -3], [14, -14], [16.5, -14]], this.CHANNEL_L);
    this.drawTrace(ctx, [[27.5, -14], [31, -14]], this.CHANNEL_L);
    this.drawTrace(ctx, [[39, -14], [40, -14], [40, -2.5], [41, -2.5]], this.CHANNEL_L);
    this.drawTrace(ctx, [[12, 3], [14, 3], [14, 14], [16.5, 14]], this.CHANNEL_R);
    this.drawTrace(ctx, [[27.5, 14], [31, 14]], this.CHANNEL_R);
    this.drawTrace(ctx, [[39, 14], [40, 14], [40, 2.5], [41, 2.5]], this.CHANNEL_R);

    this.drawChip(ctx, -17, 22, 7, 'UFS', '256GB');
    this.drawChip(ctx, 6, 0, 12, 'SoC', 'DECODE');
    this.drawChip(ctx, 22, -14, 11, 'SABRE L', 'ES9038Q2M', this.CHANNEL_L);
    this.drawChip(ctx, 22, 14, 11, 'SABRE R', 'ES9038Q2M', this.CHANNEL_R);
    this.drawChip(ctx, 35, -14, 8, 'AMP L', null, this.CHANNEL_L);
    this.drawChip(ctx, 35, 14, 8, 'AMP R', null, this.CHANNEL_R);

    // Gold-plated output barrel at the end of the board
    const barrel = ctx.createLinearGradient(0, -4, 0, 4);
    barrel.addColorStop(0, '#fff1b8');
    barrel.addColorStop(0.5, '#d9aa3a');
    barrel.addColorStop(1, '#8c6a1c');
    this.roundRectPath(ctx, 40.5, -4, 8.5, 8, 1);
    ctx.fillStyle = barrel;
    ctx.fill();
    ctx.restore();

    // --- Top shell with click wheel & display
    this.drawBody(ctx, proj, pal, { z0: zTopShell, from: 0.5, to: 1, steps: 18 });
    ctx.save();
    proj.plane(ctx, zTopShell + T);
    this.drawFace(ctx, pal);
    ctx.restore();

    // Output waveforms leaving the jack, one per channel
    const jack = proj.point(49, 0, zPcbTop);
    [[this.CHANNEL_L, -9], [this.CHANNEL_R, 9]].forEach(([color, dy], ch) => {
      const grad = ctx.createLinearGradient(jack[0], 0, jack[0] + 150, 0);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= 150; x += 2) {
        const y = jack[1] + dy + Math.sin(x * 0.11 + ch * 1.3) * 6 * (1 - x / 190);
        if (x === 0) ctx.moveTo(jack[0] + 6 + x, y);
        else ctx.lineTo(jack[0] + 6 + x, y);
      }
      ctx.stroke();
    });

    // --- Legend
    this.label(ctx, 'SIGNAL PATH', 40, 548, { size: 12, weight: 600, color: '#86868b', spacing: 1.2 });
    [[this.CHANNEL_L, 'Left channel'], [this.CHANNEL_R, 'Right channel']].forEach(([color, text], i) => {
      const y = 576 + i * 26;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(42, y - 5);
      ctx.lineTo(64, y - 5);
      ctx.stroke();
      this.label(ctx, text, 74, y, { size: 15, color: '#1d1d1f' });
    });

    // --- Numbered callouts, ordered top-to-bottom to keep leaders from crossing
    const callouts = [
      { title: 'Decoder SoC', body: 'Bit-perfect FLAC & DSD512 decoding', at: [6, 0] },
      { title: 'Sabre ES9038Q2M · Left', body: 'A dedicated DAC for the left channel', at: [22, -14] },
      { title: 'Sabre ES9038Q2M · Right', body: 'A dedicated DAC for the right channel', at: [22, 14] },
      { title: 'Discrete balanced amp', body: 'One Class-A stage per channel', at: [35, -14] },
      { title: 'Gold-plated outputs', body: '3.5mm single-ended · 4.4mm balanced', at: [45, 0] },
      { title: 'Optical wheel encoder', body: 'Reads thumb speed beneath the wheel', at: [wheel.x + 8, wheel.y + wheel.r - 3] }
    ]
      // Each pin floats on a short stem above its part so it never hides the chip
      .map(item => ({ ...item, base: proj.point(item.at[0], item.at[1], zPcbTop + 1), p: proj.point(item.at[0], item.at[1], zPcbTop + 7) }))
      .sort((a, b) => a.p[1] - b.p[1]);

    const colX = 860;
    const top = 120;
    const step = (560 - top) / (callouts.length - 1);
    callouts.forEach((item, i) => {
      const y = top + i * step;
      const [mx, my] = item.p;

      ctx.strokeStyle = 'rgba(29, 29, 31, 0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(item.base[0], item.base[1]);
      ctx.lineTo(mx, my);
      ctx.moveTo(mx, my);
      ctx.lineTo(colX - 40, y - 6);
      ctx.lineTo(colX - 14, y - 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(item.base[0], item.base[1], 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      [[mx, my], [colX, y - 6]].forEach(([x, yy]) => {
        ctx.beginPath();
        ctx.arc(x, yy, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#1d1d1f';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        this.label(ctx, String(i + 1), x, yy + 0.5, { size: 11, weight: 600, align: 'center', baseline: 'middle' });
      });

      this.label(ctx, item.title, colX + 20, y, { size: 18, weight: 600 });
      this.label(ctx, item.body, colX + 20, y + 22, { size: 15, color: '#6e6e73' });
    });
  },

  /**
   * 2. Click wheel macro — the real face, with a cutaway revealing the optical encoder
   */
  renderWheelMacro() {
    const c = this.setupCanvas('wheel-macro-canvas');
    if (!c) return;
    const { ctx, w, h } = c;
    const pal = this.palette();
    const { wheel } = this.PLAYER;
    const s = 7.2;
    const cx = 290, cy = 170;

    this.drawTopView(ctx, cx - wheel.x * s, cy, s, pal, { shadow: 30 });

    // Cutaway wedge showing the encoder disc under the wheel
    const a0 = Math.PI * 0.14, a1 = Math.PI * 0.36;
    const R = wheel.r * s, r0 = wheel.center * s + 6;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R - 2, a0, a1);
    ctx.arc(cx, cy, r0, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = '#1c1c1e';
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = 'rgba(160, 220, 255, 0.75)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 80; i++) {
      const a = (i / 80) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (R - 26), cy + Math.sin(a) * (R - 26));
      ctx.lineTo(cx + Math.cos(a) * (R - 10), cy + Math.sin(a) * (R - 10));
      ctx.stroke();
    }
    ctx.restore();

    // Thumb travel arc
    const ar = R + 16;
    ctx.strokeStyle = 'rgba(0, 113, 227, 0.85)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, ar, Math.PI * 1.05, Math.PI * 1.55);
    ctx.stroke();
    const tip = Math.PI * 1.55;
    const tx = cx + Math.cos(tip) * ar, ty = cy + Math.sin(tip) * ar;
    ctx.fillStyle = 'rgba(0, 113, 227, 0.85)';
    ctx.beginPath();
    ctx.moveTo(tx + 9, ty);
    ctx.lineTo(tx - 3, ty - 7);
    ctx.lineTo(tx - 3, ty + 7);
    ctx.closePath();
    ctx.fill();

    this.fadeEdges(ctx, w, h, 0, 110);

    // Encoder callout
    const ma = (a0 + a1) / 2;
    const mx = cx + Math.cos(ma) * (R - 18), my = cy + Math.sin(ma) * (R - 18);
    const ly = 314;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + 24, ly);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(mx, my, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    this.pillLabel(ctx, 'Optical encoder', mx + 14, ly);
    this.pillLabel(ctx, 'Spin to scroll', cx - ar * 0.55, cy - ar - 6, { color: '#0071e3', align: 'right' });
  },

  /**
   * 3. Display — the screen in context on the face, now-playing UI at full size
   */
  renderScreenUI() {
    const c = this.setupCanvas('screen-ui-canvas');
    if (!c) return;
    const { ctx, w, h } = c;
    const pal = this.palette();
    const { screen } = this.PLAYER;
    const s = 8.2;
    const cx = 340, cy = 170;

    this.drawTopView(ctx, cx - screen.x * s, cy, s, pal, { screen: false, shadow: 30 });

    // Glass in screen units
    const gw = screen.w * s, gh = screen.h * s;
    const gx = cx - gw / 2, gy = cy - gh / 2;
    this.roundRectPath(ctx, gx, gy, gw, gh, screen.r * s);
    ctx.fillStyle = '#050608';
    ctx.fill();

    const dx = gx + 11, dy = gy + 11, dw = gw - 22, dh = gh - 22;
    const bg = ctx.createLinearGradient(dx, dy, dx, dy + dh);
    bg.addColorStop(0, '#141b2d');
    bg.addColorStop(1, '#05060a');
    this.roundRectPath(ctx, dx, dy, dw, dh, 8);
    ctx.fillStyle = bg;
    ctx.fill();

    const mid = dx + dw / 2;
    this.label(ctx, '9:41', dx + 10, dy + 16, { size: 10, weight: 600, color: '#ffffff' });
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(dx + dw - 28, dy + 8, 16, 8);
    ctx.fillStyle = '#30d158';
    ctx.fillRect(dx + dw - 26.5, dy + 9.5, 10, 5);

    const art = Math.min(118, dw - 60);
    this.drawAlbumArt(ctx, mid - art / 2, dy + 26, art);

    let ty = dy + 26 + art + 22;
    this.label(ctx, 'Acoustic Majesty', mid, ty, { size: 15, weight: 600, color: '#ffffff', align: 'center' });
    this.label(ctx, 'soundcore Acoustic Lab', mid, ty + 18, { size: 12, color: '#8e8e93', align: 'center' });

    ty += 30;
    const pill = 'DSD512 · 32-bit / 768 kHz';
    ctx.font = `600 10px ${this.FONT}`;
    const pw = ctx.measureText(pill).width + 16;
    this.roundRectPath(ctx, mid - pw / 2, ty, pw, 17, 8.5);
    ctx.fillStyle = 'rgba(10, 132, 255, 0.22)';
    ctx.fill();
    this.label(ctx, pill, mid, ty + 9, { size: 10, weight: 600, color: '#64b5ff', align: 'center', baseline: 'middle' });

    const by = dy + dh - 24;
    ctx.fillStyle = '#2c2c2e';
    this.roundRectPath(ctx, dx + 14, by, dw - 28, 4, 2);
    ctx.fill();
    ctx.fillStyle = this.CHANNEL_L;
    this.roundRectPath(ctx, dx + 14, by, (dw - 28) * 0.55, 4, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dx + 14 + (dw - 28) * 0.55, by + 2, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    this.label(ctx, '2:45', dx + 14, by + 18, { size: 10, color: '#8e8e93' });
    this.label(ctx, '-2:27', dx + dw - 14, by + 18, { size: 10, color: '#8e8e93', align: 'right' });

    this.drawGlassReflection(ctx, gx, gy, gw, gh, screen.r * s);
    this.fadeEdges(ctx, w, h, 60, 0);
  },

  /**
   * 4. Anodized unibody — three-quarter view of the real body
   */
  renderMaterialBody() {
    const c = this.setupCanvas('material-body-canvas');
    if (!c) return;
    const { ctx } = c;
    const pal = this.palette();
    const { L, W, T, corner } = this.PLAYER;
    const proj = this.makeProjection(200, 176, 2.6);

    // Contact shadow
    ctx.save();
    proj.plane(ctx, 0);
    this.roundRectPath(ctx, -L / 2 + 4, -W / 2 + 4, L - 8, W - 8, corner);
    ctx.restore();
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 14;
    ctx.fillStyle = pal.darker;
    ctx.fill();
    ctx.restore();

    this.drawBody(ctx, proj, pal, { steps: 30 });

    // Silver side panel with switch and jack, as on the model
    ctx.save();
    proj.side(ctx, W / 2 - 0.6);
    this.drawSidePanel(ctx, -30, 18, T * 0.24, T * 0.76);
    this.roundRectPath(ctx, -25, T * 0.42, 9, T * 0.16, T * 0.08);
    ctx.fillStyle = '#b8bac0';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(10, T / 2, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = '#1c1c1e';
    ctx.fill();
    ctx.restore();

    ctx.save();
    proj.plane(ctx, T);
    this.drawFace(ctx, pal);
    // Specular along the front edge chamfer
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-L / 2 + corner, W / 2 - 0.3);
    ctx.lineTo(L / 2 - corner, W / 2 - 0.3);
    ctx.stroke();
    ctx.restore();
  },

  /**
   * 5. Gold-plated outputs — side panel elevation
   */
  renderMaterialJack() {
    const c = this.setupCanvas('material-jack-canvas');
    if (!c) return;
    const { ctx, w, h } = c;
    const pal = this.palette();
    const cy = 128, ch = 112;

    this.drawCapsuleSide(ctx, pal, -120, 520, cy, ch);
    this.drawPanelInset(ctx, 36, 364, cy, 74);

    // OFF / ON slide switch
    this.label(ctx, 'OFF', 62, cy + 3.5, { size: 9, weight: 600, color: '#86868b', align: 'center' });
    this.roundRectPath(ctx, 76, cy - 7, 30, 14, 7);
    ctx.fillStyle = '#c4c6cc';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(99, cy, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    this.label(ctx, 'ON', 119, cy + 3.5, { size: 9, weight: 600, color: '#86868b', align: 'center' });

    this.drawGoldJack(ctx, 182, cy, 17);
    this.drawGoldJack(ctx, 262, cy, 23);
    ctx.beginPath();
    ctx.arc(262, cy, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = '#e2b544';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(330, cy, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = '#1c1c1e';
    ctx.fill();
    this.label(ctx, 'MIC', 330, cy + 16, { size: 8, weight: 600, color: '#86868b', align: 'center' });

    this.fadeEdges(ctx, w, h, 36, 36);

    [[182, '3.5mm', 'Single-ended'], [262, '4.4mm', 'Balanced']].forEach(([x, title, sub]) => {
      ctx.strokeStyle = 'rgba(29, 29, 31, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, cy + ch / 2 + 6);
      ctx.lineTo(x, cy + ch / 2 + 22);
      ctx.stroke();
      this.label(ctx, title, x, cy + ch / 2 + 40, { size: 13, weight: 600, align: 'center' });
      this.label(ctx, sub, x, cy + ch / 2 + 56, { size: 11, color: '#6e6e73', align: 'center' });
    });
  },

  /**
   * 6. Storage — the opposite side panel with USB-C and a microSD card sliding out
   */
  renderMaterialStorage() {
    const c = this.setupCanvas('material-storage-canvas');
    if (!c) return;
    const { ctx, w, h } = c;
    const pal = this.palette();
    const cy = 170, ch = 100;

    // microSD card being withdrawn from its slot (drawn first so the body overlaps it)
    const sx = 262;
    ctx.save();
    ctx.translate(sx, cy - 14);
    ctx.rotate(-0.08);
    ctx.beginPath();
    ctx.moveTo(-26, -112);
    ctx.lineTo(14, -112);
    ctx.lineTo(26, -100);
    ctx.lineTo(26, 0);
    ctx.lineTo(-26, 0);
    ctx.closePath();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#26272b';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#d6b45a';
    for (let i = 0; i < 7; i++) ctx.fillRect(-22 + i * 6.6, -24, 4, 14);
    this.label(ctx, '2TB', 0, -74, { size: 18, weight: 700, color: '#ffffff', align: 'center' });
    this.label(ctx, 'microSD', 0, -56, { size: 10, weight: 600, color: 'rgba(255,255,255,0.6)', align: 'center' });
    ctx.restore();

    this.drawCapsuleSide(ctx, pal, -120, 520, cy, ch);
    this.drawPanelInset(ctx, 46, 354, cy, 64);

    // USB-C port
    this.roundRectPath(ctx, 98, cy - 7, 42, 14, 7);
    ctx.fillStyle = '#121214';
    ctx.fill();
    this.roundRectPath(ctx, 106, cy - 2, 26, 4, 2);
    ctx.fillStyle = '#5a5c62';
    ctx.fill();

    // microSD slot
    this.roundRectPath(ctx, sx - 30, cy - 3, 60, 6, 3);
    ctx.fillStyle = '#121214';
    ctx.fill();

    this.fadeEdges(ctx, w, h, 36, 36);

    this.label(ctx, 'USB-C', 119, cy + ch / 2 + 34, { size: 13, weight: 600, align: 'center' });
    this.label(ctx, '256GB UFS 3.1 inside', 119, cy + ch / 2 + 50, { size: 11, color: '#6e6e73', align: 'center' });
    this.label(ctx, 'microSD', sx, cy + ch / 2 + 34, { size: 13, weight: 600, align: 'center' });
    this.label(ctx, 'Up to 2TB', sx, cy + ch / 2 + 50, { size: 11, color: '#6e6e73', align: 'center' });
  },

  /**
   * 7. Buy modal thumbnail — top view in the selected finish
   */
  renderModalThumb() {
    const c = this.setupCanvas('modal-thumb-canvas');
    if (!c) return;
    const { ctx, w, h } = c;
    this.drawTopView(ctx, w / 2, h / 2 - 4, 1.45, this.palette(), { detail: false, shadow: 14 });
  }
};

// main.js reaches this through window
window.SoundcoreAssets = SoundcoreAssets;

// Auto-initialize on load
document.addEventListener('DOMContentLoaded', () => {
  SoundcoreAssets.init();
});
