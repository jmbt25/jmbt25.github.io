import { WORLD_WIDTH, WORLD_HEIGHT } from '../core/constants.js';
import { TERRAIN } from './TerrainType.js';
import { seedRng, rand } from '../core/rng.js';

export class WorldGen {
  /**
   * Fills world.terrain with procedurally generated biomes.
   * @param {import('./World.js').World} world
   * @param {number} [seed]
   */
  static generate(world, seed = Math.random() * 0xffffffff >>> 0) {
    seedRng(seed);

    const W = world.width;
    const H = world.height;
    const n = W * H;

    const height    = WorldGen._smoothNoise(W, H, seed);
    const moisture  = WorldGen._smoothNoise(W, H, seed ^ 0xdeadbeef);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const h = height[y * W + x];
        const m = moisture[y * W + x];
        world.terrain[y * W + x] = WorldGen._biome(h, m);
      }
    }
  }

  static _biome(h, m) {
    if (h < 0.28)           return TERRAIN.WATER;
    if (h < 0.34)           return TERRAIN.SAND;
    if (h > 0.80)           return TERRAIN.MOUNTAIN;
    if (h > 0.70)           return TERRAIN.SNOW;
    if (m > 0.62)           return TERRAIN.FOREST;
    if (h < 0.54)           return TERRAIN.GRASS;
    return                         TERRAIN.DIRT;
  }

  // Smooth noise: fill with random, then box-blur multiple passes, then normalise.
  // No external dependencies — gives a convincing heightmap in ~100 lines.
  static _smoothNoise(W, H, seed) {
    const rng = WorldGen._mkRng(seed);
    const buf = new Float32Array(W * H);

    for (let i = 0; i < buf.length; i++) buf[i] = rng();

    // 6 passes of a 3×3 box blur
    const tmp = new Float32Array(W * H);
    for (let pass = 0; pass < 6; pass++) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let sum = 0, cnt = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
                sum += buf[ny * W + nx];
                cnt++;
              }
            }
          }
          tmp[y * W + x] = sum / cnt;
        }
      }
      buf.set(tmp);
    }

    // Normalise to [0, 1]
    let lo = buf[0], hi = buf[0];
    for (let i = 1; i < buf.length; i++) {
      if (buf[i] < lo) lo = buf[i];
      if (buf[i] > hi) hi = buf[i];
    }
    const range = hi - lo || 1;
    for (let i = 0; i < buf.length; i++) buf[i] = (buf[i] - lo) / range;

    return buf;
  }

  static _mkRng(seed) {
    let s = (seed * 1664525 + 1013904223) >>> 0;
    return () => {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      return (s >>> 0) / 4294967296;
    };
  }
}
