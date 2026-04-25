/**
 * SkySystem — procedural day/night cycle.
 *
 * Renders a large gradient sphere as the sky, drives the directional sun's
 * angle and colour, fades the ambient/hemisphere lighting, and adjusts the
 * scene fog to match the current time of day.
 *
 * One full day takes ~120 seconds of wall time. The cycle is slightly biased
 * toward daytime so the world stays watchable.
 */
import * as THREE from 'three';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../core/constants.js';

const DAY_LENGTH_MS = 120_000;

// Time-of-day phase points (0..1). Each entry: phase, sky-top, sky-bottom,
// sun colour, sun intensity, ambient colour, ambient intensity, fog colour.
const STOPS = [
  // Night
  { p: 0.00, top: '#040816', bot: '#0a1428', sun: '#3a4060', sunI: 0.10, amb: '#3a4670', ambI: 0.32, fog: '#080d18' },
  // Pre-dawn
  { p: 0.18, top: '#1a1f3a', bot: '#3a3056', sun: '#7a5066', sunI: 0.18, amb: '#5a4a78', ambI: 0.40, fog: '#1c1e34' },
  // Sunrise
  { p: 0.25, top: '#3a4a78', bot: '#f4a86a', sun: '#ff9a5a', sunI: 0.95, amb: '#a08a82', ambI: 0.55, fog: '#604a48' },
  // Morning
  { p: 0.35, top: '#5b88c8', bot: '#cce0e8', sun: '#fff0c8', sunI: 1.30, amb: '#a8b8d0', ambI: 0.65, fog: '#9ab0c4' },
  // Midday
  { p: 0.50, top: '#4a8ad8', bot: '#cee2f0', sun: '#fff4dc', sunI: 1.50, amb: '#bccae0', ambI: 0.70, fog: '#a8c0d8' },
  // Afternoon
  { p: 0.65, top: '#6a92c8', bot: '#e8d6b8', sun: '#ffdca8', sunI: 1.30, amb: '#b0a890', ambI: 0.62, fog: '#a89c80' },
  // Sunset
  { p: 0.75, top: '#3a3a6e', bot: '#e88450', sun: '#ff7848', sunI: 1.00, amb: '#866a78', ambI: 0.50, fog: '#5c3a3e' },
  // Dusk
  { p: 0.82, top: '#1a1f3a', bot: '#4a3260', sun: '#5a3060', sunI: 0.20, amb: '#4a3a64', ambI: 0.42, fog: '#241834' },
  // Night
  { p: 1.00, top: '#040816', bot: '#0a1428', sun: '#3a4060', sunI: 0.10, amb: '#3a4670', ambI: 0.32, fog: '#080d18' },
];

const _tmpA = new THREE.Color();
const _tmpB = new THREE.Color();
const _tmpC = new THREE.Color();

function lerpColor(a, b, t, out) {
  _tmpA.set(a); _tmpB.set(b);
  out.copy(_tmpA).lerp(_tmpB, t);
  return out;
}

function sampleStops(phase) {
  // Find the two stops surrounding phase
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i], b = STOPS[i + 1];
    if (phase >= a.p && phase <= b.p) {
      const t = (phase - a.p) / (b.p - a.p);
      return { a, b, t };
    }
  }
  return { a: STOPS[0], b: STOPS[0], t: 0 };
}

export class SkySystem {
  constructor(scene) {
    this.scene = scene;
    this._startedAt = performance.now();
    this._phaseOverride = null;     // optional manual control
    this._stopped = false;

    this.dayCount = 1;
    this._lastPhase = 0;

    // Sky dome: a large back-side sphere with vertex colours top→bottom.
    const skyGeom = new THREE.SphereGeometry(380, 24, 16);
    const colors = new Float32Array(skyGeom.attributes.position.count * 3);
    const positions = skyGeom.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const t = THREE.MathUtils.clamp((y / 200) * 0.5 + 0.5, 0, 1);
      colors[i * 3]     = t;        // we re-encode at runtime, keep shape
      colors[i * 3 + 1] = t;
      colors[i * 3 + 2] = t;
    }
    skyGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this._skyGeom = skyGeom;
    this._skyColors = colors;

    const skyMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(skyGeom, skyMat);
    this.sky.position.set(WORLD_WIDTH / 2, 0, WORLD_HEIGHT / 2);
    this.sky.renderOrder = -1;
    scene.add(this.sky);

    // Sun (directional)
    this.sun = new THREE.DirectionalLight(0xfff4e0, 1.2);
    this.sun.castShadow = false;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.sun.target.position.set(WORLD_WIDTH / 2, 0, WORLD_HEIGHT / 2);

    // Sun visual disc — a glowing billboard sprite that rides with the sun direction
    const sunSpriteMat = new THREE.SpriteMaterial({
      map: this._makeRadialTexture('#fff4cc'),
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      opacity: 0.9,
      fog: false,
    });
    this.sunSprite = new THREE.Sprite(sunSpriteMat);
    this.sunSprite.scale.set(28, 28, 1);
    this.sunSprite.renderOrder = -0.5;
    scene.add(this.sunSprite);

    // Ambient fill
    this.ambient = new THREE.AmbientLight(0x6b89b0, 0.55);
    scene.add(this.ambient);

    // Hemisphere — sky vs ground bounce
    this.hemi = new THREE.HemisphereLight(0x87ceeb, 0x3a5a28, 0.35);
    this.hemi.position.set(0, 1, 0);
    scene.add(this.hemi);

    // Stars: a random scattering of points that fade in at night.
    this.stars = this._buildStars();
    scene.add(this.stars);

    // Pre-allocate scratch
    this._cTop = new THREE.Color();
    this._cBot = new THREE.Color();
    this._cSun = new THREE.Color();
    this._cAmb = new THREE.Color();
    this._cFog = new THREE.Color();
  }

  _makeRadialTexture(coreHex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0,   coreHex);
    grad.addColorStop(0.4, 'rgba(255,220,160,0.5)');
    grad.addColorStop(1,   'rgba(255,220,160,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  _buildStars(count = 380) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Distribute on the upper hemisphere of a sphere of radius ~250
      const u = Math.random();
      const v = Math.random() * 0.6 + 0.4;     // bias upward
      const theta = u * Math.PI * 2;
      const phi   = Math.acos(2 * v - 1);
      const r = 250;
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.7,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    });
    const pts = new THREE.Points(geom, mat);
    pts.position.set(WORLD_WIDTH / 2, 0, WORLD_HEIGHT / 2);
    pts.renderOrder = -0.9;
    return pts;
  }

  /** Pause time progression. */
  setPaused(p) { this._paused = p; }

  /** Force a particular phase (0..1). Pass null to resume time. */
  setPhase(p) { this._phaseOverride = p; }

  getPhase() {
    if (this._phaseOverride != null) return this._phaseOverride;
    const elapsed = performance.now() - this._startedAt;
    return ((elapsed % DAY_LENGTH_MS) / DAY_LENGTH_MS);
  }

  /** Returns a friendly "Day N" / "Night" label for the HUD. */
  getTimeLabel() {
    const p = this.getPhase();
    if (p < 0.22 || p > 0.82) return 'Night';
    if (p < 0.30) return 'Dawn';
    if (p < 0.45) return 'Morning';
    if (p < 0.58) return 'Midday';
    if (p < 0.72) return 'Afternoon';
    return 'Dusk';
  }

  update(scene) {
    if (this._stopped) return;
    const phase = this.getPhase();

    // Track day count: every time phase wraps from high to low, +1 day.
    if (phase < 0.05 && this._lastPhase > 0.9) {
      this.dayCount++;
    }
    this._lastPhase = phase;

    const { a, b, t } = sampleStops(phase);

    // Interpolate scalars + colours
    const sunI = a.sunI + (b.sunI - a.sunI) * t;
    const ambI = a.ambI + (b.ambI - a.ambI) * t;

    lerpColor(a.top, b.top, t, this._cTop);
    lerpColor(a.bot, b.bot, t, this._cBot);
    lerpColor(a.sun, b.sun, t, this._cSun);
    lerpColor(a.amb, b.amb, t, this._cAmb);
    lerpColor(a.fog, b.fog, t, this._cFog);

    // Repaint sky vertex colours top→bottom.
    const positions = this._skyGeom.attributes.position;
    const colors = this._skyColors;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      // y ranges roughly -380..380 — normalise to 0..1
      const k = THREE.MathUtils.clamp((y / 380) * 0.5 + 0.5, 0, 1);
      // Smooth blend top→bottom
      const blend = 1 - k;
      _tmpC.copy(this._cTop).lerp(this._cBot, blend);
      colors[i * 3]     = _tmpC.r;
      colors[i * 3 + 1] = _tmpC.g;
      colors[i * 3 + 2] = _tmpC.b;
    }
    this._skyGeom.attributes.color.needsUpdate = true;

    // Sun position arcs across the sky from east → up → west, then below.
    // Angle 0 at sunrise (phase 0.25), midday at phase 0.5 (sun overhead),
    // sunset at 0.75. Below horizon outside that band.
    const sunAngle = (phase - 0.25) * Math.PI * 2;        // 0 at sunrise
    const cx = WORLD_WIDTH / 2;
    const cz = WORLD_HEIGHT / 2;
    const radius = Math.max(WORLD_WIDTH, WORLD_HEIGHT);
    const sx = cx - Math.cos(sunAngle) * radius * 0.9;
    const sy = Math.sin(sunAngle) * radius * 0.7;
    const sz = cz;

    this.sun.position.set(sx, sy, sz);
    this.sun.color.copy(this._cSun);
    this.sun.intensity = sunI;

    this.sunSprite.position.set(sx, sy, sz);
    this.sunSprite.material.color.copy(this._cSun);
    this.sunSprite.material.opacity = THREE.MathUtils.clamp(sy / 30, 0, 0.95);

    this.ambient.color.copy(this._cAmb);
    this.ambient.intensity = ambI;

    this.hemi.color.copy(this._cTop);
    this.hemi.groundColor.copy(this._cBot);
    this.hemi.intensity = 0.25 + ambI * 0.4;

    if (scene.fog) {
      scene.fog.color.copy(this._cFog);
    }

    // Stars: visible only at deep night
    const nightLevel = Math.max(0, Math.cos(phase * Math.PI * 2));   // 1 at midnight, 0 at noon
    this.stars.material.opacity = THREE.MathUtils.clamp(nightLevel * 0.9, 0, 0.85);
  }

  /** Get current fog colour (so other systems can match it). */
  getFogColor(out) {
    out.copy(this._cFog);
    return out;
  }
}
