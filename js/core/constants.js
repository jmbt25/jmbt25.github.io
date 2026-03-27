export const TILE_SIZE    = 16;
export const WORLD_WIDTH  = 120;
export const WORLD_HEIGHT = 80;

export const SIM_TICK_MS  = 80;   // ~12 ticks/sec
export const MAX_ENTITIES = 2500;

// Entity type strings
export const TYPE = Object.freeze({
  PLANT:     'plant',
  HERBIVORE: 'herbivore',
  PREDATOR:  'predator',
  HUMAN:     'human',
});

// Per-species config
export const SPECIES = Object.freeze({
  [TYPE.HERBIVORE]: {
    maxAge:                400,
    moveEveryNTicks:       2,
    hungerPerTick:         0.0035,
    hungerThreshold:       0.50,
    fleeRadius:            5,
    visionRadius:          7,
    reproduceThreshold:    0.72,
    reproduceEnergyCost:   0.30,
    gestationTicks:        35,
    color:                 '#f0d868',
  },
  [TYPE.PREDATOR]: {
    maxAge:                500,
    moveEveryNTicks:       3,
    hungerPerTick:         0.0025,
    hungerThreshold:       0.55,
    fleeRadius:            0,
    visionRadius:          9,
    reproduceThreshold:    0.78,
    reproduceEnergyCost:   0.35,
    gestationTicks:        50,
    color:                 '#d04040',
  },
  [TYPE.HUMAN]: {
    maxAge:                700,
    moveEveryNTicks:       2,
    hungerPerTick:         0.0030,
    hungerThreshold:       0.60,
    fleeRadius:            6,
    visionRadius:          10,
    reproduceThreshold:    0.68,
    reproduceEnergyCost:   0.28,
    gestationTicks:        40,
    color:                 '#e0a870',
  },
});
