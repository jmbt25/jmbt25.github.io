import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TYPE, MAX_ENTITIES } from '../core/constants.js';
import { UNAFFILIATED_COLOR } from '../sim/Tribe.js';

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
// Herbivore — fluffy sheep. Wider body with a wool-look head bobble, stubby legs.
function buildHerbivoreBody() {
  const body  = ellipsoid(0.36, 0.30, 0.28, 0, 0.34, 0);
  const wool1 = sphere(0.10, 0.18, 0.50, 0.10);
  const wool2 = sphere(0.10, 0.18, 0.50,-0.10);
  const wool3 = sphere(0.09,-0.20, 0.50, 0.12);
  const wool4 = sphere(0.09,-0.20, 0.50,-0.12);
  const legFL = cyl(0.06, 0.06, 0.18,  0.20, 0,  0.16);
  const legFR = cyl(0.06, 0.06, 0.18,  0.20, 0, -0.16);
  const legBL = cyl(0.06, 0.06, 0.18, -0.20, 0,  0.16);
  const legBR = cyl(0.06, 0.06, 0.18, -0.20, 0, -0.16);
  const tail  = sphere(0.08, -0.36, 0.36, 0);
  return merge([body, wool1, wool2, wool3, wool4, legFL, legFR, legBL, legBR, tail]);
}
function buildHerbivoreHead() {
  const skull = sphere(0.16, 0.40, 0.42, 0);
  const muzz  = ellipsoid(0.07, 0.06, 0.06, 0.55, 0.36, 0);
  const earL  = cone(0.05, 0.12, 0.36, 0.55,  0.10, 4);
  const earR  = cone(0.05, 0.12, 0.36, 0.55, -0.10, 4);
  return merge([skull, muzz, earL, earR]);
}
function buildHerbivoreEyes() {
  // White sclera spheres only — pupils are a separate part rendered black.
  const eyeL = sphere(0.034, 0.510, 0.46,  0.085, 8, 7);
  const eyeR = sphere(0.034, 0.510, 0.46, -0.085, 8, 7);
  return merge([eyeL, eyeR]);
}
function buildHerbivorePupils() {
  const pL = sphere(0.018, 0.540, 0.46,  0.090, 6, 6);
  const pR = sphere(0.018, 0.540, 0.46, -0.090, 6, 6);
  return merge([pL, pR]);
}

// Predator — wolfy. Lean body, longer snout, bushy tail.
function buildPredatorBody() {
  const body  = ellipsoid(0.42, 0.22, 0.22, 0, 0.30, 0);
  const ruff  = ellipsoid(0.13, 0.18, 0.22, 0.32, 0.34, 0);   // shoulder ruff
  const legFL = cyl(0.06, 0.06, 0.26,  0.24, 0,  0.16);
  const legFR = cyl(0.06, 0.06, 0.26,  0.24, 0, -0.16);
  const legBL = cyl(0.06, 0.06, 0.26, -0.24, 0,  0.16);
  const legBR = cyl(0.06, 0.06, 0.26, -0.24, 0, -0.16);
  // Bushy tail (cone + sphere tip) angled up
  const tailG = new THREE.ConeGeometry(0.07, 0.32, 6);
  tailG.rotateZ(Math.PI / 2 + 0.25);
  tailG.translate(-0.50, 0.42, 0);
  const tailTip = sphere(0.085, -0.66, 0.50, 0, 7, 6);
  return merge([body, ruff, legFL, legFR, legBL, legBR, tailG, tailTip]);
}
function buildPredatorHead() {
  const skull = sphere(0.18, 0.46, 0.40, 0);
  const snout = (() => {
    const g = new THREE.ConeGeometry(0.10, 0.22, 6);
    g.rotateZ(-Math.PI / 2);
    g.translate(0.70, 0.36, 0);
    return g;
  })();
  // Triangular ears
  const earL = cone(0.06, 0.13, 0.42, 0.55,  0.12, 4);
  const earR = cone(0.06, 0.13, 0.42, 0.55, -0.12, 4);
  return merge([skull, snout, earL, earR]);
}
function buildPredatorEyes() {
  const eyeL = sphere(0.030, 0.59, 0.45,  0.10, 8, 7);
  const eyeR = sphere(0.030, 0.59, 0.45, -0.10, 8, 7);
  return merge([eyeL, eyeR]);
}
function buildPredatorPupils() {
  const pL = sphere(0.018, 0.620, 0.46,  0.105, 6, 6);
  const pR = sphere(0.018, 0.620, 0.46, -0.105, 6, 6);
  return merge([pL, pR]);
}

// Human — torso with belt, arms, legs. Eyes + hair are separate parts.
function buildHumanBody() {
  const torso = (() => {
    const g = new THREE.CapsuleGeometry(0.13, 0.30, 4, 9);
    g.translate(0, 0.55, 0);
    return g;
  })();
  // Belt — a thin contrasting band around the waist
  const belt = (() => {
    const g = new THREE.CylinderGeometry(0.142, 0.142, 0.05, 12);
    g.translate(0, 0.42, 0);
    return g;
  })();
  const legL = cyl(0.07, 0.07, 0.34,  0.0, 0,  0.08);
  const legR = cyl(0.07, 0.07, 0.34,  0.0, 0, -0.08);
  const armL = (() => {
    const g = new THREE.CapsuleGeometry(0.05, 0.22, 4, 8);
    g.translate(0, 0.55, 0.20);
    return g;
  })();
  const armR = (() => {
    const g = new THREE.CapsuleGeometry(0.05, 0.22, 4, 8);
    g.translate(0, 0.55, -0.20);
    return g;
  })();
  return merge([torso, belt, legL, legR, armL, armR]);
}
function buildHumanHead() {
  return sphere(0.13, 0, 0.92, 0, 14, 11);
}
function buildHumanEyes() {
  const eyeL = sphere(0.024, 0.115, 0.95,  0.055, 8, 7);
  const eyeR = sphere(0.024, 0.115, 0.95, -0.055, 8, 7);
  return merge([eyeL, eyeR]);
}
function buildHumanPupils() {
  const pL = sphere(0.013, 0.130, 0.95,  0.060, 6, 6);
  const pR = sphere(0.013, 0.130, 0.95, -0.060, 6, 6);
  return merge([pL, pR]);
}
function buildHumanHair() {
  // Cap-style hair: a half-sphere on top of the head, slightly forward-leaning.
  const g = new THREE.SphereGeometry(0.135, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  g.translate(0.02, 0.96, 0);
  return g;
}

// Plants — kept as one mesh for the simulated plant (unrelated to terrain
// decorations).  A trunk + 3-cone evergreen.
function buildPlantTrunk() {
  return cyl(0.06, 0.10, 0.30, 0, 0, 0, 6);
}
function buildPlantFoliage() {
  const c1 = cone(0.30, 0.50, 0, 0.22, 0, 6);
  const c2 = cone(0.22, 0.40, 0, 0.55, 0, 6);
  const c3 = cone(0.14, 0.30, 0, 0.85, 0, 6);
  return merge([c1, c2, c3]);
}

// Hut — stone foundation + wooden walls + thatched roof + door + chimney
function buildHutFoundation() {
  // Slightly wider stone ring beneath the walls
  const g = new THREE.CylinderGeometry(0.50, 0.55, 0.08, 8);
  g.translate(0, 0.04, 0);
  return g;
}
function buildHutWalls() {
  return box(0.7, 0.42, 0.7, 0, 0.29, 0);
}
function buildHutRoof() {
  // Thicker pyramid roof + small ridge ball
  const g = new THREE.ConeGeometry(0.58, 0.40, 4);
  g.rotateY(Math.PI / 4);
  g.translate(0, 0.70, 0);
  return g;
}
function buildHutDoor() {
  return box(0.04, 0.22, 0.16, 0.36, 0.13, 0);
}
function buildHutChimney() {
  const g = new THREE.BoxGeometry(0.10, 0.22, 0.10);
  g.translate(-0.18, 0.85, -0.18);
  return g;
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

function hairFor(ent) {
  return HAIR_COLORS[Math.abs(ent.id) % HAIR_COLORS.length];
}

// ── Renderer ──────────────────────────────────────────────────────────────

export class EntityRenderer3D {
  constructor() {
    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();
    this._tmp   = new THREE.Color();
    this._hsl   = { h: 0, s: 0, l: 0 };   // reused across _jitter calls
    this.civ    = null;

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
      return { mesh, colorRole };
    };

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
      makeMesh(buildHutFoundation(), 'hut-found',  { receiveShadow: true }),
      makeMesh(buildHutWalls(),      'wall',       { receiveShadow: true }),
      makeMesh(buildHutRoof(),       'roof'),
      makeMesh(buildHutDoor(),       'hut-door'),
      makeMesh(buildHutChimney(),    'hut-chimney'),
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

      // Walk bob: bigger and more rhythmic for visible cadence
      const bob = isMoving ? Math.abs(Math.sin(now * 0.018 + ent.id * 0.13)) * 0.07 : 0;
      // Idle breathing for stationary creatures (not plants/buildings)
      const breath = (!isMoving && ent.type !== TYPE.PLANT && ent.type !== TYPE.BUILDING)
        ? Math.sin(nowSec * 1.6 + ent.id * 0.7) * 0.012
        : 0;
      // Walking sway: slight Z-axis roll while moving
      const sway = isMoving ? Math.sin(now * 0.020 + ent.id * 0.23) * 0.10 : 0;

      const x = fx + 0.5;
      const z = fz + 0.5;
      const y = elev + bob;

      let scale = ent.scale ?? 1;
      let s = scale + breath;
      if (ent.type === TYPE.PLANT && ent.stage !== undefined) {
        s = scale * (0.5 + ent.stage * 0.30);
      }

      this._dummy.position.set(x, y, z);
      // Heading rotation (Y) + a small Z roll for walking sway
      this._dummy.rotation.set(0, -((ent.heading ?? 0)), sway);
      this._dummy.scale.set(s, s, s);
      this._dummy.updateMatrix();

      for (const part of parts) {
        part.mesh.setMatrixAt(idx, this._dummy.matrix);
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
      case 'wall': c.copy(HUT_WALL); break;
      case 'roof':
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
