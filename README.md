# soundcore Studio Player — Gallery Vitrine Website

A product experience built strictly adhering to the **Apple (España) — Style Reference** visual system (*gallery vitrine in morning fog*), crafted for the **soundcore Studio Player** (High-Resolution Portable MP3 / Lossless Music Player).

---

## Active 3D Model: `mp3_player.glb` (Included in Workspace)

- **Source:** User-uploaded Fab.com 4K PBR asset package (`mp3_player.glb`, 14MB).
- **Embedded Components:**
  1. `mp3_player`: 2048×2048 BaseColor, Normal, Metallic-Roughness, and Emissive textures with `KHR_materials_emissive_strength: 5` (glows with OLED brilliance).
  2. `glass`: `KHR_materials_transmission` screen glass (1.0 transmission factor, 1.45 IOR).
  3. `earphones`: High-definition matching earphones with PBR metallic-roughness, normal maps, and braided cable.
- **View Controls in Vitrine Studio:**
  - **Player + Earphones**: Displays the complete audiophile bundle.
  - **Player Focus**: Isolates the MP3 player for inspection of the click wheel, screen, and ports.
  - **Earphones Focus**: Isolates the studio earphones.
- **Dynamic 5-Colorway Tint Engine:**
  - Real-time PBR tinting across Space Gray, Silver, Pacific Blue, Champagne Gold, and Blush Pink.
- **Interactive 360° Orbit & Zoom:**
  - Drag to orbit, wheel/pinch to zoom in up to macro proximity.

---

## Key Features & Experience

### 1. High-Precision 3D Interactive Model (Three.js)
- **Built-in Procedural PBR Model**: Exact CNC aluminum unibody with brushed metal texture, active OLED screen rendering live album art and frequency waveform bars, concentric click wheel with engraved navigation icons (`MENU`, `|◀◀`, `▶▶|`, `▶||`), gold-plated audio jacks, and top mechanical lock switch.
- **Interactive Exploded View**: Smoothly disassembles the MP3 player along the Z-axis to reveal the internal Dual ESS Sabre ES9038Q2M DAC motherboard, Class-A analog amplifier, 3,200mAh battery, and OLED display.
- **Screen On / Off Toggle**: Switch between active playback display and deep glossy OLED sleep state.
- **360° Free Rotation & Zoom**: Smooth damping and inertia.

### 2. Loading the Model from Fab.com
You can load the exact `.glb` / `.gltf` model downloaded from Fab.com in two ways:
1. **Interactive Upload**: In the 3D Vitrine Studio, click **`Load Fab .GLB`** and select the `.glb` file.
2. **Auto-Detection**: Drop the file as `player.glb` or `model.glb` directly into the project root folder. The viewer auto-detects, auto-centers, and normalizes it on page load.

### 3. Bit-Perfect Audio Simulator (Web Audio API)
Switch between 4 high-resolution playback modes:
- **Lossless Master (DSD512 / FLAC)**: 32-bit/768kHz native decoding with crystalline overtone separation.
- **Analog Tube Warmth**: Harmonically enriched even-order vacuum tube soundstage.
- **Linear Studio Reference**: Ultra-flat ±0.05dB monitoring curve for planar headphones.
- **Acoustic Concert Hall**: 360° binaural reverberation.

### 4. Apple Style Reference Compliance
- **Canvas**: Fog Canvas `#f5f5f7`
- **Cards**: Pure White `#ffffff` with 28px border radius
- **Typography**: SF Pro typography with exact negative tracking scales
- **Primary Action**: Electric Blue `#0071e3` exclusively for the Buy button fill
- **Zero drop shadows, zero decorative dividers**: Monolithic, flat, negative-space-dominated vitrine gallery.

---

## How to View and Run

Open `index.html` directly in any web browser:

```bash
# Option 1: macOS direct open
open index.html

# Option 2: Local HTTP server
python3 -m http.server 3000
# Then visit http://localhost:3000
```
