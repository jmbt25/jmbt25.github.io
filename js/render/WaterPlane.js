/**
 * WaterPlane — a translucent plane that overlays every WATER tile, sitting
 * just above terrain elevation. Procedurally animates with vertex waves and
 * a fragment shader that adds shoreline foam, depth-blended colour, and
 * specular streaks.
 *
 * Foam is computed by sampling an off-screen "shore proximity" data texture
 * built once at startup from the world's terrain. Tiles bordering land get
 * a high foam value, deep ocean tiles get zero — the shader then traces a
 * soft white band around every island.
 */
import * as THREE from 'three';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../core/constants.js';
import { TERRAIN } from '../world/TerrainType.js';

const WATER_LEVEL = -1.05;

const VERTEX = /* glsl */`
  uniform float uTime;
  varying vec2  vUv;
  varying float vWave;
  varying vec2  vWorld;

  void main() {
    vUv = uv;
    vec3 p = position;
    float w =
        sin(p.x * 0.18 + uTime * 0.9) * 0.06
      + sin(p.z * 0.21 - uTime * 1.2) * 0.05
      + sin((p.x + p.z) * 0.32 + uTime * 1.6) * 0.03;
    p.y += w;
    vWave = w;
    vWorld = vec2(p.x, p.z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAGMENT = /* glsl */`
  uniform float     uTime;
  uniform vec3      uShallow;
  uniform vec3      uDeep;
  uniform vec3      uHighlight;
  uniform sampler2D uShore;
  uniform vec2      uWorldSize;
  varying vec2      vUv;
  varying float     vWave;
  varying vec2      vWorld;

  void main() {
    // Sample shore proximity (0 = deep, 1 = at shore)
    vec2 shoreUv = vWorld / uWorldSize;
    float shore = texture2D(uShore, shoreUv).r;

    // Depth-blended base color
    vec3 base = mix(uDeep, uShallow, smoothstep(-0.05, 0.06, vWave) * 0.6 + shore * 0.4);

    // Animated specular streaks
    float streak = sin(vWorld.x * 1.2 + uTime * 1.4)
                 * sin(vWorld.y * 1.6 - uTime * 0.8);
    streak = smoothstep(0.85, 1.0, streak);

    // Foam: a moving band of white near the shoreline
    float foamBand = smoothstep(0.55, 0.95, shore);
    float foamPulse = 0.5 + 0.5 * sin(vWorld.x * 2.0 + vWorld.y * 1.7 + uTime * 1.9);
    float foam = foamBand * (0.55 + foamPulse * 0.45);
    // Edge whitewash exactly at the shore
    foam += smoothstep(0.85, 1.0, shore) * 0.35;

    vec3 col = base + streak * uHighlight * 0.85;
    col = mix(col, vec3(0.94, 0.97, 1.00), clamp(foam, 0.0, 0.85));

    // Slight transparency drop where foam dominates so the shoreline reads as froth
    float alpha = mix(0.78, 0.92, clamp(foam, 0.0, 1.0));
    gl_FragColor = vec4(col, alpha);
  }
`;

export class WaterPlane {
  constructor() {
    const seg = 100;
    const geom = new THREE.PlaneGeometry(
      WORLD_WIDTH, WORLD_HEIGHT,
      seg, Math.floor(seg * (WORLD_HEIGHT / WORLD_WIDTH)),
    );
    geom.rotateX(-Math.PI / 2);
    geom.translate(WORLD_WIDTH / 2, WATER_LEVEL, WORLD_HEIGHT / 2);

    // Placeholder shore texture — rebuilt by setShoreFromWorld()
    this._shoreTex = new THREE.DataTexture(
      new Uint8Array([0]), 1, 1,
      THREE.RedFormat, THREE.UnsignedByteType,
    );
    this._shoreTex.needsUpdate = true;

    this.uniforms = {
      uTime:       { value: 0 },
      uShallow:    { value: new THREE.Color('#5cb6e0') },
      uDeep:       { value: new THREE.Color('#102c5a') },
      uHighlight:  { value: new THREE.Color('#cfe9ff') },
      uShore:      { value: this._shoreTex },
      uWorldSize:  { value: new THREE.Vector2(WORLD_WIDTH, WORLD_HEIGHT) },
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader:   VERTEX,
      fragmentShader: FRAGMENT,
      transparent:    true,
      depthWrite:     false,
    });

    this.mesh = new THREE.Mesh(geom, this.material);
    this.mesh.renderOrder = 0.5;
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
  }

  /**
   * Rebuild the shore proximity texture from the current world. Call once at
   * startup and on every terrain edit.
   */
  setShoreFromWorld(world) {
    const W = world.width, H = world.height;
    const data = new Uint8Array(W * H);

    // 1. Mark shore = 255 on water tiles bordering non-water
    // 2. Bleed inward over a few tiles for a soft falloff
    const isWater = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (world.getTerrain(x, y) === TERRAIN.WATER) isWater[y * W + x] = 1;
      }
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isWater[y * W + x]) { data[y * W + x] = 0; continue; }
        let isShore = false;
        for (let dy = -1; dy <= 1 && !isShore; dy++) {
          for (let dx = -1; dx <= 1 && !isShore; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            if (!isWater[ny * W + nx]) isShore = true;
          }
        }
        data[y * W + x] = isShore ? 255 : 0;
      }
    }

    // Single-pass blur to soften the foam band
    const blurred = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let sum = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            sum += data[ny * W + nx]; n++;
          }
        }
        blurred[y * W + x] = (sum / n) | 0;
      }
    }

    const tex = new THREE.DataTexture(blurred, W, H, THREE.RedFormat, THREE.UnsignedByteType);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;

    if (this._shoreTex) this._shoreTex.dispose?.();
    this._shoreTex = tex;
    this.uniforms.uShore.value = tex;
  }

  update() {
    this.uniforms.uTime.value = performance.now() * 0.001;
  }

  setHighlightColor(threeColor) {
    this.uniforms.uHighlight.value.copy(threeColor);
  }
}
