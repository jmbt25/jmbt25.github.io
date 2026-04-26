/**
 * StatusBubbles — small camera-facing emoji/glyph billboards that float above
 * creatures to telegraph what they're feeling: alarm, hunger, love, war,
 * building, sleep. This single addition turns "robotic dots" into "characters
 * with intent" because the viewer can read state at a glance.
 *
 * Implementation:
 *   - One InstancedMesh per glyph kind, sharing a custom shader that auto-
 *     billboards (vertex shader puts the plane in view space and offsets
 *     in screen XY only).
 *   - Each glyph is rendered to a 128×128 canvas at startup with a soft
 *     dark pill background so it stays legible against any biome.
 *   - Each frame, every alive creature is classified into at most one bubble
 *     kind. Position is the same smoothed (fx, fz) used by EntityRenderer3D
 *     plus a head-height offset, plus a small bob.
 */
import * as THREE from 'three';
import { TYPE, MAX_ENTITIES } from '../core/constants.js';

const BUBBLE_GEOM = new THREE.PlaneGeometry(0.55, 0.55);

const VERTEX = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // World position of this instance — origin of the bubble.
    vec4 instancePos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec4 mv = modelViewMatrix * instancePos;
    // Read instance scale from the matrix's X column length.
    float s = length(vec3(instanceMatrix[0]));
    // Place the plane in screen space — always faces the camera.
    mv.xy += position.xy * s;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */`
  uniform sampler2D uMap;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uMap, vUv);
    if (c.a < 0.02) discard;
    gl_FragColor = c;
  }
`;

function makeGlyphTexture(glyph, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);

  // Soft drop shadow under the pill
  g.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(g, 14, 18, 100, 100, 28);
  g.fill();

  // Pill background
  g.fillStyle = 'rgba(15, 22, 36, 0.92)';
  roundRect(g, 12, 14, 100, 100, 28);
  g.fill();

  // Coloured stripe at the bottom
  g.fillStyle = color;
  roundRect(g, 12, 96, 100, 18, 0);
  g.fill();

  // Outer glow
  g.strokeStyle = 'rgba(255,255,255,0.18)';
  g.lineWidth = 2;
  roundRect(g, 12, 14, 100, 100, 28);
  g.stroke();

  // Glyph
  g.fillStyle = '#ffffff';
  g.font = 'bold 70px "Inter", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(glyph, 62, 60);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

const KINDS = [
  { id: 'alarm',    glyph: '!',   color: '#ff5764' },   // FLEE
  { id: 'hungry',   glyph: '…',   color: '#ffb45f' },   // SEEK_FOOD (high hunger)
  { id: 'love',     glyph: '♥',   color: '#ff7aa6' },   // SEEK_MATE
  { id: 'war',      glyph: '⚔',   color: '#e15252' },   // WAR or frenzy
  { id: 'build',    glyph: '⚒',   color: '#cba66e' },   // BUILD
  { id: 'baby',     glyph: '+',   color: '#7fd58c' },   // GESTATING
  { id: 'sleep',    glyph: 'z',   color: '#5fa8ff' },   // resting (well-fed wander)
  { id: 'aware',    glyph: '◉',   color: '#e6f0ff' },   // Thronglet awareness — looking at you
];

function pickKind(ent) {
  if (ent.type !== TYPE.HERBIVORE && ent.type !== TYPE.PREDATOR && ent.type !== TYPE.HUMAN) {
    return null;
  }
  // Thronglet awareness override — outranks every other state so a chosen
  // one staring at the camera is never masked by hunger/love/etc.
  if (ent._thronglet)           return 'aware';
  if (ent.gestating)            return 'baby';
  if (ent.frenzyTimer > 0)      return 'war';
  if (ent.state === 'flee')     return 'alarm';
  if (ent.state === 'war')      return 'war';
  if (ent.state === 'build')    return 'build';
  if (ent.state === 'seek_mate')return 'love';
  if (ent.state === 'seek_food' && (ent.hunger ?? 0) > 0.55) return 'hungry';
  // Occasional resting "z" when wandering and well-fed (for ambient charm)
  if (ent.state === 'wander' && (ent.hunger ?? 1) < 0.3 && ent.energy > 0.7) {
    // Show only intermittently — stable per-id phase modulated by tick.
    const tick = (performance.now() * 0.001 + ent.id * 0.7) | 0;
    if (tick % 9 < 3) return 'sleep';
  }
  return null;
}

export class StatusBubbles {
  constructor() {
    this.kinds = {};
    this._dummy = new THREE.Object3D();

    for (const k of KINDS) {
      const tex = makeGlyphTexture(k.glyph, k.color);
      const mat = new THREE.ShaderMaterial({
        uniforms: { uMap: { value: tex } },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
      });
      const mesh = new THREE.InstancedMesh(BUBBLE_GEOM, mat, MAX_ENTITIES);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = 5;
      this.kinds[k.id] = mesh;
    }

    this.allMeshes = Object.values(this.kinds);
  }

  /**
   * Place a bubble above every creature whose state warrants one.
   * Re-uses the same prevTile→tile lerp as EntityRenderer3D so the bubble
   * tracks the creature's visual (smoothly slid) position, not its discrete
   * tile-grid position.
   */
  update(registry, tileRenderer3d) {
    const now = performance.now();
    const counts = {};
    for (const k of Object.keys(this.kinds)) counts[k] = 0;

    for (const ent of registry.getAll()) {
      if (!ent.alive) continue;
      const kind = pickKind(ent);
      if (!kind) continue;

      // Mirror the entity renderer's smooth motion lerp.
      let fx = ent.tileX, fz = ent.tileY;
      if (ent.moveDurationMs > 0) {
        const t = Math.min(1, (now - ent.moveStartedAt) / ent.moveDurationMs);
        const e = t * t * (3 - 2 * t);
        fx = ent.prevTileX + (ent.tileX - ent.prevTileX) * e;
        fz = ent.prevTileY + (ent.tileY - ent.prevTileY) * e;
      }
      const tileX = Math.round(fx);
      const tileY = Math.round(fz);
      const elev = tileRenderer3d.getElevationAt(tileX, tileY);

      // Bob + breathe on the bubble for liveliness
      const bob = Math.sin(now * 0.004 + ent.id) * 0.04;
      const x = fx + 0.5;
      const z = fz + 0.5;
      const y = elev + 1.65 + bob;

      // Pulse scale so the bubble feels animated
      const scale = 0.8 + 0.18 * Math.sin(now * 0.006 + ent.id * 0.41);

      this._dummy.position.set(x, y, z);
      this._dummy.rotation.set(0, 0, 0);
      this._dummy.scale.set(scale, scale, scale);
      this._dummy.updateMatrix();

      const mesh = this.kinds[kind];
      const idx = counts[kind]++;
      if (idx >= MAX_ENTITIES) continue;
      mesh.setMatrixAt(idx, this._dummy.matrix);
    }

    for (const [k, mesh] of Object.entries(this.kinds)) {
      mesh.count = counts[k];
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
