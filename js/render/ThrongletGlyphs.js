/**
 * ThrongletGlyphs.js — ground-level "object" renderer used by the Thronglets
 * awareness system. Two visual primitives:
 *
 *   1. piles  — small clusters of dark stones (offerings)
 *   2. glyphs — bitmap-font letters / geometric shapes assembled from the
 *               same stones, laid out across a patch of terrain
 *
 * Implementation: a single InstancedMesh of small dark cubes (capacity
 * GLYPH_CAPACITY). The Thronglets manager calls placePile / placeWord /
 * placeShape, each of which appends stones to the instance buffer. A
 * fade-out is supported per-stone via `bornAt` + `lifetimeMs`.
 *
 * Kept rendering-only: no awareness logic here. Easy to remove with the
 * rest of the Thronglet code if the feature is disabled.
 */

import * as THREE from 'three';

const GLYPH_CAPACITY = 2400;
const BEACON_CAPACITY = 24;
// Slightly warmer than pure rock so stones read against grass/forest
// without losing the "deliberately arranged" feel.
const STONE_COLOR     = new THREE.Color('#3d2c1e');
const STONE_HIGHLIGHT = new THREE.Color('#5a4231');
const BEACON_COLOR    = new THREE.Color('#e6f0ff');

// 3x5 bitmap font. Each glyph is 5 rows top→bottom, 3 columns left→right,
// '#' = stone present, '.' = empty. Letters not listed render as a blank.
// Curated to cover only the words used in WORDS in Thronglets.js plus space.
const FONT_3x5 = {
  ' ': ['...','...','...','...','...'],
  'A': ['.#.','#.#','###','#.#','#.#'],
  'C': ['.##','#..','#..','#..','.##'],
  'E': ['###','#..','##.','#..','###'],
  'F': ['###','#..','##.','#..','#..'],
  'H': ['#.#','#.#','###','#.#','#.#'],
  'I': ['###','.#.','.#.','.#.','###'],
  'L': ['#..','#..','#..','#..','###'],
  'M': ['#.#','###','###','#.#','#.#'],
  'N': ['#.#','##.','#.#','#.#','#.#'],
  'O': ['.#.','#.#','#.#','#.#','.#.'],
  'P': ['##.','#.#','##.','#..','#..'],
  'R': ['##.','#.#','##.','#.#','#.#'],
  'S': ['.##','#..','.#.','..#','##.'],
  'T': ['###','.#.','.#.','.#.','.#.'],
  'U': ['#.#','#.#','#.#','#.#','.#.'],
  'V': ['#.#','#.#','#.#','#.#','.#.'],
  'W': ['#.#','#.#','###','###','#.#'],
  'Y': ['#.#','#.#','.#.','.#.','.#.'],
};

// Geometric shapes — laid out in tile coordinates relative to anchor (0,0).
// Each entry is [dx, dy] for a stone position.
const SHAPES = {
  CIRCLE: (() => {
    const out = [];
    const r = 3;
    for (let a = 0; a < 24; a++) {
      const t = (a / 24) * Math.PI * 2;
      out.push([Math.round(Math.cos(t) * r), Math.round(Math.sin(t) * r)]);
    }
    // dedupe
    const seen = new Set();
    return out.filter(([x, y]) => {
      const k = x + ',' + y;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  })(),
  TRIANGLE: (() => {
    // Stones along three edges of an equilateral-ish triangle
    const tri = [];
    const size = 5;
    const half = Math.floor(size / 2);
    for (let i = 0; i <= size; i++) {
      tri.push([-half + Math.round(i * 0.5), -i]);  // left edge slope
      tri.push([ half - Math.round(i * 0.5), -i]);  // right edge slope
    }
    for (let j = -half; j <= half; j++) tri.push([j, 0]); // base
    const seen = new Set();
    return tri.filter(([x, y]) => {
      const k = x + ',' + y;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  })(),
  EYE: [
    // almond outline
    [-3, 0], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1], [3, 0],
    [-2,  1], [-1,  1], [0,  1], [1,  1], [2,  1],
    // pupil
    [0, 0],
  ],
  CROSS: [
    [0, -2], [0, -1], [0, 0], [0, 1], [0, 2],
    [-2, 0], [-1, 0], [1, 0], [2, 0],
  ],
};

export class ThrongletGlyphs {
  constructor(tileRenderer3d) {
    this.tileRenderer = tileRenderer3d;

    // Each "stone" is a chunky box. ~38% of a tile so it's visible from the
    // default camera height. flatShading + warm colour reads as rough rock.
    const geom = new THREE.BoxGeometry(0.38, 0.28, 0.38);
    const mat  = new THREE.MeshStandardMaterial({
      color: 0xffffff, vertexColors: false,
      roughness: 0.95, metalness: 0.0, flatShading: true,
    });
    const mesh = new THREE.InstancedMesh(geom, mat, GLYPH_CAPACITY);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.castShadow    = true;
    mesh.receiveShadow = true;
    mesh.count = 0;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(GLYPH_CAPACITY * 3), 3
    );
    this.mesh = mesh;

    // Beacon: a tall additively-blended pillar that pulses above newly-placed
    // offerings/glyphs for a few seconds. Without this, an offering on a
    // 120×80 world is genuinely hard to spot at default zoom.
    const beaconGeom = new THREE.CylinderGeometry(0.12, 0.45, 9.0, 14, 1, true);
    beaconGeom.translate(0, 4.5, 0); // base at y=0
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beaconMesh = new THREE.InstancedMesh(beaconGeom, beaconMat, BEACON_CAPACITY);
    beaconMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    beaconMesh.frustumCulled = false;
    beaconMesh.count = 0;
    beaconMesh.castShadow = false;
    beaconMesh.receiveShadow = false;
    beaconMesh.renderOrder = 4;
    beaconMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(BEACON_CAPACITY * 3), 3
    );
    this.beaconMesh = beaconMesh;

    // Parallel JS-side records for fade and bookkeeping
    this.stones  = [];  // { x, y, bornAt, lifetimeMs, baseY, jitter }
    this.beacons = [];  // { x, y, baseY, bornAt, lifetimeMs }
    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();
  }

  /**
   * Add a single stone at (tileX, tileY). lifetimeMs = how long until it fades
   * out and is reclaimed. Returns false if at capacity.
   */
  _placeStone(tileX, tileY, lifetimeMs) {
    if (this.stones.length >= GLYPH_CAPACITY) return false;
    const baseY = this.tileRenderer.getElevationAt(tileX, tileY);
    // Tiny per-stone variation so a glyph looks rough-hewn, not printed
    const jitter = {
      ox: (Math.random() - 0.5) * 0.20,
      oz: (Math.random() - 0.5) * 0.20,
      ry: Math.random() * Math.PI * 2,
      s:  0.85 + Math.random() * 0.45,
    };
    this.stones.push({
      x: tileX, y: tileY, bornAt: performance.now(),
      lifetimeMs, baseY, jitter,
    });
    return true;
  }

  /** A small offering pile (3-6 stones bunched on one tile). */
  placePile(tileX, tileY, count = 4, lifetimeMs = 90_000) {
    for (let i = 0; i < count; i++) {
      this._placeStone(tileX, tileY, lifetimeMs);
    }
  }

  /** Stones in a named geometric/glyph shape, anchored at tile (cx, cy). */
  placeShape(name, cx, cy, lifetimeMs = 120_000) {
    const offsets = SHAPES[name];
    if (!offsets) return;
    for (const [dx, dy] of offsets) {
      this._placeStone(cx + dx, cy + dy, lifetimeMs);
    }
  }

  /**
   * Spell `text` out in 3x5 stone glyphs anchored at (cx, cy). Centred
   * horizontally, baseline at cy. Falls back to spaces for unknown chars.
   */
  placeWord(text, cx, cy, lifetimeMs = 180_000) {
    const t = text.toUpperCase();
    const charW = 3, gap = 1, rows = 5;
    const totalW = t.length * charW + (t.length - 1) * gap;
    const startX = Math.round(cx - totalW / 2);
    const startY = Math.round(cy - rows / 2);
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      const glyph = FONT_3x5[ch] ?? FONT_3x5[' '];
      const ox = startX + i * (charW + gap);
      for (let row = 0; row < rows; row++) {
        const line = glyph[row];
        for (let col = 0; col < charW; col++) {
          if (line[col] === '#') {
            this._placeStone(ox + col, startY + row, lifetimeMs);
          }
        }
      }
    }
  }

  /**
   * Place a glowing beacon over (tileX, tileY) for `lifetimeMs`. Used by
   * Stage 2/3 events so the player can spot a fresh offering or glyph
   * even at full zoom-out without panning.
   */
  placeBeacon(tileX, tileY, lifetimeMs = 6000) {
    if (this.beacons.length >= BEACON_CAPACITY) {
      // Drop the oldest to make room
      this.beacons.shift();
    }
    const baseY = this.tileRenderer.getElevationAt(tileX, tileY);
    this.beacons.push({
      x: tileX, y: tileY, baseY,
      bornAt: performance.now(), lifetimeMs,
    });
  }

  /** Drop every active stone + beacon immediately (used by reset()). */
  clearAll() {
    this.stones.length = 0;
    this.beacons.length = 0;
    this.mesh.count = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.beaconMesh.count = 0;
    this.beaconMesh.instanceMatrix.needsUpdate = true;
    if (this.beaconMesh.instanceColor) this.beaconMesh.instanceColor.needsUpdate = true;
  }

  /**
   * Per-frame update. Computes opacity-equivalent (scale) fade-in/out per
   * stone. Stones past lifetime are removed in-place.
   */
  update() {
    const now = performance.now();
    // Compact dead stones
    const FADE_IN  = 800;   // ms
    const FADE_OUT = 1500;
    let writeIdx = 0;
    for (let i = 0; i < this.stones.length; i++) {
      const s = this.stones[i];
      const age = now - s.bornAt;
      if (age >= s.lifetimeMs) continue; // drop
      if (i !== writeIdx) this.stones[writeIdx] = s;
      writeIdx++;
    }
    this.stones.length = writeIdx;

    const dummy = this._dummy;
    for (let i = 0; i < this.stones.length; i++) {
      const s = this.stones[i];
      const age = now - s.bornAt;
      // Scale-based fade-in/out (the material is opaque; scale → 0 hides it)
      let k = 1;
      if (age < FADE_IN) k = age / FADE_IN;
      else if (age > s.lifetimeMs - FADE_OUT) {
        k = Math.max(0, (s.lifetimeMs - age) / FADE_OUT);
      }
      const sc = s.jitter.s * Math.max(0.001, k);
      dummy.position.set(
        s.x + 0.5 + s.jitter.ox,
        s.baseY + 0.06 * sc,
        s.y + 0.5 + s.jitter.oz,
      );
      dummy.rotation.set(0, s.jitter.ry, 0);
      dummy.scale.set(sc, sc * 0.7, sc);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
      // Slight per-stone colour variation
      this._color.copy(((s.x ^ s.y) & 1) ? STONE_COLOR : STONE_HIGHLIGHT);
      this.mesh.setColorAt(i, this._color);
    }
    this.mesh.count = this.stones.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    // ── Beacons: vertical pillars of light, fade in fast then fade out
    let writeBI = 0;
    for (let i = 0; i < this.beacons.length; i++) {
      const b = this.beacons[i];
      const age = now - b.bornAt;
      if (age >= b.lifetimeMs) continue;
      if (i !== writeBI) this.beacons[writeBI] = b;
      writeBI++;
    }
    this.beacons.length = writeBI;

    for (let i = 0; i < this.beacons.length; i++) {
      const b = this.beacons[i];
      const age = now - b.bornAt;
      // Quick rise (250ms) → steady → slow fade in the last 1500ms
      const FADE_IN  = 250;
      const FADE_OUT = 1500;
      let alpha = 1;
      if (age < FADE_IN) alpha = age / FADE_IN;
      else if (age > b.lifetimeMs - FADE_OUT) alpha = (b.lifetimeMs - age) / FADE_OUT;
      // Subtle pulse so it looks alive
      const pulse = 0.85 + Math.sin(age * 0.006) * 0.15;
      const scaleXZ = 0.9 + Math.sin(age * 0.004 + 1.0) * 0.15;
      dummy.position.set(b.x + 0.5, b.baseY + 0.05, b.y + 0.5);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(scaleXZ, alpha * pulse, scaleXZ);
      dummy.updateMatrix();
      this.beaconMesh.setMatrixAt(i, dummy.matrix);
      // Fade colour by reducing brightness via instance colour
      this._color.copy(BEACON_COLOR).multiplyScalar(alpha * pulse);
      this.beaconMesh.setColorAt(i, this._color);
    }
    this.beaconMesh.count = this.beacons.length;
    this.beaconMesh.instanceMatrix.needsUpdate = true;
    if (this.beaconMesh.instanceColor) this.beaconMesh.instanceColor.needsUpdate = true;
  }

  /** Refresh elevation lookups when terrain regenerates. */
  refreshElevations() {
    for (const s of this.stones)  s.baseY = this.tileRenderer.getElevationAt(s.x, s.y);
    for (const b of this.beacons) b.baseY = this.tileRenderer.getElevationAt(b.x, b.y);
  }
}
