// Seeded PRNG (mulberry32) for reproducible world generation.
// Call seedRng() once, then use rand() throughout generation.

let _state = Math.random() * 0xffffffff >>> 0;

export function seedRng(seed) {
  _state = (seed * 2654435761) >>> 0;
}

export function rand() {
  _state += 0x6d2b79f5;
  let z = _state;
  z = Math.imul(z ^ (z >>> 15), z | 1);
  z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
  return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
}

export function randInt(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

export function randFloat(min, max) {
  return rand() * (max - min) + min;
}

export function randBool(p = 0.5) {
  return rand() < p;
}

export function randChoice(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

// Returns one of the 8 cardinal+diagonal directions as [dx, dy]
const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
export function randDir() {
  return DIRS[Math.floor(rand() * 8)];
}
