/**
 * ParticleSystem — thin pool of GPU points that drift upward from a position.
 * Used for hut chimney smoke. The same instance can host multiple emitters
 * (one per active hut) by recycling slots round-robin.
 *
 * Designed to stay completely allocation-free per frame.
 */
import * as THREE from 'three';
import { TYPE } from '../core/constants.js';

const MAX_PARTICLES = 480;
const SPAWN_RATE = 0.8;          // particles per emitter per second

export class ParticleSystem {
  constructor() {
    this._positions = new Float32Array(MAX_PARTICLES * 3);
    this._sizes     = new Float32Array(MAX_PARTICLES);
    this._alphas    = new Float32Array(MAX_PARTICLES);
    this._velY      = new Float32Array(MAX_PARTICLES);
    this._driftX    = new Float32Array(MAX_PARTICLES);
    this._driftZ    = new Float32Array(MAX_PARTICLES);
    this._life      = new Float32Array(MAX_PARTICLES);    // remaining lifetime
    this._lifeMax   = new Float32Array(MAX_PARTICLES);

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this._positions[i * 3 + 1] = -9999;     // park off-screen
      this._alphas[i] = 0;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(this._positions, 3));
    geom.setAttribute('aSize',    new THREE.BufferAttribute(this._sizes,     1));
    geom.setAttribute('aAlpha',   new THREE.BufferAttribute(this._alphas,    1));

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite:  false,
      vertexColors: false,
      uniforms: {
        uColor: { value: new THREE.Color('#cdd2dc') },
      },
      vertexShader: `
        attribute float aSize;
        attribute float aAlpha;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (200.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          // Soft round particle
          vec2 d = gl_PointCoord - 0.5;
          float r = dot(d, d);
          if (r > 0.25) discard;
          float a = (1.0 - r * 4.0) * vAlpha;
          gl_FragColor = vec4(uColor, a);
        }
      `,
    });

    this.points = new THREE.Points(geom, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 0.6;

    this._geom = geom;
    this._next = 0;
    this._lastTime = performance.now();
    this._emitterAccum = new Map();    // entityId → fractional spawn count
  }

  /**
   * Drive emitters from the registry. Currently only buildings (huts) emit.
   */
  update(registry, tileRenderer3d) {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this._lastTime) / 1000);
    this._lastTime = now;

    // 1. Step existing particles
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this._life[i] <= 0) continue;
      this._life[i] -= dt;
      if (this._life[i] <= 0) {
        this._alphas[i] = 0;
        this._positions[i * 3 + 1] = -9999;
        continue;
      }
      this._positions[i * 3]     += this._driftX[i] * dt;
      this._positions[i * 3 + 1] += this._velY[i]   * dt;
      this._positions[i * 3 + 2] += this._driftZ[i] * dt;
      const t = this._life[i] / this._lifeMax[i];
      // ease in then fade
      this._alphas[i] = Math.min(0.6, t * 1.6) * (t > 0.7 ? 1 : t / 0.7);
      // smoke billows out — grow size as it ages
      this._sizes[i] = 8 + (1 - t) * 14;
    }

    // 2. Spawn from each living hut emitter
    const seen = new Set();
    for (const e of registry.getAll()) {
      if (!e.alive || e.type !== TYPE.BUILDING) continue;
      seen.add(e.id);
      let acc = this._emitterAccum.get(e.id) ?? 0;
      acc += SPAWN_RATE * dt;
      while (acc >= 1) {
        acc -= 1;
        this._spawnFromHut(e, tileRenderer3d);
      }
      this._emitterAccum.set(e.id, acc);
    }
    // Cleanup dead emitter accumulators
    for (const id of this._emitterAccum.keys()) {
      if (!seen.has(id)) this._emitterAccum.delete(id);
    }

    // 3. Flag GPU upload
    this._geom.attributes.position.needsUpdate = true;
    this._geom.attributes.aSize.needsUpdate    = true;
    this._geom.attributes.aAlpha.needsUpdate   = true;
  }

  _spawnFromHut(hut, tileRenderer3d) {
    const i = this._next;
    this._next = (this._next + 1) % MAX_PARTICLES;

    const elev = tileRenderer3d.getElevationAt(hut.tileX, hut.tileY);
    // Spawn at chimney height (~hut roof apex)
    this._positions[i * 3]     = hut.tileX + 0.5 + (Math.random() - 0.5) * 0.1;
    this._positions[i * 3 + 1] = elev + 1.0;
    this._positions[i * 3 + 2] = hut.tileY + 0.5 + (Math.random() - 0.5) * 0.1;
    this._velY[i]   = 0.7 + Math.random() * 0.5;
    this._driftX[i] = (Math.random() - 0.5) * 0.3;
    this._driftZ[i] = (Math.random() - 0.5) * 0.3;
    const life = 2.5 + Math.random() * 1.8;
    this._life[i] = life;
    this._lifeMax[i] = life;
    this._sizes[i] = 8;
    this._alphas[i] = 0;
  }

  /** Tint smoke colour (e.g. warmer at sunset). */
  setColor(threeColor) {
    this.points.material.uniforms.uColor.value.copy(threeColor);
  }
}
