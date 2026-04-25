/**
 * EffectsSystem — short-lived coloured particle bursts that punctuate sim
 * events. Subscribes to the eventBus and emits bursts at the relevant tile:
 *
 *   entity:born      → green sparkle ring (life)
 *   entity:died      → grey/dark puff (death poof)
 *   entity:ate       → leaves (plant) or red splatter (meat)
 *   entity:attacked  → yellow combat sparks
 *   entity:built     → wood chips
 *
 * Plus continuous ambient effects:
 *   - footstep dust for fast-moving creatures (flee / frenzy)
 *
 * Single GPU Points object, ~900 particles, allocation-free per frame.
 */
import * as THREE from 'three';
import { eventBus } from '../core/eventBus.js';
import { TYPE } from '../core/constants.js';

const MAX_PARTICLES = 900;
const GRAVITY = 1.6;

const VERTEX = /* glsl */`
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3  aColor;
  varying float vAlpha;
  varying vec3  vColor;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (260.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */`
  varying float vAlpha;
  varying vec3  vColor;
  void main() {
    if (vAlpha < 0.01) discard;
    vec2 d = gl_PointCoord - 0.5;
    float r = dot(d, d);
    if (r > 0.25) discard;
    float a = (1.0 - r * 4.0) * vAlpha;
    gl_FragColor = vec4(vColor, a);
  }
`;

export class EffectsSystem {
  constructor(tileRenderer3d, registry) {
    this.tile = tileRenderer3d;
    this.registry = registry;

    this._positions = new Float32Array(MAX_PARTICLES * 3);
    this._sizes     = new Float32Array(MAX_PARTICLES);
    this._alphas    = new Float32Array(MAX_PARTICLES);
    this._colors    = new Float32Array(MAX_PARTICLES * 3);
    this._velX      = new Float32Array(MAX_PARTICLES);
    this._velY      = new Float32Array(MAX_PARTICLES);
    this._velZ      = new Float32Array(MAX_PARTICLES);
    this._life      = new Float32Array(MAX_PARTICLES);
    this._lifeMax   = new Float32Array(MAX_PARTICLES);
    this._gravScale = new Float32Array(MAX_PARTICLES);
    this._next = 0;
    this._lastTime = performance.now();
    this._dustAccum = new Map();   // entityId → fractional dust spawn count

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this._positions[i * 3 + 1] = -9999;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(this._positions, 3));
    geom.setAttribute('aSize',    new THREE.BufferAttribute(this._sizes,     1));
    geom.setAttribute('aAlpha',   new THREE.BufferAttribute(this._alphas,    1));
    geom.setAttribute('aColor',   new THREE.BufferAttribute(this._colors,    3));

    const mat = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader:   VERTEX,
      fragmentShader: FRAGMENT,
      transparent:    true,
      depthWrite:     false,
    });

    this.points = new THREE.Points(geom, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 0.7;
    this._geom = geom;

    eventBus.on('entity:born',     ({ entity })             => this._onBorn(entity));
    eventBus.on('entity:died',     (entity)                 => this._onDied(entity));
    eventBus.on('entity:ate',      ({ eater, food })        => this._onAte(eater, food));
    eventBus.on('entity:attacked', ({ attacker, target })   => this._onAttacked(attacker, target));
  }

  _spawn(x, y, z, vx, vy, vz, life, color, size, gravScale = 1.0) {
    const i = this._next;
    this._next = (this._next + 1) % MAX_PARTICLES;
    this._positions[i * 3]     = x;
    this._positions[i * 3 + 1] = y;
    this._positions[i * 3 + 2] = z;
    this._velX[i]   = vx;
    this._velY[i]   = vy;
    this._velZ[i]   = vz;
    this._life[i]   = life;
    this._lifeMax[i]= life;
    this._sizes[i]  = size;
    this._alphas[i] = 0;
    this._colors[i * 3]     = color.r;
    this._colors[i * 3 + 1] = color.g;
    this._colors[i * 3 + 2] = color.b;
    this._gravScale[i] = gravScale;
  }

  _onBorn(entity) {
    if (entity.type !== TYPE.HERBIVORE && entity.type !== TYPE.PREDATOR && entity.type !== TYPE.HUMAN) return;
    const elev = this.tile.getElevationAt(entity.tileX, entity.tileY);
    const x = entity.tileX + 0.5, z = entity.tileY + 0.5;
    const c = new THREE.Color('#a8ffce');
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Math.random() * 0.4;
      const s = 0.5 + Math.random() * 0.7;
      this._spawn(
        x, elev + 0.4, z,
        Math.cos(a) * s, 1.0 + Math.random() * 0.6, Math.sin(a) * s,
        0.9 + Math.random() * 0.3, c, 13, 0.6,
      );
    }
  }

  _onDied(entity) {
    if (entity.type !== TYPE.HERBIVORE && entity.type !== TYPE.PREDATOR && entity.type !== TYPE.HUMAN) return;
    const elev = this.tile.getElevationAt(entity.tileX, entity.tileY);
    const x = entity.tileX + 0.5, z = entity.tileY + 0.5;
    const c = new THREE.Color('#5e5147');
    for (let i = 0; i < 10; i++) {
      this._spawn(
        x, elev + 0.4, z,
        (Math.random() - 0.5) * 0.9, 0.4 + Math.random() * 0.4, (Math.random() - 0.5) * 0.9,
        1.0 + Math.random() * 0.4, c, 16, 0.5,
      );
    }
  }

  _onAte(eater, food) {
    if (!food) return;
    const elev = this.tile.getElevationAt(food.tileX, food.tileY);
    const x = food.tileX + 0.5, z = food.tileY + 0.5;
    const c = food.type === TYPE.PLANT
      ? new THREE.Color('#7ad358')           // green leaves
      : new THREE.Color('#d04040');          // red meat
    const n = food.type === TYPE.PLANT ? 8 : 12;
    for (let i = 0; i < n; i++) {
      this._spawn(
        x, elev + 0.3, z,
        (Math.random() - 0.5) * 1.4,
        0.5 + Math.random() * 0.6,
        (Math.random() - 0.5) * 1.4,
        0.7 + Math.random() * 0.3, c, 11, 1.2,
      );
    }
  }

  _onAttacked(attacker, target) {
    if (!target) return;
    const elev = this.tile.getElevationAt(target.tileX, target.tileY);
    const x = target.tileX + 0.5, z = target.tileY + 0.5;
    const c = new THREE.Color('#ffe27a');
    for (let i = 0; i < 7; i++) {
      this._spawn(
        x, elev + 0.7, z,
        (Math.random() - 0.5) * 1.8,
        0.6 + Math.random() * 0.7,
        (Math.random() - 0.5) * 1.8,
        0.35 + Math.random() * 0.2, c, 9, 1.4,
      );
    }
  }

  /**
   * Continuous footstep dust for sprinting creatures (flee or frenzy).
   * Sampled per frame with delta-time scaling so the rate is framerate-independent.
   */
  _emitFootstepDust(dt) {
    const c = new THREE.Color('#a89070');
    for (const e of this.registry.getAll()) {
      if (!e.alive) continue;
      // Only fast-moving creatures kick up dust
      const sprinting = (e.state === 'flee') || (e.frenzyTimer > 0);
      if (!sprinting) continue;
      // No dust unless visibly mid-step
      if (!e.moveDurationMs) continue;
      const t = (performance.now() - e.moveStartedAt) / e.moveDurationMs;
      if (t < 0 || t > 1) continue;

      let acc = (this._dustAccum.get(e.id) ?? 0) + dt * 6;     // ~6/sec
      while (acc >= 1) {
        acc -= 1;
        const elev = this.tile.getElevationAt(e.tileX, e.tileY);
        this._spawn(
          e.tileX + 0.5 + (Math.random() - 0.5) * 0.4,
          elev + 0.05,
          e.tileY + 0.5 + (Math.random() - 0.5) * 0.4,
          (Math.random() - 0.5) * 0.5,
          0.25 + Math.random() * 0.3,
          (Math.random() - 0.5) * 0.5,
          0.55 + Math.random() * 0.25, c, 12, 0.4,
        );
      }
      this._dustAccum.set(e.id, acc);
    }
  }

  update() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this._lastTime) / 1000);
    this._lastTime = now;

    this._emitFootstepDust(dt);

    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this._life[i] <= 0) continue;
      this._life[i] -= dt;
      if (this._life[i] <= 0) {
        this._alphas[i] = 0;
        this._positions[i * 3 + 1] = -9999;
        continue;
      }
      this._velY[i] -= GRAVITY * this._gravScale[i] * dt;
      this._positions[i * 3]     += this._velX[i] * dt;
      this._positions[i * 3 + 1] += this._velY[i] * dt;
      this._positions[i * 3 + 2] += this._velZ[i] * dt;
      const t = this._life[i] / this._lifeMax[i];
      this._alphas[i] = t > 0.65 ? (1 - t) / 0.35 : t / 0.65;
    }

    this._geom.attributes.position.needsUpdate = true;
    this._geom.attributes.aAlpha.needsUpdate   = true;
  }
}
