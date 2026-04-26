/**
 * TerrainDecorations — scatters static instanced meshes across the world to
 * give each biome real visual character. Every tile is sampled at world build
 * time (and again on terrain edits) and emits a deterministic, seed-stable
 * collection of decorations:
 *
 *   GRASS    → grass tufts (dense), wildflowers (sparse), bushes (rare)
 *   FOREST   → pine trees (dense), broad-leaf trees (medium), bushes (sparse)
 *   DIRT     → small rocks, dry tufts
 *   SAND     → pebbles, driftwood
 *   MOUNTAIN → boulders, sharp ice pyramids near peaks
 *   SNOW     → ice spikes
 *   WATER    → reeds (only on shoreline)
 *
 * Decorations don't move once placed. A single InstancedMesh per decoration
 * type is reused across every tile, and rebuild() rewrites all matrices in
 * one pass — so a worldgen or an edit to a single tile both run cheaply.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../core/constants.js';
import { TERRAIN } from '../world/TerrainType.js';

// Per-biome budget. Worst case: 120*80 * (sum) ≈ ~50k instances across types.
const BUDGET_MULT = 1;

// Deterministic hash → RNG for a given (tile, slot) so every decoration sticks
// to the same spot across rebuilds.
function hash3(a, b, c) {
  let h = Math.imul(a | 0, 374761393)
        ^ Math.imul(b | 0, 668265263)
        ^ Math.imul(c | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h >>> 0) / 0xffffffff;
}

// ── Geometry helpers ─────────────────────────────────────────────────────

function cone(r, h, ox = 0, oy = 0, oz = 0, seg = 5) {
  const g = new THREE.ConeGeometry(r, h, seg);
  g.translate(ox, oy + h / 2, oz);
  return g;
}
function box(w, h, d, ox = 0, oy = 0, oz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(ox, oy + h / 2, oz);
  return g;
}
function sphere(r, ox = 0, oy = 0, oz = 0, ws = 6, hs = 5) {
  const g = new THREE.SphereGeometry(r, ws, hs);
  g.translate(ox, oy, oz);
  return g;
}
function cyl(rt, rb, h, ox = 0, oy = 0, oz = 0, seg = 5) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.translate(ox, oy + h / 2, oz);
  return g;
}
function merge(geoms) {
  for (const g of geoms) if (g.attributes.uv) g.deleteAttribute('uv');
  return mergeGeometries(geoms, false);
}

// ── Decoration prototypes ────────────────────────────────────────────────

function buildPineTree() {
  // Larger, chunkier conifer (~1.1 units tall) — matches the diorama
  // reference where forests read as bold, sculptural masses rather than
  // a fine carpet of needles.
  const trunk = cyl(0.07, 0.10, 0.26, 0, 0, 0, 5);
  const c1 = cone(0.34, 0.46, 0, 0.16, 0, 6);
  const c2 = cone(0.26, 0.40, 0, 0.46, 0, 6);
  const c3 = cone(0.18, 0.32, 0, 0.74, 0, 6);
  const c4 = cone(0.10, 0.22, 0, 0.96, 0, 6);
  return merge([trunk, c1, c2, c3, c4]);
}
function buildBroadleafTree() {
  // Trunk + canopy cluster
  const trunk = cyl(0.05, 0.07, 0.22, 0, 0, 0, 5);
  const c1 = sphere(0.22, 0,    0.32, 0,    7, 6);
  const c2 = sphere(0.16, 0.10, 0.40, 0.05, 7, 6);
  const c3 = sphere(0.16,-0.08, 0.38,-0.07, 7, 6);
  return merge([trunk, c1, c2, c3]);
}
function buildBush() {
  const b1 = sphere(0.13, 0,    0.10, 0,    7, 6);
  const b2 = sphere(0.10, 0.10, 0.08,-0.06, 7, 6);
  const b3 = sphere(0.10,-0.08, 0.09, 0.06, 7, 6);
  return merge([b1, b2, b3]);
}
function buildGrassTuft() {
  // Three thin blades fanned out
  const b1 = cone(0.025, 0.18,  0,    0,  0, 4);
  const b2 = cone(0.020, 0.14,  0.02, 0,  0.02, 4);
  const b3 = cone(0.020, 0.16, -0.02, 0, -0.02, 4);
  return merge([b1, b2, b3]);
}
function buildFlower() {
  // Tiny stalk + 4-petal head
  const stem = cyl(0.008, 0.010, 0.10, 0, 0, 0, 4);
  const head = sphere(0.038, 0, 0.10, 0, 7, 5);
  return merge([stem, head]);
}
function buildRock() {
  // Faceted rock — wider at base
  const g = new THREE.IcosahedronGeometry(0.14, 0);
  g.scale(1.1, 0.8, 1.0);
  g.translate(0, 0.10, 0);
  return g;
}
function buildBoulder() {
  const g = new THREE.IcosahedronGeometry(0.34, 0);
  g.scale(1.2, 0.9, 1.0);
  g.translate(0, 0.26, 0);
  return g;
}
function buildPebble() {
  return sphere(0.07, 0, 0.05, 0, 6, 4);
}
function buildIceSpike() {
  return cone(0.10, 0.45, 0, 0, 0, 5);
}
function buildDriftwood() {
  const g = new THREE.CylinderGeometry(0.05, 0.05, 0.30, 5);
  g.rotateZ(Math.PI / 2);
  g.translate(0, 0.05, 0);
  return g;
}
function buildReed() {
  const g = new THREE.ConeGeometry(0.012, 0.32, 4);
  g.translate(0, 0.16, 0);
  return g;
}

// ── Type registry ────────────────────────────────────────────────────────

const TYPES = {
  pine:      { build: buildPineTree,      capacity: 8000, color: '#2a5b25', shadow: true,  lateralRadius: 0.40 },
  broadleaf: { build: buildBroadleafTree, capacity: 2400, color: '#3e7a3a', shadow: true,  lateralRadius: 0.42 },
  bush:      { build: buildBush,          capacity: 1800, color: '#4a7a3c', shadow: true,  lateralRadius: 0.32 },
  grass:     { build: buildGrassTuft,     capacity:12000, color: '#6db15a', shadow: false, lateralRadius: 0.45 },
  flower:    { build: buildFlower,        capacity: 1400, color: '#ffffff', shadow: false, lateralRadius: 0.45 },
  rock:      { build: buildRock,          capacity: 2200, color: '#7a8290', shadow: true,  lateralRadius: 0.34 },
  boulder:   { build: buildBoulder,       capacity: 1200, color: '#5e6878', shadow: true,  lateralRadius: 0.30 },
  pebble:    { build: buildPebble,        capacity: 2400, color: '#cdb88e', shadow: false, lateralRadius: 0.42 },
  icespike:  { build: buildIceSpike,      capacity: 1200, color: '#dceffb', shadow: true,  lateralRadius: 0.32 },
  driftwood: { build: buildDriftwood,     capacity:  600, color: '#5c4530', shadow: true,  lateralRadius: 0.34 },
  reed:      { build: buildReed,          capacity: 1600, color: '#7a9a55', shadow: false, lateralRadius: 0.38 },
};

// Flower colour palette — picked deterministically per instance
const FLOWER_COLORS = [
  new THREE.Color('#ffe066'),
  new THREE.Color('#ff7aa6'),
  new THREE.Color('#cf8aff'),
  new THREE.Color('#ffffff'),
  new THREE.Color('#ff6b6b'),
];

// Per-tile decoration plan: returns an array of {type, count, jitter?} for a given terrain.
function planForTerrain(t) {
  switch (t) {
    case TERRAIN.GRASS:    return [
      { type: 'grass',     count: 3 },
      { type: 'flower',    count: 0, chance: 0.18, max: 1 },
      { type: 'bush',      count: 0, chance: 0.06, max: 1 },
    ];
    case TERRAIN.FOREST:   return [
      { type: 'pine',      count: 1, chance: 0.92, max: 3 },
      { type: 'broadleaf', count: 0, chance: 0.40, max: 1 },
      { type: 'bush',      count: 0, chance: 0.30, max: 1 },
      { type: 'grass',     count: 1 },
    ];
    case TERRAIN.DIRT:     return [
      { type: 'rock',      count: 0, chance: 0.30, max: 1 },
      { type: 'grass',     count: 0, chance: 0.20, max: 1 },
    ];
    case TERRAIN.SAND:     return [
      { type: 'pebble',    count: 0, chance: 0.50, max: 2 },
      { type: 'driftwood', count: 0, chance: 0.04, max: 1 },
    ];
    case TERRAIN.MOUNTAIN: return [
      { type: 'boulder',   count: 0, chance: 0.55, max: 1 },
      { type: 'rock',      count: 0, chance: 0.40, max: 1 },
    ];
    case TERRAIN.SNOW:     return [
      { type: 'icespike',  count: 0, chance: 0.55, max: 2 },
    ];
    case TERRAIN.WATER:    return [];   // reeds emitted by adjacency rule below
    default: return [];
  }
}

// ── Renderer ─────────────────────────────────────────────────────────────

export class TerrainDecorations {
  constructor(world, tileRenderer3d) {
    this.world = world;
    this.tileRenderer3d = tileRenderer3d;

    this.kinds = {};
    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();

    for (const [key, def] of Object.entries(TYPES)) {
      const cap = (def.capacity * BUDGET_MULT) | 0;
      const mat = new THREE.MeshStandardMaterial({
        color:     def.color,
        roughness: key === 'icespike' ? 0.4 : 0.95,
        metalness: 0,
        flatShading: true,
        // Vertex colors enabled for flower per-instance colour variation
        vertexColors: false,
      });
      const mesh = new THREE.InstancedMesh(def.build(), mat, cap);
      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      mesh.castShadow    = !!def.shadow;
      mesh.receiveShadow = true;
      mesh.count = 0;
      mesh.frustumCulled = true;
      // Per-instance colour for flowers + slight green/grey jitter for plants
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      this.kinds[key] = mesh;
    }

    this.allMeshes = Object.values(this.kinds);
  }

  rebuild() {
    const counts = {};
    for (const k of Object.keys(this.kinds)) counts[k] = 0;

    const W = this.world.width;
    const H = this.world.height;

    for (let ty = 0; ty < H; ty++) {
      for (let tx = 0; tx < W; tx++) {
        const t = this.world.getTerrain(tx, ty);
        const plan = planForTerrain(t);

        for (let pi = 0; pi < plan.length; pi++) {
          const p = plan[pi];
          let n = p.count | 0;
          if (p.chance) {
            const seedRand = hash3(tx + 1000, ty + 1000, pi + 7);
            if (seedRand < p.chance) n = Math.max(n, 1);
            // optional second roll for "max" stacking
            if (p.max && p.max > 1) {
              const r2 = hash3(tx + 2000, ty + 2000, pi + 11);
              if (r2 < p.chance * 0.5) n = Math.min(p.max, n + 1);
            }
          }
          for (let k = 0; k < n; k++) {
            this._emit(p.type, tx, ty, pi * 8 + k, counts);
          }
        }

        // Shoreline reeds on water tiles bordering land
        if (t === TERRAIN.WATER) {
          if (this._isShoreline(tx, ty)) {
            const r = hash3(tx + 3000, ty + 3000, 5);
            if (r < 0.35) {
              this._emit('reed', tx, ty, 17, counts);
              if (r < 0.10) this._emit('reed', tx, ty, 19, counts);
            }
          }
        }
      }
    }

    // Apply counts and flag GPU upload
    for (const [key, mesh] of Object.entries(this.kinds)) {
      mesh.count = Math.min(counts[key], mesh.instanceMatrix.count);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      // Recompute bounds for frustum culling
      mesh.computeBoundingSphere?.();
    }
  }

  _isShoreline(tx, ty) {
    const W = this.world.width;
    const H = this.world.height;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = tx + dx, ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (this.world.getTerrain(nx, ny) !== TERRAIN.WATER) return true;
      }
    }
    return false;
  }

  _emit(typeKey, tx, ty, slot, counts) {
    const def = TYPES[typeKey];
    const mesh = this.kinds[typeKey];
    if (!mesh) return;
    const idx = counts[typeKey];
    if (idx >= mesh.instanceMatrix.count) return;

    const r1 = hash3(tx, ty, slot * 3 + 1);
    const r2 = hash3(tx, ty, slot * 3 + 2);
    const r3 = hash3(tx, ty, slot * 3 + 3);
    const r4 = hash3(tx, ty, slot * 3 + 4);

    const radius = def.lateralRadius;
    const ox = (r1 - 0.5) * 2 * radius;
    const oz = (r2 - 0.5) * 2 * radius;
    const wx = tx + 0.5 + ox;
    const wz = ty + 0.5 + oz;

    // Find ground elevation under this offset using corner average. Slight
    // cheat: use the centre tile's getElevationAt() — close enough at this scale.
    const elev = this.tileRenderer3d.getElevationAt(tx, ty);

    let scale = 0.85 + r3 * 0.45;        // 0.85..1.30
    if (typeKey === 'pine')      scale *= 0.90 + r4 * 0.55;
    if (typeKey === 'broadleaf') scale *= 0.85 + r4 * 0.45;
    if (typeKey === 'boulder')   scale *= 0.85 + r4 * 0.55;
    if (typeKey === 'icespike')  scale *= 0.80 + r4 * 0.55;
    if (typeKey === 'grass')     scale *= 0.75 + r4 * 0.55;

    const yaw = r4 * Math.PI * 2;

    this._dummy.position.set(wx, elev, wz);
    this._dummy.rotation.set(0, yaw, 0);
    this._dummy.scale.set(scale, scale, scale);
    this._dummy.updateMatrix();
    mesh.setMatrixAt(idx, this._dummy.matrix);

    // Per-instance colour
    const c = this._colorForType(typeKey, r1, r2, r3);
    mesh.setColorAt(idx, c);

    counts[typeKey] = idx + 1;
  }

  _colorForType(key, r1, r2, r3) {
    const c = this._color;
    switch (key) {
      case 'flower':
        c.copy(FLOWER_COLORS[(r1 * FLOWER_COLORS.length) | 0]);
        break;
      case 'grass': {
        // Slight green hue jitter
        const h = 0.27 + (r1 - 0.5) * 0.04;
        const s = 0.45 + r2 * 0.18;
        const l = 0.42 + r3 * 0.10;
        c.setHSL(h, s, l);
        break;
      }
      case 'pine': {
        const h = 0.30 + (r1 - 0.5) * 0.03;
        const s = 0.40 + r2 * 0.18;
        const l = 0.22 + r3 * 0.10;
        c.setHSL(h, s, l);
        break;
      }
      case 'broadleaf': {
        const h = 0.28 + (r1 - 0.5) * 0.05;
        const s = 0.35 + r2 * 0.20;
        const l = 0.32 + r3 * 0.10;
        c.setHSL(h, s, l);
        break;
      }
      case 'bush': {
        const h = 0.25 + (r1 - 0.5) * 0.06;
        const s = 0.4 + r2 * 0.2;
        const l = 0.30 + r3 * 0.10;
        c.setHSL(h, s, l);
        break;
      }
      case 'rock':
      case 'boulder': {
        const v = 0.35 + r1 * 0.15;
        c.setRGB(v, v + r2 * 0.04, v + 0.02);
        break;
      }
      case 'pebble': {
        const v = 0.65 + r1 * 0.20;
        c.setRGB(v, v - 0.04, v - 0.20);
        break;
      }
      case 'icespike': {
        const v = 0.85 + r1 * 0.10;
        c.setRGB(v - 0.02, v, v + 0.05);
        break;
      }
      case 'driftwood': {
        const v = 0.34 + r1 * 0.08;
        c.setRGB(v, v - 0.05, v - 0.16);
        break;
      }
      case 'reed': {
        const h = 0.22 + (r1 - 0.5) * 0.04;
        c.setHSL(h, 0.35, 0.32 + r2 * 0.08);
        break;
      }
      default:
        c.set(TYPES[key].color);
    }
    return c;
  }
}
