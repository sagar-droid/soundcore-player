/**
 * soundcore Studio Player — Photorealistic Asset & Editorial Canvas Engine
 * Generates mathematically consistent, high-fidelity renders of the
 * soundcore Studio Player (MP3 Player) architecture across all website sections.
 */

const SoundcoreAssets = {
  // Color presets matching the 3D model and Fab.com palette
  colors: {
    orange: {
      body: '#df5824',
      bodyDark: '#bf4415',
      chamfer: '#ff7742',
      wheel: '#ffffff',
      wheelText: '#333333',
      screenBezel: '#0a0a0c'
    },
    spacegray: {
      body: '#2e2e32',
      bodyDark: '#1c1c1e',
      chamfer: '#5c5c60',
      wheel: '#1c1c1e',
      wheelText: '#8e8e93',
      screenBezel: '#0a0a0c'
    },
    silver: {
      body: '#dcdce2',
      bodyDark: '#c7c7cc',
      chamfer: '#ffffff',
      wheel: '#f5f5f7',
      wheelText: '#707070',
      screenBezel: '#0a0a0c'
    },
    blue: {
      body: '#194b80',
      bodyDark: '#103460',
      chamfer: '#2b72bd',
      wheel: '#103460',
      wheelText: '#a1c4eb',
      screenBezel: '#0a0a0c'
    },
    gold: {
      body: '#cfb285',
      bodyDark: '#aa8c5b',
      chamfer: '#f3d9b1',
      wheel: '#f0e3cd',
      wheelText: '#7a6645',
      screenBezel: '#0a0a0c'
    },
    pink: {
      body: '#d98592',
      bodyDark: '#b56471',
      chamfer: '#f5a5b0',
      wheel: '#f8e0e4',
      wheelText: '#8c4e57',
      screenBezel: '#0a0a0c'
    }
  },

  activeColor: 'orange',

  init() {
    this.renderAcousticChamber();
    this.renderWheelMacro();
    this.renderScreenUI();
    this.renderMaterialBody();
    this.renderMaterialJack();
    this.renderMaterialStorage();
    this.renderModalThumb();
  },

  setColor(colorName) {
    if (this.colors[colorName]) {
      this.activeColor = colorName;
      this.renderAcousticChamber();
      this.renderWheelMacro();
      this.renderMaterialBody();
      this.renderModalThumb();
    }
  },

  /**
   * 1. Dual ESS Sabre DAC & Balanced Circuit Cross-Section
   */
  renderAcousticChamber() {
    const canvas = document.getElementById('acoustic-chamber-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Fog ambient gradient background
    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, 420);
    bgGrad.addColorStop(0, '#ffffff');
    bgGrad.addColorStop(1, '#f5f5f7');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Iridescent spectrum audio propagation rings
    for (let r = 240; r <= 390; r += 35) {
      ctx.beginPath();
      ctx.arc(w / 2 + 160, h / 2, r, -Math.PI / 4, Math.PI / 4);
      ctx.strokeStyle = `rgba(0, 113, 227, ${0.25 - (r - 240) * 0.0015})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const c = this.colors[this.activeColor];

    ctx.save();
    ctx.translate(w / 2 - 140, h / 2);

    // Player Aluminum Unibody Silhouette
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-120, -180, 240, 360, 24);
    } else {
      ctx.rect(-120, -180, 240, 360);
    }
    ctx.fillStyle = c.body;
    ctx.fill();
    ctx.strokeStyle = c.chamfer;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Internal Cutaway Window (Dark Audiophile Green PCB)
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-100, -160, 200, 320, 16);
    } else {
      ctx.rect(-100, -160, 200, 320);
    }
    ctx.fillStyle = '#0c3825';
    ctx.fill();

    // Gold Circuit Traces
    ctx.strokeStyle = '#f2c442';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // Trace Left Channel
    ctx.moveTo(-50, -100);
    ctx.lineTo(-50, -40);
    ctx.lineTo(-20, 20);
    ctx.lineTo(-40, 120);
    // Trace Right Channel
    ctx.moveTo(50, -100);
    ctx.lineTo(50, -40);
    ctx.lineTo(20, 20);
    ctx.lineTo(40, 120);
    ctx.stroke();

    // Dual ESS Sabre DAC Chips (ES9038Q2M)
    // Left DAC
    ctx.fillStyle = '#1c1c1e';
    ctx.fillRect(-75, -80, 50, 50);
    ctx.strokeStyle = '#0071e3';
    ctx.lineWidth = 2;
    ctx.strokeRect(-75, -80, 50, 50);

    // Right DAC
    ctx.fillStyle = '#1c1c1e';
    ctx.fillRect(25, -80, 50, 50);
    ctx.strokeRect(25, -80, 50, 50);

    // DAC Labels
    ctx.font = '600 9px -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('SABRE L', -50, -52);
    ctx.fillText('SABRE R', 50, -52);

    // Analog Operational Amp Filter Block
    ctx.fillStyle = '#2c2c2e';
    ctx.fillRect(-45, 10, 90, 45);
    ctx.strokeStyle = '#e59b3a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-45, 10, 90, 45);

    ctx.font = '600 10px -apple-system, sans-serif';
    ctx.fillStyle = '#f5c342';
    ctx.fillText('CLASS-A BALANCED AMP', 0, 36);

    // Gold 3.5mm & 4.4mm Jack cross sections on top
    ctx.fillStyle = '#f2c442';
    ctx.fillRect(-65, -195, 24, 20);
    ctx.fillRect(-25, -195, 30, 20);

    ctx.restore();

    // Annotation Callouts
    ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    ctx.fillStyle = '#1d1d1f';
    ctx.textAlign = 'left';

    // Label 1: Left & Right DACs
    ctx.fillText('Independent ESS Sabre ES9038Q2M DACs', w / 2 - 250, h / 2 - 120);
    ctx.beginPath();
    ctx.moveTo(w / 2 - 190, h / 2 - 110);
    ctx.lineTo(w / 2 - 190, h / 2 - 60);
    ctx.strokeStyle = '#86868b';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label 2: Balanced Analog Amp
    ctx.fillText('Discrete Balanced Headphone Amp', w / 2 + 100, h / 2 + 40);
    ctx.beginPath();
    ctx.moveTo(w / 2 + 90, h / 2 + 35);
    ctx.lineTo(w / 2 - 50, h / 2 + 35);
    ctx.stroke();

    // Label 3: True Balanced Output
    ctx.fillStyle = '#0071e3';
    ctx.fillText('Dual Balanced Signal Path (32-bit/768kHz Native)', w / 2 + 80, h / 2 + 140);
  },

  /**
   * 2. Tactile Click Wheel Macro View
   */
  renderWheelMacro() {
    const canvas = document.getElementById('wheel-macro-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#fafafc';
    ctx.fillRect(0, 0, w, h);

    const c = this.colors[this.activeColor];

    ctx.save();
    ctx.translate(w / 2, h / 2);

    // Wheel Housing Plate
    ctx.beginPath();
    ctx.arc(0, 0, 120, 0, Math.PI * 2);
    ctx.fillStyle = c.wheel;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Concentric Machined Radial Grooves
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
    ctx.lineWidth = 1;
    for (let r = 50; r <= 110; r += 6) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Navigation Labels
    ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    ctx.fillStyle = c.wheelText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MENU', 0, -85);
    ctx.fillText('|◀◀', -85, 0);
    ctx.fillText('▶▶|', 85, 0);
    ctx.fillText('▶||', 0, 85);

    // Center Selector Button
    ctx.beginPath();
    ctx.arc(0, 0, 42, 0, Math.PI * 2);
    ctx.fillStyle = c.body;
    ctx.fill();
    ctx.strokeStyle = c.chamfer;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  },

  /**
   * 3. Retina OLED Display UI Canvas
   */
  renderScreenUI() {
    const canvas = document.getElementById('screen-ui-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#fafafc';
    ctx.fillRect(0, 0, w, h);

    // Screen frame
    ctx.save();
    ctx.translate(w / 2, h / 2);

    // Glass bezel
    ctx.fillStyle = '#0a0a0c';
    if (ctx.roundRect) {
      ctx.roundRect(-180, -110, 360, 220, 16);
    } else {
      ctx.rect(-180, -110, 360, 220);
    }
    ctx.fill();

    // Album Art Preview
    const artGrad = ctx.createLinearGradient(-155, -85, -55, 15);
    artGrad.addColorStop(0, '#0894ff');
    artGrad.addColorStop(0.5, '#c959dd');
    artGrad.addColorStop(1, '#ff2e54');
    ctx.fillStyle = artGrad;
    if (ctx.roundRect) {
      ctx.roundRect(-155, -85, 100, 100, 10);
    } else {
      ctx.fillRect(-155, -85, 100, 100);
    }
    ctx.fill();

    // Song info
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 16px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Acoustic Majesty', -40, -60);

    ctx.fillStyle = '#86868b';
    ctx.font = '13px -apple-system, sans-serif';
    ctx.fillText('soundcore Acoustic Lab', -40, -38);

    // Hi-Res Format Pill
    ctx.fillStyle = 'rgba(0, 113, 227, 0.3)';
    if (ctx.roundRect) {
      ctx.roundRect(-40, -22, 140, 20, 4);
    } else {
      ctx.fillRect(-40, -22, 140, 20);
    }
    ctx.fill();

    ctx.fillStyle = '#0894ff';
    ctx.font = '600 11px -apple-system, sans-serif';
    ctx.fillText('DSD512 · 32-bit/768kHz', -32, -8);

    // Scrubber
    ctx.fillStyle = '#2c2c2e';
    ctx.fillRect(-155, 40, 310, 4);
    ctx.fillStyle = '#0071e3';
    ctx.fillRect(-155, 40, 180, 4);

    ctx.fillStyle = '#86868b';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText('02:45', -155, 60);
    ctx.textAlign = 'right';
    ctx.fillText('05:12', 155, 60);

    ctx.restore();
  },

  /**
   * 4. Macro: CNC Aluminum Unibody Finish
   */
  renderMaterialBody() {
    const canvas = document.getElementById('material-body-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#fafafc';
    ctx.fillRect(0, 0, w, h);

    const c = this.colors[this.activeColor];

    ctx.save();
    ctx.translate(w / 2 - 80, 40);

    // Aluminum Unibody Block
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(0, 0, 160, 220, 20);
    } else {
      ctx.rect(0, 0, 160, 220);
    }
    ctx.fillStyle = c.body;
    ctx.fill();
    ctx.strokeStyle = c.chamfer;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Directional brushed hairline strokes
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    for (let y = 0; y < 220; y += 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(160, y + (Math.random() - 0.5) * 3);
      ctx.stroke();
    }
    ctx.restore();

    // Laser-etched soundcore emblem on backplate
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(80, 110, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(80, 110, 11, 0, Math.PI);
    ctx.stroke();

    ctx.font = '600 12px -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'center';
    ctx.fillText('soundcore', 80, 155);

    ctx.restore();
  },

  /**
   * 5. Gold-Plated 3.5mm & 4.4mm Balanced Outputs
   */
  renderMaterialJack() {
    const canvas = document.getElementById('material-jack-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#fafafc';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, h / 2);

    // 3.5mm Jack (Left)
    ctx.beginPath();
    ctx.arc(-55, 0, 38, 0, Math.PI * 2);
    ctx.fillStyle = '#f2c442';
    ctx.fill();
    ctx.strokeStyle = '#c59d29';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-55, 0, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#1c1c1e';
    ctx.fill();

    // 4.4mm Pentaconn Balanced Jack (Right)
    ctx.beginPath();
    ctx.arc(55, 0, 48, 0, Math.PI * 2);
    ctx.fillStyle = '#f2c442';
    ctx.fill();
    ctx.strokeStyle = '#c59d29';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(55, 0, 26, 0, Math.PI * 2);
    ctx.fillStyle = '#1c1c1e';
    ctx.fill();

    ctx.font = '600 12px -apple-system, sans-serif';
    ctx.fillStyle = '#1d1d1f';
    ctx.textAlign = 'center';
    ctx.fillText('3.5mm SE', -55, 60);
    ctx.fillText('4.4mm Balanced', 55, 68);

    ctx.restore();
  },

  /**
   * 6. Storage & MicroSD Slot
   */
  renderMaterialStorage() {
    const canvas = document.getElementById('material-storage-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#fafafc';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, h / 2);

    // Internal 256GB Flash Chip
    ctx.fillStyle = '#1c1c1e';
    ctx.fillRect(-100, -50, 85, 95);
    ctx.strokeStyle = '#0071e3';
    ctx.lineWidth = 2;
    ctx.strokeRect(-100, -50, 85, 95);

    ctx.font = '600 13px -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('UFS 3.1', -58, -15);
    ctx.fillStyle = '#0894ff';
    ctx.fillText('256GB', -58, 10);

    // MicroSD Card
    ctx.fillStyle = '#2c2c2e';
    ctx.fillRect(20, -50, 75, 95);
    ctx.strokeStyle = '#f5c342';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, -50, 75, 95);

    ctx.fillStyle = '#ffffff';
    ctx.fillText('MicroSD', 58, -15);
    ctx.fillStyle = '#f5c342';
    ctx.fillText('Up to 2TB', 58, 10);

    ctx.restore();
  },

  /**
   * 7. Interactive Modal Product Thumbnail
   */
  renderModalThumb() {
    const canvas = document.getElementById('modal-thumb-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    const c = this.colors[this.activeColor];

    ctx.save();
    ctx.translate(w / 2, h / 2);

    // Unibody silhouette
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-35, -55, 70, 110, 10);
    } else {
      ctx.rect(-35, -55, 70, 110);
    }
    ctx.fillStyle = c.body;
    ctx.fill();
    ctx.strokeStyle = c.chamfer;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Screen
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(-28, -48, 56, 42);

    // Wheel
    ctx.beginPath();
    ctx.arc(0, 22, 22, 0, Math.PI * 2);
    ctx.fillStyle = c.wheel;
    ctx.fill();

    // Center button
    ctx.beginPath();
    ctx.arc(0, 22, 8, 0, Math.PI * 2);
    ctx.fillStyle = c.body;
    ctx.fill();

    ctx.restore();
  }
};

// Auto-initialize on load
document.addEventListener('DOMContentLoaded', () => {
  SoundcoreAssets.init();
});
