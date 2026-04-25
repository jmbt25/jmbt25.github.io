/**
 * Fireflies — small glowing points that drift over forest/grass tiles after
 * dusk and fade out at dawn. Visibility is driven by the SkySystem's current
 * phase so the swarm only appears during the night band.
 *
 * Cheap: a single Points mesh of ~280 sprites, animated entirely in the
 * vertex shader using time + per-instance offsets.
 */
import * as THREE from 'three';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../core/constants.js';
import { TERRAIN } from '../world/TerrainType.js';

const COUNT = 280;

const VERTEX = /* glsl */`
  uniform float uTime;
  uniform float uVisibility;
  attribute float aPhase;
  attribute float aRadius;
  attribute vec3  aHome;
  varying float vFlicker;

  void main() {
    float t = uTime * 0.6 + aPhase * 6.283;
    // Lazy figure-8 path
    vec3 wobble = vec3(
      cos(t)        * aRadius,
      sin(t * 0.7)  * 0.4 + 0.5 * sin(t * 1.3 + aPhase),
      sin(t * 1.1)  * aRadius
    );
    vec3 worldPos = aHome + wobble;
    vec4 mv = modelViewMatrix * vec4(worldPos, 1.0);
    gl_PointSize = (3.0 + 1.5 * sin(t * 3.0 + aPhase * 4.0)) * (200.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
    // Flicker — slow envelope of brightness
    vFlicker = uVisibility * (0.5 + 0.5 * sin(t * 2.0 + aPhase * 5.0));
  }
`;

const FRAGMENT = /* glsl */`
  uniform vec3 uColor;
  varying float vFlicker;

  void main() {
    if (vFlicker < 0.02) discard;
    vec2 d = gl_PointCoord - 0.5;
    float r = dot(d, d);
    if (r > 0.25) discard;
    float a = (1.0 - r * 4.0) * vFlicker;
    // Glow halo
    vec3 col = uColor + (1.0 - r * 4.0) * vec3(0.5, 0.6, 0.2);
    gl_FragColor = vec4(col, a);
  }
`;

export class Fireflies {
  constructor() {
    this._home   = new Float32Array(COUNT * 3);
    this._phase  = new Float32Array(COUNT);
    this._radius = new Float32Array(COUNT);
    // Dummy positions so the geometry has correct vertex count
    const positions = new Float32Array(COUNT * 3);

    for (let i = 0; i < COUNT; i++) {
      this._phase[i]  = Math.random();
      this._radius[i] = 0.4 + Math.random() * 0.9;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('aHome',    new THREE.BufferAttribute(this._home,   3));
    geom.setAttribute('aPhase',   new THREE.BufferAttribute(this._phase,  1));
    geom.setAttribute('aRadius',  new THREE.BufferAttribute(this._radius, 1));

    this.uniforms = {
      uTime:       { value: 0 },
      uVisibility: { value: 0 },
      uColor:      { value: new THREE.Color('#cae65c') },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader:   VERTEX,
      fragmentShader: FRAGMENT,
      transparent:    true,
      depthWrite:     false,
      blending:       THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geom, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 0.7;
    this._geom = geom;
    this._initialised = false;
  }

  /**
   * Place each firefly at a random hospitable tile (grass / forest, ideally
   * near a water tile or human hut). Call after worldgen and after every
   * regenerate.
   */
  scatter(world, tileRenderer3d) {
    const W = world.width, H = world.height;
    let i = 0;
    let tries = 0;
    const maxTries = COUNT * 40;
    while (i < COUNT && tries < maxTries) {
      tries++;
      const x = (Math.random() * W) | 0;
      const y = (Math.random() * H) | 0;
      const t = world.getTerrain(x, y);
      if (t !== TERRAIN.GRASS && t !== TERRAIN.FOREST) continue;
      const elev = tileRenderer3d.getElevationAt(x, y);
      this._home[i * 3]     = x + Math.random();
      this._home[i * 3 + 1] = elev + 0.4 + Math.random() * 0.8;
      this._home[i * 3 + 2] = y + Math.random();
      i++;
    }
    // If we ran out of suitable tiles, scatter the rest randomly
    while (i < COUNT) {
      this._home[i * 3]     = Math.random() * W;
      this._home[i * 3 + 1] = 0.6 + Math.random() * 0.6;
      this._home[i * 3 + 2] = Math.random() * H;
      i++;
    }
    this._geom.attributes.aHome.needsUpdate = true;
    this._initialised = true;
  }

  update(skyPhase) {
    this.uniforms.uTime.value = performance.now() * 0.001;
    // Only visible during night and dusk/dawn fringes
    let v = 0;
    if (skyPhase < 0.20)        v = 1;
    else if (skyPhase < 0.30)   v = 1 - (skyPhase - 0.20) / 0.10;
    else if (skyPhase < 0.78)   v = 0;
    else if (skyPhase < 0.85)   v = (skyPhase - 0.78) / 0.07;
    else                        v = 1;
    this.uniforms.uVisibility.value = v;
  }
}
