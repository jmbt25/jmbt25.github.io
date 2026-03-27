export const TERRAIN = Object.freeze({
  WATER:    0,
  SAND:     1,
  GRASS:    2,
  FOREST:   3,
  DIRT:     4,
  MOUNTAIN: 5,
  SNOW:     6,
});

export const TERRAIN_COLOR = Object.freeze({
  [TERRAIN.WATER]:    '#1565a8',
  [TERRAIN.SAND]:     '#c4a968',
  [TERRAIN.GRASS]:    '#4a7c59',
  [TERRAIN.FOREST]:   '#2d5a27',
  [TERRAIN.DIRT]:     '#7a5c1e',
  [TERRAIN.MOUNTAIN]: '#6b7280',
  [TERRAIN.SNOW]:     '#d8eaf4',
});

// Secondary color for texture variation
export const TERRAIN_COLOR2 = Object.freeze({
  [TERRAIN.WATER]:    '#1878c8',
  [TERRAIN.SAND]:     '#d4b878',
  [TERRAIN.GRASS]:    '#3a6a48',
  [TERRAIN.FOREST]:   '#244a20',
  [TERRAIN.DIRT]:     '#8a6828',
  [TERRAIN.MOUNTAIN]: '#7a8290',
  [TERRAIN.SNOW]:     '#eaf4fc',
});

// Whether most creatures can walk on this tile
const _passable = new Uint8Array(7);
_passable[TERRAIN.SAND]    = 1;
_passable[TERRAIN.GRASS]   = 1;
_passable[TERRAIN.FOREST]  = 1;
_passable[TERRAIN.DIRT]    = 1;
_passable[TERRAIN.SNOW]    = 1;

export function isPassable(t) { return _passable[t] === 1; }

// How well plants grow here (0 = no growth)
const _fertility = new Float32Array([0, 0.1, 0.8, 1.0, 0.3, 0, 0]);

export function getFertility(t) { return _fertility[t]; }

export const TERRAIN_NAMES = Object.freeze({
  [TERRAIN.WATER]:    'Water',
  [TERRAIN.SAND]:     'Sand',
  [TERRAIN.GRASS]:    'Grass',
  [TERRAIN.FOREST]:   'Forest',
  [TERRAIN.DIRT]:     'Dirt',
  [TERRAIN.MOUNTAIN]: 'Mountain',
  [TERRAIN.SNOW]:     'Snow',
});
