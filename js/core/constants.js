export const TILE_SIZE    = 16;
export const WORLD_WIDTH  = 120;
export const WORLD_HEIGHT = 80;

export const SIM_TICK_MS  = 80;   // ~12 ticks/sec
// Bumped 2500 → 6000 so a real civilisation (hundreds of humans + farms +
// herds) can actually fit. Renderer InstancedMesh capacity follows this.
export const MAX_ENTITIES = 6000;

// Hut "farm" influence — every hut warps the world around it: plants grow
// faster on adjacent tiles, and tribe members nearby get a hunger reduction
// (food storage). This is what makes civilisation snowball.
export const HUT_FARM_RADIUS    = 3;     // tiles
export const HUT_PLANT_BOOST    = 3.5;   // multiplier on plant spread chance
export const HUT_PLANT_LONGEVITY = 0.55; // age multiplier (lower = lives longer)
export const HUT_HUNGER_RELIEF  = 0.55;  // multiplier on adult hunger growth

// Reproduction: in safe conditions, multi-births accelerate population growth.
export const MULTI_BIRTH_TWIN_CHANCE    = 0.22;
export const MULTI_BIRTH_TRIPLET_CHANCE = 0.05;

// Chance a newborn creature is "special" with a unique trait
export const SPECIAL_CHANCE = 0.05;

// Skill system — independent of name. A small fraction of humans are born
// with a hereditary skill (Pathfinder, Architect, Ascendant, Patriarch,
// Champion). Skills can pass parent → child to form lineages.
//   SKILL_BASE_CHANCE        — chance any newborn human (no skilled parent) is born skilled.
//   SKILL_INHERIT_CHANCE     — chance a child of a skilled parent is also skilled.
//   SKILL_INHERIT_SAME_CHANCE — when inheriting, chance the skill matches the parent's exactly.
export const SKILL_BASE_CHANCE         = 0.04;
export const SKILL_INHERIT_CHANCE      = 0.55;
export const SKILL_INHERIT_SAME_CHANCE = 0.75;

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
    // Baseline lifespan ~1400 ticks (~110s wall-time). Thronglets adds an
    // awareness-scaled longevity bonus on top so humans born late in a
    // session live long enough to actually reach Stage 3-4.
    maxAge:                1400,
    moveEveryNTicks:       6,
    // Lowered hunger growth so populations can grow past subsistence —
    // hut shelter further halves this for tribe members nearby.
    hungerPerTick:         0.0015,
    hungerThreshold:       0.45,
    fleeRadius:            8,
    visionRadius:          10,
    // Reproduction tuned for a real civilisation snowball: lower energy
    // bar to start gestation, faster gestation, wider mate-finding radius.
    reproduceThreshold:    0.50,
    reproduceEnergyCost:   0.22,
    gestationTicks:        24,
    mateRadius:            18,
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
