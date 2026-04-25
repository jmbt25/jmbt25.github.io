import { Entity } from './Entity.js';
import { TYPE } from '../core/constants.js';
import { rand } from '../core/rng.js';

export const BUILDING_KIND = Object.freeze({
  HUT: 'hut',
});

/**
 * Static (non-mobile) entity owned by a tribe. Currently only HUTs exist.
 * Buildings have HP, decay if unmaintained, and can be destroyed in war.
 */
export class Building extends Entity {
  constructor(tileX, tileY, kind = BUILDING_KIND.HUT) {
    super(TYPE.BUILDING, tileX, tileY);
    this.kind     = kind;
    this.hp       = 100;
    this.maxHp    = 100;
    // Visual variation: subtle rotation + scale jitter so a village looks lived-in
    this.spinSeed = rand();
  }

  tick() {
    this.age++;
    // Slow natural decay; tribe members can't repair (yet) but the building
    // won't last forever if unattended.
    if (this.age % 240 === 0) this.hp -= 1;
    if (this.hp <= 0) {
      this.alive = false;
      return;
    }
  }

  damage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) this.alive = false;
  }
}
