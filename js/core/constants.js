export const TILE_SIZE    = 16;
export const WORLD_WIDTH  = 120;
export const WORLD_HEIGHT = 80;

export const SIM_TICK_MS  = 80;   // ~12 ticks/sec
export const MAX_ENTITIES = 2500;

// Chance a newborn creature is "special" with a unique trait
export const SPECIAL_CHANCE = 0.05;

// "Skill" system — only humans named Joshua manifest a skill.
// JOSHUA_SPONTANEOUS_CHANCE: chance any new human (no Joshua parent) is named Joshua.
// JOSHUA_INHERIT_NAME_CHANCE: chance a Joshua's offspring is also named Joshua.
// JOSHUA_INHERIT_SKILL_CHANCE: if the offspring is named Joshua, chance their skill matches the parent's (otherwise rerolled).
export const JOSHUA_NAME = 'Joshua';
export const JOSHUA_SPONTANEOUS_CHANCE  = 0.04;
export const JOSHUA_INHERIT_NAME_CHANCE = 0.65;
export const JOSHUA_INHERIT_SKILL_CHANCE = 0.80;

// Entity type strings
export const TYPE = Object.freeze({
  PLANT:     'plant',
  HERBIVORE: 'herbivore',
  PREDATOR:  'predator',
  HUMAN:     'human',
  BUILDING:  'building',
});

// Per-species config
// moveEveryNTicks slowed compared to v1: creatures are easier to watch interact.
// Renderer interpolates motion smoothly between tiles, so they slide rather than teleport.
export const SPECIES = Object.freeze({
  [TYPE.HERBIVORE]: {
    maxAge:                400,
    moveEveryNTicks:       6,
    hungerPerTick:         0.0030,
    hungerThreshold:       0.50,
    fleeRadius:            5,
    visionRadius:          7,
    reproduceThreshold:    0.72,
    reproduceEnergyCost:   0.30,
    gestationTicks:        35,
    mateRadius:            8,
    color:                 '#f0d868',
  },
  [TYPE.PREDATOR]: {
    maxAge:                500,
    moveEveryNTicks:       8,
    hungerPerTick:         0.0022,
    hungerThreshold:       0.55,
    fleeRadius:            0,
    visionRadius:          9,
    reproduceThreshold:    0.65,
    reproduceEnergyCost:   0.35,
    gestationTicks:        50,
    mateRadius:            14,
    color:                 '#d04040',
  },
  [TYPE.HUMAN]: {
    // Baseline lifespan ~1400 ticks (~110s wall-time) — doubled from 700.
    // Thronglets adds an awareness-scaled longevity bonus on top so humans
    // born late in a session live long enough to actually reach Stage 3-4.
    maxAge:                1400,
    moveEveryNTicks:       6,
    // Slower hunger growth + earlier seek-food trigger so isolated humans
    // have a wider reaction window before they starve.
    hungerPerTick:         0.0020,
    hungerThreshold:       0.45,
    // Wider flee radius: predators have visionRadius 9 — humans now react
    // at 8 tiles instead of 6 so they aren't ambushed at point-blank.
    fleeRadius:            8,
    visionRadius:          10,
    reproduceThreshold:    0.68,
    reproduceEnergyCost:   0.28,
    gestationTicks:        40,
    mateRadius:            12,
    color:                 '#e0a870',
    // Civ-specific
    buildEnergyCost:       0.45,
    buildHungerCeiling:    0.45,
    huntCooldownTicks:     8,
  },
});

// Tribe color palette — humans are tinted by tribe color
export const TRIBE_COLORS = Object.freeze([
  '#e0a870', // sand (default / unaffiliated)
  '#5fb6d8', // sky
  '#d85f5f', // crimson
  '#a06fd8', // violet
  '#5fd896', // mint
  '#d8c95f', // ochre
  '#d8845f', // copper
  '#7f8fa6', // ash
]);
