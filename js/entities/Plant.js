import { Entity } from './Entity.js';
import { TYPE, HUT_PLANT_BOOST, HUT_PLANT_LONGEVITY } from '../core/constants.js';
import { rand, randInt } from '../core/rng.js';

// Terrain enum — duplicated to avoid an import cycle.
const T_GRASS  = 2;
const T_FOREST = 3;

/**
 * Plants benefit from a "Bloom" species buff:
 *   - on FOREST tiles they age 40% slower (effectively live longer)
 *   - on GRASS tiles their seed-spread chance is 75% higher
 *
 * Civilisation feedback: tiles near a hut (world.isNearHut) treat the plant
 * as cultivated — it ages much more slowly and spreads several times as
 * often. This is the agricultural multiplier that lets human populations
 * grow past pure subsistence.
 */
export class Plant extends Entity {
  constructor(tileX, tileY) {
    super(TYPE.PLANT, tileX, tileY);
    this.maxAge     = randInt(180, 420);
    this.stage      = 0;           // 0=seedling  1=young  2=mature
    this.nutrition  = 0.4 + rand() * 0.6;  // energy given to eater
  }

  /** Called each sim tick by SimulationManager. Returns spawn request or null. */
  tick(world) {
    const terrain  = world.getTerrain(this.tileX, this.tileY);
    const farmed   = world.isNearHut(this.tileX, this.tileY);

    // Aging: forests slow it 40%, hut farms slow it further.
    let ageRate = (terrain === T_FOREST) ? 0.6 : 1;
    if (farmed) ageRate *= HUT_PLANT_LONGEVITY;
    this.age += ageRate;

    // Advance growth stages
    if (this.stage === 0 && this.age > this.maxAge * 0.25) this.stage = 1;
    if (this.stage === 1 && this.age > this.maxAge * 0.55) this.stage = 2;

    // Die of old age
    if (this.age >= this.maxAge) {
      this.alive = false;
      return null;
    }

    // Mature plants may spread a seed. Farmed tiles spread much more often,
    // and prefer a neighbouring farmed tile when one exists (clustering).
    let spreadChance = terrain === T_GRASS ? 0.007 : 0.004;
    if (farmed) spreadChance *= HUT_PLANT_BOOST;
    if (this.stage === 2 && rand() < spreadChance) {
      const dx = randInt(-2, 2);
      const dy = randInt(-2, 2);
      const nx = this.tileX + dx;
      const ny = this.tileY + dy;
      if (world.inBounds(nx, ny) && world.getFertility(nx, ny) > 0) {
        return { type: TYPE.PLANT, x: nx, y: ny };
      }
    }

    return null;
  }
}
