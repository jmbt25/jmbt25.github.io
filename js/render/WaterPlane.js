/**
 * WaterPlane — a single translucent plane that overlays every WATER tile,
 * sitting just above terrain elevation. A custom shader animates gentle
 * waves and a subtle colour ripple so lakes and oceans don't look static.
 *
 * The terrain mesh below already paints water tiles dark blue, so this
 * layer is mostly there for sparkle and motion.
 */
import * as THREE from 'three';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../core/constants.js';

const WATER_LEVEL = -1.2;          // sits a hair above the terrain water dip (-1.5)

const VERTEX = /* glsl */`
  uniform float uTime;
  varying vec2  vUv;
  varying float vWave;

  void main() {
    vUv = uv;
    vec3 p = position;
    float w =
        sin(p.x * 0.18 + uTime * 0.9) * 0.06
      + sin(p.z * 0.21 - uTime * 1.2) * 0.05
      + sin((p.x + p.z) * 0.32 + uTime * 1.6) * 0.03;
    p.y += w;
    vWave = w;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAGMENT = /* glsl */`
  uniform float uTime;
  uniform vec3  uShallow;
  uniform vec3  uDeep;
  uniform vec3  uHighlight;
  varying vec2  vUv;
  varying float vWave;

  void main() {
    // Base depth tint
    vec3 base = mix(uDeep, uShallow, smoothstep(-0.05, 0.06, vWave));

    // Animated specular streaks — a moving sin pattern across the surface
    float streak = sin(vUv.x * 60.0 + uTime * 1.4)
                 * sin(vUv.y * 38.0 - uTime * 0.8);
    streak = smoothstep(0.85, 1.0, streak);

    vec3 col = base + streak * uHighlight * 0.75;
    gl_FragColor = vec4(col, 0.78);
  }
`;

export class WaterPlane {
  constructor() {
    // One large flat plane the size of the world (segmented for vertex waves).
    const seg = 80;
    const geom = new THREE.PlaneGeometry(WORLD_WIDTH, WORLD_HEIGHT, seg, Math.floor(seg * (WORLD_HEIGHT / WORLD_WIDTH)));
    geom.rotateX(-Math.PI / 2);
    geom.translate(WORLD_WIDTH / 2, WATER_LEVEL, WORLD_HEIGHT / 2);

    this.uniforms = {
      uTime:       { value: 0 },
      uShallow:    { value: new THREE.Color('#5cb6e0') },
      uDeep:       { value: new THREE.Color('#143a72') },
      uHighlight:  { value: new THREE.Color('#cfe9ff') },
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
  }

  update() {
    this.uniforms.uTime.value = performance.now() * 0.001;
  }

  /** Tint the highlight to match current sky colour for sunset/sunrise reflections. */
  setHighlightColor(threeColor) {
    this.uniforms.uHighlight.value.copy(threeColor);
  }
}
