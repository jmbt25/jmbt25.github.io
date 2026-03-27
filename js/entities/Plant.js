import { Entity } from './Entity.js';
import { TYPE } from '../core/constants.js';
import { rand, randInt } from '../core/rng.js';

export class Plant extends Entity {
  constructor(tileX, tileY) {
    super(TYPE.PLANT, tileX, tileY);
    this.maxAge     = randInt(180, 420);
    this.stage      = 0;           // 0=seedling  1=young  2=mature
    this.nutrition  = 0.4 + rand() * 0.6;  // energy given to eater
  }

  /** Called each sim tick by SimulationManager. Returns spawn request or null. */
  tick(world) {
    this.age++;

    // Advance growth stages
    if (this.stage === 0 && this.age > this.maxAge * 0.25) this.stage = 1;
    if (this.stage === 1 && this.age > this.maxAge * 0.55) this.stage = 2;

    // Die of old age
    if (this.age >= this.maxAge) {
      this.alive = false;
      return null;
    }

    // Mature plants may spread a seed to a random adjacent fertile tile
    if (this.stage === 2 && rand() < 0.004) {
      const dx = randInt(-2, 2);
      const dy = randInt(-2, 2);
      const nx = this.tileX + dx;
      const ny = this.tileY + dy;
      if (world.inBounds(nx, ny) && world.getFertility(nx, ny) > 0) {
        // The registry handles deduplication
        return { type: TYPE.PLANT, x: nx, y: ny };
      }
    }

    return null;
  }
}
