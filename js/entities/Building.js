import { Entity } from './Entity.js';
import { TYPE } from '../core/constants.js';
import { rand } from '../core/rng.js';

export const BUILDING_KIND = Object.freeze({
  HUT: 'hut',
});

/**
 * Static (non-mobile) entity owned by a tribe. Currently only HUTs exist.
 * Buildings have HP, decay if unmaintained, can be destroyed in war, and
 * can be upgraded by their tribe to higher tiers as wood/stone accumulate.
 *
 * Tier:
 *   1 (default) — basic hut as built.
 *   2           — adds an upper storey + thicker walls + bigger chimney.
 *   3           — adds a watchtower spire + tribe-coloured banner.
 * Each tier raises the building's max HP, so upgraded huts also stand
 * longer in war.
 */
export class Building extends Entity {
  constructor(tileX, tileY, kind = BUILDING_KIND.HUT) {
    super(TYPE.BUILDING, tileX, tileY);
    this.kind     = kind;
    this.tier     = 1;
    this.hp       = 100;
    this.maxHp    = 100;
    // Visual variation: subtle rotation + scale jitter so a village looks lived-in
    this.spinSeed = rand();
  }

  /** Promote this hut to a higher tier and bump its HP cap. */
  upgradeTier() {
    if (this.tier >= 3) return false;
    this.tier++;
    const bonus = this.tier === 2 ? 80 : 160;   // T2 +80, T3 +160 over T1's 100
    this.maxHp = 100 + bonus;
    this.hp    = Math.min(this.maxHp, this.hp + bonus); // refurbish on upgrade
    return true;
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
