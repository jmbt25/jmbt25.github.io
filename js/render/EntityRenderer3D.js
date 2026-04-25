import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TYPE, MAX_ENTITIES } from '../core/constants.js';
import { UNAFFILIATED_COLOR } from '../sim/Tribe.js';

// ── Geometry helpers ──────────────────────────────────────────────────────
// All creature parts are baked into local space with +X = forward.
// At runtime each entity gets a single transform: position + rotation Y(-heading) + scale.
// Every part of that entity reuses that same matrix.

function box(w, h, d, ox = 0, oy = 0, oz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(ox, oy, oz);
  return g;
}
function sphere(r, ox = 0, oy = 0, oz = 0, ws = 10, hs = 8) {
  const g = new THREE.SphereGeometry(r, ws, hs);
  g.translate(ox, oy, oz);
  return g;
}
function ellipsoid(rx, ry, rz, ox = 0, oy = 0, oz = 0, ws = 10, hs = 8) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.scale(rx, ry, rz);
  g.translate(ox, oy, oz);
  return g;
}
function cone(r, h, ox = 0, oy = 0, oz = 0, seg = 6) {
  const g = new THREE.ConeGeometry(r, h, seg);
  g.translate(ox, oy + h / 2, oz);
  return g;
}
function cyl(rt, rb, h, ox = 0, oy = 0, oz = 0, seg = 6) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.translate(ox, oy + h / 2, oz);
  return g;
}

function merge(geoms) {
  for (const g of geoms) {
    if (g.attributes.uv) g.deleteAttribute('uv');
  }
  return mergeGeometries(geoms, false);
}

// ── Body assemblies ───────────────────────────────────────────────────────

function buildHerbivoreBody() {
  const body  = ellipsoid(0.34, 0.26, 0.24, 0, 0.32, 0);
  const legFL = cyl(0.05, 0.05, 0.18,  0.18, 0,  0.14);
  const legFR = cyl(0.05, 0.05, 0.18,  0.18, 0, -0.14);
  const legBL = cyl(0.05, 0.05, 0.18, -0.18, 0,  0.14);
  const legBR = cyl(0.05, 0.05, 0.18, -0.18, 0, -0.14);
  const tail  = sphere(0.07, -0.34, 0.34, 0);
  return merge([body, legFL, legFR, legBL, legBR, tail]);
}
function buildHerbivoreHead() {
  const skull = sphere(0.16, 0.36, 0.42, 0);
  const earL  = cone(0.05, 0.10, 0.36, 0.55,  0.08, 4);
  const earR  = cone(0.05, 0.10, 0.36, 0.55, -0.08, 4);
  return merge([skull, earL, earR]);
}
function buildHerbivoreEyes() {
  const eyeL = sphere(0.025, 0.49, 0.45,  0.07, 6, 6);
  const eyeR = sphere(0.025, 0.49, 0.45, -0.07, 6, 6);
  return merge([eyeL, eyeR]);
}

function buildPredatorBody() {
  const body  = ellipsoid(0.40, 0.22, 0.22, 0, 0.30, 0);
  const legFL = cyl(0.06, 0.06, 0.24,  0.22, 0,  0.16);
  const legFR = cyl(0.06, 0.06, 0.24,  0.22, 0, -0.16);
  const legBL = cyl(0.06, 0.06, 0.24, -0.22, 0,  0.16);
  const legBR = cyl(0.06, 0.06, 0.24, -0.22, 0, -0.16);
  const tailGeom = new THREE.ConeGeometry(0.06, 0.30, 5);
  tailGeom.rotateZ(Math.PI / 2);
  tailGeom.translate(-0.55, 0.32, 0);
  return merge([body, legFL, legFR, legBL, legBR, tailGeom]);
}
function buildPredatorHead() {
  const skull = sphere(0.17, 0.42, 0.40, 0);
  const snoutGeom = new THREE.ConeGeometry(0.09, 0.18, 5);
  snoutGeom.rotateZ(-Math.PI / 2);
  snoutGeom.translate(0.62, 0.36, 0);
  const earL = cone(0.05, 0.10, 0.40, 0.55,  0.10, 4);
  const earR = cone(0.05, 0.10, 0.40, 0.55, -0.10, 4);
  return merge([skull, snoutGeom, earL, earR]);
}
function buildPredatorEyes() {
  const eyeL = sphere(0.028, 0.55, 0.43,  0.10, 6, 6);
  const eyeR = sphere(0.028, 0.55, 0.43, -0.10, 6, 6);
  return merge([eyeL, eyeR]);
}

function buildHumanBody() {
  const torso = (() => {
    const g = new THREE.CapsuleGeometry(0.13, 0.34, 4, 8);
    g.translate(0, 0.55, 0);
    return g;
  })();
  const legL = cyl(0.07, 0.07, 0.34,  0.0, 0,  0.08);
  const legR = cyl(0.07, 0.07, 0.34,  0.0, 0, -0.08);
  const armL = cyl(0.05, 0.05, 0.30,  0.0, 0.45,  0.20);
  const armR = cyl(0.05, 0.05, 0.30,  0.0, 0.45, -0.20);
  return merge([torso, legL, legR, armL, armR]);
}
function buildHumanHead() {
  const head = sphere(0.13, 0, 0.92, 0);
  return head;
}
function buildHumanEyes() {
  const eyeL = sphere(0.020, 0.115, 0.95,  0.05, 6, 6);
  const eyeR = sphere(0.020, 0.115, 0.95, -0.05, 6, 6);
  return merge([eyeL, eyeR]);
}

function buildPlantTrunk() {
  return cyl(0.06, 0.10, 0.30, 0, 0, 0, 6);
}
function buildPlantFoliage() {
  const c1 = cone(0.30, 0.50, 0, 0.22, 0, 6);
  const c2 = cone(0.22, 0.40, 0, 0.55, 0, 6);
  const c3 = cone(0.14, 0.30, 0, 0.85, 0, 6);
  return merge([c1, c2, c3]);
}

function buildHutWalls() {
  return box(0.7, 0.45, 0.7, 0, 0.225, 0);
}
function buildHutRoof() {
  const g = new THREE.ConeGeometry(0.55, 0.35, 4);
  g.rotateY(Math.PI / 4);
  g.translate(0, 0.625, 0);
  return g;
}
function buildHutDoor() {
  // Small dark door panel facing +X (the hut's "front")
  const door = box(0.04, 0.22, 0.16, 0.36, 0.13, 0);
  return door;
}

// ── Color helpers ─────────────────────────────────────────────────────────

const PLANT_COLOR     = new THREE.Color('#4ea83a');
const PLANT_TRUNK     = new THREE.Color('#5c3d1e');
const HERBIVORE_COLOR = new THREE.Color('#e8d670');
const HERBIVORE_HEAD  = new THREE.Color('#c4b25a');
const PREDATOR_COLOR  = new THREE.Color('#c43a3a');
const PREDATOR_HEAD   = new THREE.Color('#7a2222');
const HUMAN_FALLBACK  = new THREE.Color(UNAFFILIATED_COLOR);
const HUMAN_HEAD      = new THREE.Color('#f0c69a');
const HUT_WALL        = new THREE.Color('#7a5a3a');
const HUT_ROOF        = new THREE.Color('#444444');
const HUT_DOOR        = new THREE.Color('#3a2818');
const EYE_COLOR       = new THREE.Color('#101015');
const HUNGRY_TINT     = new THREE.Color('#202020');
const GESTATING_TINT  = new THREE.Color('#ff80a0');
const TRAIT_TINT      = new THREE.Color('#ffd34d');
const TRAIT_GLOW      = new THREE.Color('#fff0a0');
const SKILL_TINT      = new THREE.Color('#5fd8ff');
const SKILL_GLOW      = new THREE.Color('#9fe8ff');
const FRENZY_TINT     = new THREE.Color('#ff4040');

// ── Renderer ──────────────────────────────────────────────────────────────

export class EntityRenderer3D {
  constructor() {
    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();
    this._tmp   = new THREE.Color();
    this.civ    = null;

    this.partGroups = {};

    const baseMat = (extra) => new THREE.MeshStandardMaterial({
      vertexColors: false,
      roughness:    0.85,
      metalness:    0.0,
      flatShading:  true,
      ...extra,
    });

    const makeMesh = (geom, colorRole, extra) => {
      const mat = baseMat(extra);
      const mesh = new THREE.InstancedMesh(geom, mat, MAX_ENTITIES);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
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
      makeMesh(buildHerbivoreBody(), 'body'),
      makeMesh(buildHerbivoreHead(), 'head'),
      makeMesh(buildHerbivoreEyes(), 'eye'),
    ];
    this.partGroups[TYPE.PREDATOR] = [
      makeMesh(buildPredatorBody(), 'body'),
      makeMesh(buildPredatorHead(), 'head'),
      makeMesh(buildPredatorEyes(), 'eye'),
    ];
    this.partGroups[TYPE.HUMAN] = [
      makeMesh(buildHumanBody(), 'body'),
      makeMesh(buildHumanHead(), 'head'),
      makeMesh(buildHumanEyes(), 'eye'),
    ];
    this.partGroups[TYPE.BUILDING] = [
      makeMesh(buildHutWalls(), 'wall'),
      makeMesh(buildHutRoof(),  'roof'),
      makeMesh(buildHutDoor(),  'door'),
    ];

    // Trait marker
    const tg = new THREE.OctahedronGeometry(0.12, 0);
    tg.translate(0, 1.45, 0);
    const tm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
    this.traitMarker = new THREE.InstancedMesh(tg, tm, MAX_ENTITIES);
    this.traitMarker.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.traitMarker.frustumCulled = false;
    this.traitMarker.count = 0;
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
    this.skillMarker.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(MAX_ENTITIES * 3), 3
    );

    // Highlight ring — animated radius
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
      if (ent.moveDurationMs > 0) {
        const t = Math.min(1, (now - ent.moveStartedAt) / ent.moveDurationMs);
        const e = t * t * (3 - 2 * t);
        fx = ent.prevTileX + (ent.tileX - ent.prevTileX) * e;
        fz = ent.prevTileY + (ent.tileY - ent.prevTileY) * e;
        isMoving = t < 1;
      }
      const tileX = Math.round(fx);
      const tileY = Math.round(fz);
      const elev = tileRenderer3d.getElevationAt(tileX, tileY);

      const bob = isMoving ? Math.abs(Math.sin(now * 0.012 + ent.id)) * 0.05 : 0;
      // Subtle idle breathing — uniform up-down sway when stationary
      const breath = (!isMoving && ent.type !== TYPE.PLANT && ent.type !== TYPE.BUILDING)
        ? Math.sin(nowSec * 1.6 + ent.id * 0.7) * 0.012
        : 0;

      const x = fx + 0.5;
      const z = fz + 0.5;
      const y = elev + bob;

      let scale = ent.scale ?? 1;
      let s = scale + breath;
      if (ent.type === TYPE.PLANT && ent.stage !== undefined) {
        s = scale * (0.5 + ent.stage * 0.30);
      }

      this._dummy.position.set(x, y, z);
      this._dummy.rotation.set(0, -((ent.heading ?? 0)), 0);
      this._dummy.scale.set(s, s, s);
      this._dummy.updateMatrix();

      for (const part of parts) {
        part.mesh.setMatrixAt(idx, this._dummy.matrix);
        const c = this._colorForPart(ent, part.colorRole);
        part.mesh.setColorAt(idx, c);
      }

      // Trait marker
      if (ent.trait && traitCount < MAX_ENTITIES) {
        // Pulse the marker so it's catchier
        const pulse = 1 + Math.sin(nowSec * 3.2 + ent.id) * 0.18;
        this._dummy.position.set(x, y, z);
        this._dummy.rotation.set(0, now * 0.002, 0);
        this._dummy.scale.set(s * pulse, s * pulse, s * pulse);
        this._dummy.updateMatrix();
        this.traitMarker.setMatrixAt(traitCount, this._dummy.matrix);
        this.traitMarker.setColorAt(traitCount, TRAIT_GLOW);
        traitCount++;
      }

      // Skill marker
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
      case 'plantTrunk': c.copy(PLANT_TRUNK); break;
      case 'plantLeaf':  c.copy(PLANT_COLOR); break;
      case 'eye':        c.copy(EYE_COLOR);   return c;   // eyes never tint
      case 'head':
        if (ent.type === TYPE.HERBIVORE) c.copy(HERBIVORE_HEAD);
        else if (ent.type === TYPE.PREDATOR) c.copy(PREDATOR_HEAD);
        else if (ent.type === TYPE.HUMAN)    c.copy(HUMAN_HEAD);
        else c.copy(HUMAN_HEAD);
        break;
      case 'body':
        if (ent.type === TYPE.HERBIVORE) c.copy(HERBIVORE_COLOR);
        else if (ent.type === TYPE.PREDATOR) c.copy(PREDATOR_COLOR);
        else if (ent.type === TYPE.HUMAN) {
          c.copy(this._humanBodyColor(ent));
        }
        break;
      case 'wall': c.copy(HUT_WALL); break;
      case 'door': c.copy(HUT_DOOR); break;
      case 'roof':
        if (this.civ && ent.tribeId != null) {
          const t = this.civ.getTribe(ent.tribeId);
          if (t) { c.set(t.color); break; }
        }
        c.copy(HUT_ROOF);
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
    // Pulse the highlight ring
    const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.10;
    this.highlight.scale.set(pulse, pulse, pulse);
    this.highlight.visible = true;
  }
}
