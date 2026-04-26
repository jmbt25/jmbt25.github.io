import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TYPE, MAX_ENTITIES } from '../core/constants.js';
import { UNAFFILIATED_COLOR } from '../sim/Tribe.js';
import { eventBus } from '../core/eventBus.js';

// How long the spawn / death animations take (ms wall-time).
const FADE_IN_MS  = 420;
const FADE_OUT_MS = 520;

// ── Geometry helpers ──────────────────────────────────────────────────────
// Local space: +X = forward, +Y = up, +Z = right. Renderer applies a single
// transform per entity (position + rotation Y(-heading) + scale) to every
// part. Offsets per part are baked into the geometry below.

function box(w, h, d, ox = 0, oy = 0, oz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(ox, oy, oz);
  return g;
}
function sphere(r, ox = 0, oy = 0, oz = 0, ws = 12, hs = 9) {
  const g = new THREE.SphereGeometry(r, ws, hs);
  g.translate(ox, oy, oz);
  return g;
}
function ellipsoid(rx, ry, rz, ox = 0, oy = 0, oz = 0, ws = 12, hs = 10) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.scale(rx, ry, rz);
  g.translate(ox, oy, oz);
  return g;
}
function cone(r, h, ox = 0, oy = 0, oz = 0, seg = 7) {
  const g = new THREE.ConeGeometry(r, h, seg);
  g.translate(ox, oy + h / 2, oz);
  return g;
}
function cyl(rt, rb, h, ox = 0, oy = 0, oz = 0, seg = 7) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.translate(ox, oy + h / 2, oz);
  return g;
}
function merge(geoms) {
  for (const g of geoms) if (g.attributes.uv) g.deleteAttribute('uv');
  return mergeGeometries(geoms, false);
}

// ── Body assemblies ───────────────────────────────────────────────────────
//
// Voxel style — every creature/hut is composed of axis-aligned boxes only.
// No spheres/capsules/cones (apart from the pyramid hut-roof, which IS a
// 4-sided cone i.e. a square pyramid). This matches the chunky cube look of
// the world's terrain.
//
// Local space convention: +X = forward, +Y = up, +Z = right. The renderer
// applies one transform per entity; per-part offsets are baked into the
// merged geometry below.

// Herbivore — chunky cube sheep with wool tufts.
function buildHerbivoreBody() {
  const body  = box(0.50, 0.30, 0.38, 0,    0.34, 0);
  const wool1 = box(0.18, 0.18, 0.18, 0.18, 0.52,  0.10);
  const wool2 = box(0.18, 0.18, 0.18, 0.18, 0.52, -0.10);
  const wool3 = box(0.16, 0.16, 0.16,-0.18, 0.52,  0.12);
  const wool4 = box(0.16, 0.16, 0.16,-0.18, 0.52, -0.12);
  const legFL = box(0.09, 0.18, 0.09,  0.18, 0.09,  0.14);
  const legFR = box(0.09, 0.18, 0.09,  0.18, 0.09, -0.14);
  const legBL = box(0.09, 0.18, 0.09, -0.18, 0.09,  0.14);
  const legBR = box(0.09, 0.18, 0.09, -0.18, 0.09, -0.14);
  const tail  = box(0.09, 0.09, 0.09, -0.30, 0.40,  0);
  return merge([body, wool1, wool2, wool3, wool4, legFL, legFR, legBL, legBR, tail]);
}
function buildHerbivoreHead() {
  const skull = box(0.22, 0.22, 0.22, 0.40, 0.42, 0);
  const muzz  = box(0.10, 0.08, 0.10, 0.55, 0.36, 0);
  const earL  = box(0.05, 0.10, 0.05, 0.36, 0.56,  0.10);
  const earR  = box(0.05, 0.10, 0.05, 0.36, 0.56, -0.10);
  return merge([skull, muzz, earL, earR]);
}
function buildHerbivoreEyes() {
  // White sclera squares only — pupils are a separate part rendered black.
  const eyeL = box(0.03, 0.05, 0.05, 0.512, 0.46,  0.085);
  const eyeR = box(0.03, 0.05, 0.05, 0.512, 0.46, -0.085);
  return merge([eyeL, eyeR]);
}
function buildHerbivorePupils() {
  const pL = box(0.02, 0.025, 0.025, 0.527, 0.46,  0.090);
  const pR = box(0.02, 0.025, 0.025, 0.527, 0.46, -0.090);
  return merge([pL, pR]);
}

// Predator — chunky cube wolf. Boxier shoulders, longer snout, blockier tail.
function buildPredatorBody() {
  const body  = box(0.58, 0.24, 0.28, 0,    0.30, 0);
  const ruff  = box(0.20, 0.30, 0.30, 0.20, 0.34, 0);   // shoulder ruff
  const legFL = box(0.09, 0.26, 0.09,  0.22, 0.13,  0.14);
  const legFR = box(0.09, 0.26, 0.09,  0.22, 0.13, -0.14);
  const legBL = box(0.09, 0.26, 0.09, -0.22, 0.13,  0.14);
  const legBR = box(0.09, 0.26, 0.09, -0.22, 0.13, -0.14);
  // Bushy stepped tail — cube stack going up and back.
  const tail1 = box(0.10, 0.12, 0.12, -0.36, 0.38, 0);
  const tail2 = box(0.10, 0.12, 0.12, -0.50, 0.50, 0);
  const tail3 = box(0.10, 0.12, 0.12, -0.62, 0.62, 0);
  return merge([body, ruff, legFL, legFR, legBL, legBR, tail1, tail2, tail3]);
}
function buildPredatorHead() {
  const skull = box(0.24, 0.22, 0.24, 0.42, 0.40, 0);
  const snout = box(0.18, 0.12, 0.14, 0.62, 0.36, 0);
  const earL  = box(0.06, 0.10, 0.06, 0.40, 0.56,  0.10);
  const earR  = box(0.06, 0.10, 0.06, 0.40, 0.56, -0.10);
  return merge([skull, snout, earL, earR]);
}
function buildPredatorEyes() {
  const eyeL = box(0.03, 0.04, 0.04, 0.546, 0.43,  0.10);
  const eyeR = box(0.03, 0.04, 0.04, 0.546, 0.43, -0.10);
  return merge([eyeL, eyeR]);
}
function buildPredatorPupils() {
  const pL = box(0.02, 0.025, 0.025, 0.561, 0.43,  0.105);
  const pR = box(0.02, 0.025, 0.025, 0.561, 0.43, -0.105);
  return merge([pL, pR]);
}

// Human — Minecraft-style: blocky torso, head, arms, legs, hat-style hair.
function buildHumanBody() {
  const torso = box(0.20, 0.36, 0.20, 0,    0.55, 0);
  // Belt — thin contrasting band around the waist
  const belt  = box(0.22, 0.05, 0.22, 0,    0.39, 0);
  const legL  = box(0.10, 0.34, 0.10,  0.0, 0.17,  0.06);
  const legR  = box(0.10, 0.34, 0.10,  0.0, 0.17, -0.06);
  const armL  = box(0.08, 0.30, 0.08,  0.0, 0.55,  0.18);
  const armR  = box(0.08, 0.30, 0.08,  0.0, 0.55, -0.18);
  return merge([torso, belt, legL, legR, armL, armR]);
}
function buildHumanHead() {
  return box(0.22, 0.22, 0.22, 0, 0.92, 0);
}
function buildHumanEyes() {
  // Two black-on-skin pixel eyes — sclera is small white square.
  const eyeL = box(0.025, 0.04, 0.04, 0.115, 0.95,  0.055);
  const eyeR = box(0.025, 0.04, 0.04, 0.115, 0.95, -0.055);
  return merge([eyeL, eyeR]);
}
function buildHumanPupils() {
  const pL = box(0.018, 0.025, 0.025, 0.130, 0.95,  0.060);
  const pR = box(0.018, 0.025, 0.025, 0.130, 0.95, -0.060);
  return merge([pL, pR]);
}
function buildHumanHair() {
  // Cap-style hair: thin slab on top of the head, slightly larger so it
  // overhangs like a hat brim.
  return box(0.24, 0.06, 0.24, 0, 1.06, 0);
}

// Plants — voxel evergreen: trunk box + stacked foliage cubes.
function buildPlantTrunk() {
  return box(0.10, 0.30, 0.10, 0, 0.15, 0);
}
function buildPlantFoliage() {
  // Three stepped cube layers — wider at the base, narrower up top.
  const f1 = box(0.42, 0.22, 0.42, 0, 0.38, 0);
  const f2 = box(0.30, 0.20, 0.30, 0, 0.62, 0);
  const f3 = box(0.18, 0.18, 0.18, 0, 0.84, 0);
  return merge([f1, f2, f3]);
}

// ── Huts ────────────────────────────────────────────────────────────────
// Every hut is rendered around a single entity tile but the GEOMETRY is
// chunky — roughly 2 tiles wide by itself. Tier upgrades add NEW
// structures at proper multi-tile offsets so a T3 settlement really does
// occupy a 3×3 footprint visually.
//
// Coordinates: +X = forward (door), -X = back (chimney). Adjacent tile
// offsets are 1.0 in either axis.

// T1 base structures — already a substantial multi-tile cabin.

function buildHutFoundation() {
  // Wide stone slab that extends past the walls like a porch.
  return box(2.10, 0.20, 2.10, 0, 0.10, 0);
}
function buildHutWalls() {
  // Main cabin body: ~1.6 wide × 1.0 tall × 1.6 deep. Sits on the slab.
  return box(1.55, 0.95, 1.55, 0, 0.68, 0);
}
function buildHutRoof() {
  // Big square pyramid, base wider than walls so eaves overhang.
  const g = new THREE.ConeGeometry(1.20, 0.85, 4);
  g.rotateY(Math.PI / 4);
  g.translate(0, 1.58, 0);
  return g;
}
function buildHutDoor() {
  // Visible door on the front face (+X), tall enough to see at zoom-out.
  return box(0.06, 0.55, 0.36, 0.79, 0.43, 0);
}
function buildHutChimney() {
  // Chunky chimney sticking out of the back-left, well above the roof line.
  const shaft = box(0.24, 0.70, 0.24, -0.55, 1.30, -0.55);
  const cap   = box(0.32, 0.10, 0.32, -0.55, 1.70, -0.55);
  return merge([shaft, cap]);
}

// ── Tier 2 add-ons — longhouse: loft above + granary annex on the side.

function buildHutLoft() {
  // Second-storey loft sitting ON the roof, with its own little cap.
  const loft = box(0.95, 0.55, 0.95, 0, 1.90, 0);
  const cap  = box(0.40, 0.18, 0.40, 0, 2.30, 0);
  return merge([loft, cap]);
}

function buildHutGranary() {
  // Granary cluster on the +Z side, fully on a neighbouring tile (offset 1.55).
  const slab = box(1.10, 0.16, 1.10, 0, 0.08,  1.55);
  const base = box(0.85, 0.55, 0.85, 0, 0.43,  1.55);
  const top  = box(0.65, 0.28, 0.65, 0, 0.84,  1.55);
  const cap  = box(0.30, 0.14, 0.30, 0, 1.05,  1.55);
  return merge([slab, base, top, cap]);
}

// ── Tier 3 add-ons — compound: tower + banner + outer fence.

function buildHutTower() {
  // Tall watchtower on the back-left, clearly on its own adjacent tile.
  const slab  = box(0.85, 0.16, 0.85, -1.30, 0.08, -1.30);
  const shaft = box(0.55, 2.20, 0.55, -1.30, 1.26, -1.30);
  const top   = box(0.75, 0.18, 0.75, -1.30, 2.45, -1.30);
  const peak  = box(0.30, 0.40, 0.30, -1.30, 2.74, -1.30);
  return merge([slab, shaft, top, peak]);
}

function buildHutBanner() {
  // Tribe-coloured banner flying off the tower, big enough to read across the world.
  return box(0.55, 0.40, 0.06, -0.85, 2.10, -1.30);
}

function buildHutFence() {
  // Low stone wall outlining the compound — extends out to ±1.4 in front
  // and along the right side, so the plot reads as enclosed from above.
  const front = box(2.50, 0.22, 0.14,  0.0, 0.11,  1.18);
  const right = box(0.14, 0.22, 2.20,  1.18, 0.11, 0.05);
  const back  = box(2.40, 0.22, 0.14, 0.10, 0.11, -1.10);
  return merge([front, right, back]);
}

// ── Color helpers ─────────────────────────────────────────────────────────

const PLANT_COLOR     = new THREE.Color('#4ea83a');
const PLANT_TRUNK     = new THREE.Color('#5c3d1e');
const HERBIVORE_COLOR = new THREE.Color('#eedb78');
const HERBIVORE_HEAD  = new THREE.Color('#c4b25a');
const PREDATOR_COLOR  = new THREE.Color('#c43a3a');
const PREDATOR_HEAD   = new THREE.Color('#7a2222');
const HUMAN_FALLBACK  = new THREE.Color(UNAFFILIATED_COLOR);
const HUMAN_HEAD      = new THREE.Color('#f0c69a');
const HUMAN_BELT      = new THREE.Color('#3a2a18');
const HUT_FOUND       = new THREE.Color('#7e7468');
const HUT_WALL        = new THREE.Color('#9b6e44');
const HUT_DOOR        = new THREE.Color('#3a2818');
const HUT_CHIMNEY     = new THREE.Color('#62574a');
const SCLERA_COLOR    = new THREE.Color('#f4eee0');
const PUPIL_COLOR     = new THREE.Color('#06080c');
const PREDATOR_PUPIL  = new THREE.Color('#4a1a08');     // amber-red
const HUNGRY_TINT     = new THREE.Color('#202020');
const GESTATING_TINT  = new THREE.Color('#ff80a0');
const TRAIT_TINT      = new THREE.Color('#ffd34d');
const TRAIT_GLOW      = new THREE.Color('#fff0a0');
const SKILL_TINT      = new THREE.Color('#5fd8ff');
const SKILL_GLOW      = new THREE.Color('#9fe8ff');
const FRENZY_TINT     = new THREE.Color('#ff4040');

// Hair palette — one of these is picked deterministically per human (id-keyed).
const HAIR_COLORS = [
  new THREE.Color('#2a1a10'),  // black-brown
  new THREE.Color('#5a3a20'),  // dark brown
  new THREE.Color('#8a5a30'),  // chestnut
  new THREE.Color('#c39060'),  // sandy
  new THREE.Color('#e0c270'),  // blonde
  new THREE.Color('#a52a2a'),  // auburn
  new THREE.Color('#dadada'),  // grey
];

const HAIR_GREY = new THREE.Color('#cfd2d6');

// Role-coloured hats — adults wear a coloured cap that signals their job
// at a glance. Children and elders show natural hair colour instead.
const ROLE_HAT_COLORS = {
  woodcutter: new THREE.Color('#5a3a1c'),  // worn brown leather
  quarrier:   new THREE.Color('#7a8290'),  // slate-grey hard cap
  farmer:     new THREE.Color('#c2a44a'),  // straw / wheat
  hunter:     new THREE.Color('#3a5230'),  // forest green hood
  builder:    new THREE.Color('#b87432'),  // rust-orange work cap
};

function hairFor(ent) {
  const base = HAIR_COLORS[Math.abs(ent.id) % HAIR_COLORS.length];
  const r = (typeof ent.ageRatio === 'number') ? ent.ageRatio : -1;
  // Adults wear their role hat (if any). Children and elders show natural hair.
  if (ent.role && r >= 0.18 && r < 0.78) {
    const hat = ROLE_HAT_COLORS[ent.role];
    if (hat) return hat;
  }
  // Elders grey out their hair as they age into the elder window.
  if (r >= 0.78) {
    const t = Math.min(1, (r - 0.78) / 0.20);
    const out = new THREE.Color().copy(base).lerp(HAIR_GREY, t * 0.85);
    return out;
  }
  return base;
}

// ── Renderer ──────────────────────────────────────────────────────────────

export class EntityRenderer3D {
  constructor() {
    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();
    this._tmp   = new THREE.Color();
    this._hsl   = { h: 0, s: 0, l: 0 };   // reused across _jitter calls
    this.civ    = null;

    // Dying-entity "ghosts" so deaths fade out instead of popping. We
    // snapshot the entity's last visual state on entity:died and animate
    // a shrink + colour bleach over FADE_OUT_MS, then drop the ghost.
    this._ghosts = [];   // { type, x, z, heading, scale, deadAt, tribeId, trait, skill, frenzyTimer, gestating, hunger, id }
    eventBus.on('entity:died', (ent) => {
      // Plants and buildings disappear less dramatically, but still fade.
      this._ghosts.push({
        type:        ent.type,
        x:           ent.tileX + 0.5,
        z:           ent.tileY + 0.5,
        heading:     ent.heading ?? 0,
        scale:       ent.scale ?? 1,
        stage:       ent.stage,
        tribeId:     ent.tribeId,
        trait:       ent.trait,
        skill:       ent.skill,
        tier:        ent.tier,        // huts: keep their final tier through the death fade
        frenzyTimer: ent.frenzyTimer ?? 0,
        gestating:   ent.gestating ?? false,
        hunger:      ent.hunger,
        id:          ent.id,
        deadAt:      performance.now(),
      });
    });

    this.partGroups = {};

    const baseMat = (extra) => new THREE.MeshStandardMaterial({
      vertexColors: false,
      roughness:    0.85,
      metalness:    0.0,
      flatShading:  true,
      ...extra,
    });

    const makeMesh = (geom, colorRole, opts = {}) => {
      const mat = baseMat(opts.matExtras);
      const mesh = new THREE.InstancedMesh(geom, mat, MAX_ENTITIES);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.castShadow    = opts.castShadow ?? true;
      mesh.receiveShadow = opts.receiveShadow ?? false;
      mesh.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(MAX_ENTITIES * 3), 3
      );
      return { mesh, colorRole, minTier: opts.minTier ?? 0 };
    };

    // A scale-zero matrix used to hide tier-locked hut parts on tier-1 huts.
    this._hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

    this.partGroups[TYPE.PLANT] = [
      makeMesh(buildPlantTrunk(),   'plantTrunk'),
      makeMesh(buildPlantFoliage(), 'plantLeaf'),
    ];
    this.partGroups[TYPE.HERBIVORE] = [
      makeMesh(buildHerbivoreBody(),    'body'),
      makeMesh(buildHerbivoreHead(),    'head'),
      makeMesh(buildHerbivoreEyes(),    'sclera', { castShadow: false }),
      makeMesh(buildHerbivorePupils(),  'pupil',  { castShadow: false }),
    ];
    this.partGroups[TYPE.PREDATOR] = [
      makeMesh(buildPredatorBody(),     'body'),
      makeMesh(buildPredatorHead(),     'head'),
      makeMesh(buildPredatorEyes(),     'sclera', { castShadow: false }),
      makeMesh(buildPredatorPupils(),   'predator-pupil', { castShadow: false }),
    ];
    this.partGroups[TYPE.HUMAN] = [
      makeMesh(buildHumanBody(),    'body'),
      makeMesh(buildHumanHead(),    'head'),
      makeMesh(buildHumanHair(),    'hair'),
      makeMesh(buildHumanEyes(),    'sclera', { castShadow: false }),
      makeMesh(buildHumanPupils(),  'pupil',  { castShadow: false }),
    ];
    this.partGroups[TYPE.BUILDING] = [
      makeMesh(buildHutFoundation(), 'hut-found',   { receiveShadow: true }),
      makeMesh(buildHutWalls(),      'wall',        { receiveShadow: true }),
      makeMesh(buildHutRoof(),       'roof'),
      makeMesh(buildHutDoor(),       'hut-door'),
      makeMesh(buildHutChimney(),    'hut-chimney'),
      // Tier 2 add-ons — second-storey loft + granary annex on the side.
      makeMesh(buildHutLoft(),       'wall',        { minTier: 2 }),
      makeMesh(buildHutGranary(),    'wall',        { minTier: 2 }),
      // Tier 3 add-ons — watchtower, banner, and a fence outlining the plot.
      makeMesh(buildHutTower(),      'wall',        { minTier: 3 }),
      makeMesh(buildHutBanner(),     'tribe',       { minTier: 3 }),
      makeMesh(buildHutFence(),      'hut-found',   { minTier: 3 }),
    ];

    // Trait marker
    const tg = new THREE.OctahedronGeometry(0.12, 0);
    tg.translate(0, 1.45, 0);
    const tm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
    this.traitMarker = new THREE.InstancedMesh(tg, tm, MAX_ENTITIES);
    this.traitMarker.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.traitMarker.frustumCulled = false;
    this.traitMarker.count = 0;
    this.traitMarker.castShadow = false;
    this.traitMarker.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(MAX_ENTITIES * 3), 3
    );

    // Skill marker
    const sg = new THREE.TorusGeometry(0.36, 0.05, 6, 18);
    sg.rotateX(-Math.PI / 2);
    sg.translate(0, 0.04, 0);
    const sm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: true });
    this.skillMarker = new THREE.InstancedMesh(sg, sm, MAX_ENTITIES);
    this.skillMarker.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.skillMarker.frustumCulled = false;
    this.skillMarker.count = 0;
    this.skillMarker.castShadow = false;
    this.skillMarker.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(MAX_ENTITIES * 3), 3
    );

    // Highlight ring
    const ringGeom = new THREE.TorusGeometry(0.55, 0.06, 6, 24);
    ringGeom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false,
    });
    this.highlight = new THREE.Mesh(ringGeom, ringMat);
    this.highlight.renderOrder = 999;
    this.highlight.visible = false;

    this.allMeshes = [];
    for (const parts of Object.values(this.partGroups)) {
      for (const p of parts) this.allMeshes.push(p.mesh);
    }
    this.allMeshes.push(this.traitMarker);
    this.allMeshes.push(this.skillMarker);
  }

  update(registry, tileRenderer3d, civ) {
    this.civ = civ;
    const now = performance.now();
    const nowSec = now * 0.001;

    const counts = {
      [TYPE.PLANT]: 0, [TYPE.HERBIVORE]: 0, [TYPE.PREDATOR]: 0,
      [TYPE.HUMAN]: 0, [TYPE.BUILDING]: 0,
    };
    let traitCount = 0;
    let skillCount = 0;

    for (const ent of registry.getAll()) {
      if (!ent.alive) continue;
      const parts = this.partGroups[ent.type];
      if (!parts) continue;
      const idx = counts[ent.type]++;
      if (idx >= MAX_ENTITIES) continue;

      // Smooth motion interpolation
      let fx = ent.tileX, fz = ent.tileY;
      let isMoving = false;
      let moveT = 1;
      if (ent.moveDurationMs > 0) {
        moveT = Math.min(1, (now - ent.moveStartedAt) / ent.moveDurationMs);
        const e = moveT * moveT * (3 - 2 * moveT);
        fx = ent.prevTileX + (ent.tileX - ent.prevTileX) * e;
        fz = ent.prevTileY + (ent.tileY - ent.prevTileY) * e;
        isMoving = moveT < 1;
      }
      const tileX = Math.round(fx);
      const tileY = Math.round(fz);
      const elev = tileRenderer3d.getElevationAt(tileX, tileY);

      // Sprinting? (flee or predator frenzy) — bigger body language.
      const sprinting = ent.state === 'flee' || ent.frenzyTimer > 0;
      const bobMag  = sprinting ? 0.13 : 0.07;
      const swayMag = sprinting ? 0.22 : 0.10;
      // Walking gait — bob is the foot-fall up/down
      const bob = isMoving ? Math.abs(Math.sin(now * 0.022 + ent.id * 0.13)) * bobMag : 0;
      // Idle breathing for stationary creatures (not plants/buildings)
      const breath = (!isMoving && ent.type !== TYPE.PLANT && ent.type !== TYPE.BUILDING)
        ? Math.sin(nowSec * 1.6 + ent.id * 0.7) * 0.012
        : 0;
      // Walking sway: pitching forward/back as feet hit the ground
      const sway = isMoving ? Math.sin(now * 0.022 + ent.id * 0.23) * swayMag : 0;
      // Idle look-around: stationary creatures slowly drift their heading.
      // Tiny — just enough to sell that they're alive, not statues.
      const lookAround = (!isMoving && ent.type !== TYPE.PLANT && ent.type !== TYPE.BUILDING)
        ? Math.sin(nowSec * 0.45 + ent.id * 1.7) * 0.18
        : 0;

      const x = fx + 0.5;
      const z = fz + 0.5;
      const y = elev + bob;

      let scale = ent.scale ?? 1;
      let s = scale + breath;
      if (ent.type === TYPE.PLANT && ent.stage !== undefined) {
        s = scale * (0.5 + ent.stage * 0.30);
      }
      // Humans visibly grow up: children render at ~55% size and ramp to
      // full size by the end of the child stage. Elders stay full size.
      if (ent.type === TYPE.HUMAN && typeof ent.ageRatio === 'number') {
        if (ent.ageRatio < 0.18) {
          // 0.55 at birth → 1.0 at end of childhood
          const k = ent.ageRatio / 0.18;
          s *= 0.55 + 0.45 * k;
        }
      }
      // Hut tiers no longer apply a global scale — the bigger geometry +
      // tier-gated add-on parts (loft, granary, tower, banner, fence) do
      // the work. A T1 hut is already substantial; T2/T3 grow outward via
      // those add-ons rather than uniformly scaling.
      // Spawn fade-in: ramp from 0 → full size over FADE_IN_MS so newborns
      // grow out of nothing instead of popping at full scale.
      if (ent.bornAt) {
        const since = now - ent.bornAt;
        if (since < FADE_IN_MS) {
          const k = since / FADE_IN_MS;
          // Easing with a tiny overshoot so it lands with a hint of "puff"
          const e = k < 1 ? k * k * (3 - 2 * k) : 1;
          s *= 0.05 + 0.95 * e;
        }
      }

      // Plants sway in the wind: gentle Z roll + tiny X tilt, no heading.
      if (ent.type === TYPE.PLANT) {
        const wind = Math.sin(nowSec * 0.9 + ent.id * 0.4) * 0.10;
        const wind2 = Math.sin(nowSec * 1.3 + ent.id * 0.7) * 0.06;
        this._dummy.position.set(x, y, z);
        this._dummy.rotation.set(wind2, 0, wind);
      } else if (ent.type === TYPE.BUILDING) {
        this._dummy.position.set(x, y, z);
        this._dummy.rotation.set(0, 0, 0);
      } else {
        this._dummy.position.set(x, y, z);
        // Heading + idle look-around (Y) and walking pitch (Z)
        let yRot = -((ent.heading ?? 0)) + lookAround;
        let xTilt = 0;
        // Thronglet awareness: tilt the head/body back to look up at the
        // overhead camera and lock the heading so the look-around drift
        // doesn't break the stare.
        if (ent._thronglet) {
          yRot = -(ent.heading ?? 0);
          xTilt = (ent._thronglet.action === 'walk') ? -0.18 : -0.42;
        }
        this._dummy.rotation.set(xTilt, yRot, sway);
      }
      this._dummy.scale.set(s, s, s);
      this._dummy.updateMatrix();

      const entTier = ent.tier ?? 1;
      for (const part of parts) {
        // Tier-locked hut parts are written with a zero-scale matrix when
        // the building hasn't reached the required tier yet — keeps the
        // instance buffer dense without per-frame cost.
        if (part.minTier && entTier < part.minTier) {
          part.mesh.setMatrixAt(idx, this._hiddenMatrix);
        } else {
          part.mesh.setMatrixAt(idx, this._dummy.matrix);
        }
        const c = this._colorForPart(ent, part.colorRole);
        part.mesh.setColorAt(idx, c);
      }

      // Trait marker (pulsing)
      if (ent.trait && traitCount < MAX_ENTITIES) {
        const pulse = 1 + Math.sin(nowSec * 3.2 + ent.id) * 0.18;
        this._dummy.position.set(x, y, z);
        this._dummy.rotation.set(0, now * 0.002, 0);
        this._dummy.scale.set(s * pulse, s * pulse, s * pulse);
        this._dummy.updateMatrix();
        this.traitMarker.setMatrixAt(traitCount, this._dummy.matrix);
        this.traitMarker.setColorAt(traitCount, TRAIT_GLOW);
        traitCount++;
      }

      // Skill marker (Joshua ring)
      if (ent.skill && skillCount < MAX_ENTITIES) {
        const pulse = 1 + Math.sin(nowSec * 2.0 + ent.id) * 0.10;
        this._dummy.position.set(x, y + 0.01, z);
        this._dummy.rotation.set(0, now * 0.0015, 0);
        this._dummy.scale.set(s * pulse, s * pulse, s * pulse);
        this._dummy.updateMatrix();
        this.skillMarker.setMatrixAt(skillCount, this._dummy.matrix);
        this.skillMarker.setColorAt(skillCount, SKILL_GLOW);
        skillCount++;
      }
    }

    // ── Dying ghosts: draw fading-out copies of recently-killed entities
    // after the live ones, sharing the same per-type instance buffers. We
    // compact in-place as ghosts expire to keep allocation-free per frame.
    let writeIdx = 0;
    for (let i = 0; i < this._ghosts.length; i++) {
      const g = this._ghosts[i];
      const since = now - g.deadAt;
      if (since >= FADE_OUT_MS) continue; // drop
      if (i !== writeIdx) this._ghosts[writeIdx] = g;
      writeIdx++;

      const parts = this.partGroups[g.type];
      if (!parts) continue;
      const idx = counts[g.type];
      if (idx >= MAX_ENTITIES) continue;
      counts[g.type]++;

      const k = since / FADE_OUT_MS;
      const ease = 1 - (1 - k) * (1 - k); // ease-out
      const elev = tileRenderer3d.getElevationAt(Math.floor(g.x), Math.floor(g.z));
      const baseScale = g.scale ?? 1;
      const scale = baseScale * (1 - ease);
      this._dummy.position.set(g.x, elev + ease * 0.15, g.z);
      this._dummy.rotation.set(ease * 0.3, -(g.heading ?? 0), 0);
      this._dummy.scale.set(scale, scale, scale);
      this._dummy.updateMatrix();
      const ghostTier = g.tier ?? 1;
      for (const part of parts) {
        if (part.minTier && ghostTier < part.minTier) {
          part.mesh.setMatrixAt(idx, this._hiddenMatrix);
        } else {
          part.mesh.setMatrixAt(idx, this._dummy.matrix);
        }
        const c = this._colorForPart(g, part.colorRole);
        // Bleach toward grey as the ghost fades
        c.lerp(this._tmp.setRGB(0.5, 0.5, 0.55), ease * 0.6);
        part.mesh.setColorAt(idx, c);
      }
    }
    this._ghosts.length = writeIdx;

    for (const [type, parts] of Object.entries(this.partGroups)) {
      const cnt = counts[type];
      for (const part of parts) {
        part.mesh.count = cnt;
        part.mesh.instanceMatrix.needsUpdate = true;
        if (part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true;
      }
    }
    this.traitMarker.count = traitCount;
    this.traitMarker.instanceMatrix.needsUpdate = true;
    if (this.traitMarker.instanceColor) this.traitMarker.instanceColor.needsUpdate = true;
    this.skillMarker.count = skillCount;
    this.skillMarker.instanceMatrix.needsUpdate = true;
    if (this.skillMarker.instanceColor) this.skillMarker.instanceColor.needsUpdate = true;
  }

  _colorForPart(ent, role) {
    const c = this._color;
    switch (role) {
      case 'plantTrunk':       c.copy(PLANT_TRUNK); break;
      case 'plantLeaf':        c.copy(PLANT_COLOR); break;
      case 'sclera':           c.copy(SCLERA_COLOR); return c;
      case 'pupil':            c.copy(PUPIL_COLOR); return c;
      case 'predator-pupil':   c.copy(PREDATOR_PUPIL); return c;
      case 'hair':             c.copy(hairFor(ent)); return c;
      case 'hut-found':        c.copy(HUT_FOUND); return c;
      case 'hut-door':         c.copy(HUT_DOOR); return c;
      case 'hut-chimney':      c.copy(HUT_CHIMNEY); return c;
      case 'head':
        if (ent.type === TYPE.HERBIVORE) c.copy(HERBIVORE_HEAD);
        else if (ent.type === TYPE.PREDATOR) c.copy(PREDATOR_HEAD);
        else if (ent.type === TYPE.HUMAN)    c.copy(HUMAN_HEAD);
        else c.copy(HUMAN_HEAD);
        // Per-individual head hue jitter so a herd doesn't look like clones.
        this._jitter(c, ent.id, 0.04, 0.08, 0.06);
        break;
      case 'body':
        if (ent.type === TYPE.HERBIVORE) c.copy(HERBIVORE_COLOR);
        else if (ent.type === TYPE.PREDATOR) c.copy(PREDATOR_COLOR);
        else if (ent.type === TYPE.HUMAN) {
          c.copy(this._humanBodyColor(ent));
        }
        // Per-instance body hue/sat jitter — small but recognisable
        if (ent.type === TYPE.HERBIVORE) this._jitter(c, ent.id, 0.04, 0.10, 0.08);
        if (ent.type === TYPE.PREDATOR)  this._jitter(c, ent.id, 0.03, 0.10, 0.10);
        if (ent.type === TYPE.HUMAN)     this._jitter(c, ent.id, 0.03, 0.08, 0.06);
        break;
      case 'wall':
        c.copy(HUT_WALL);
        // Higher tiers tint walls slightly cooler (mortared stone) so the
        // upgrade reads at a glance.
        if ((ent.tier ?? 1) >= 2) c.lerp(HUT_FOUND, 0.30);
        if ((ent.tier ?? 1) >= 3) c.lerp(HUT_FOUND, 0.20);
        break;
      case 'roof':
        if (this.civ && ent.tribeId != null) {
          const t = this.civ.getTribe(ent.tribeId);
          if (t) { c.set(t.color); break; }
        }
        c.copy(HUT_FOUND);
        break;
      case 'tribe':
        // Banner — pure tribe colour so upgraded tribes' flags are unmistakable
        if (this.civ && ent.tribeId != null) {
          const t = this.civ.getTribe(ent.tribeId);
          if (t) { c.set(t.color); break; }
        }
        c.copy(HUT_FOUND);
        break;
      default: c.setRGB(1, 1, 1);
    }

    if (role === 'body') {
      if (ent.gestating) c.lerp(GESTATING_TINT, 0.45);
      else if (ent.hunger !== undefined && ent.hunger > 0.7) c.lerp(HUNGRY_TINT, 0.35);
      if (ent.frenzyTimer > 0) c.lerp(FRENZY_TINT, 0.30);
      if (ent.trait) c.lerp(TRAIT_TINT, 0.18);
      if (ent.skill) c.lerp(SKILL_TINT, 0.22);
    }
    return c;
  }

  /**
   * Apply a small id-stable hue/sat/light jitter to colour `c`. Keeps colours
   * recognisable as the species while making each individual unique.
   */
  _jitter(c, id, dHue, dSat, dLight) {
    const h = ((id * 9301 + 49297) % 233280) / 233280;
    const s = ((id * 4271 + 12345) % 233280) / 233280;
    const l = ((id * 7919 +    13) % 233280) / 233280;
    c.getHSL(this._hsl);
    const nh = (this._hsl.h + (h - 0.5) * dHue + 1) % 1;
    const ns = THREE.MathUtils.clamp(this._hsl.s + (s - 0.5) * dSat, 0, 1);
    const nl = THREE.MathUtils.clamp(this._hsl.l + (l - 0.5) * dLight, 0.05, 0.95);
    c.setHSL(nh, ns, nl);
  }

  _humanBodyColor(ent) {
    if (this.civ && ent.tribeId != null) {
      const t = this.civ.getTribe(ent.tribeId);
      if (t) {
        this._tmp.set(t.color);
        return this._tmp;
      }
    }
    this._tmp.copy(HUMAN_FALLBACK);
    return this._tmp;
  }

  setHighlighted(entity, tileRenderer3d) {
    if (!entity || !entity.alive) {
      this.highlight.visible = false;
      return;
    }
    const elev = tileRenderer3d.getElevationAt(entity.tileX, entity.tileY);
    this.highlight.position.set(entity.tileX + 0.5, elev + 0.08, entity.tileY + 0.5);
    const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.10;
    this.highlight.scale.set(pulse, pulse, pulse);
    this.highlight.visible = true;
  }
}
