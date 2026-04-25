import { Creature } from './Creature.js';
import { TYPE } from '../core/constants.js';

const FRENZY_TICKS = 40;

/**
 * Predators get a "Blood Frenzy" species buff: after a successful kill,
 * their effective move interval drops by 2 ticks for FRENZY_TICKS sim ticks.
 * The renderer also tints them slightly redder while frenzied.
 */
export class Predator extends Creature {
  constructor(tileX, tileY) {
    super(TYPE.PREDATOR, tileX, tileY);
    this.frenzyTimer = 0;
  }

  tick(world, registry) {
    if (this.frenzyTimer > 0) this.frenzyTimer--;
    return super.tick(world, registry);
  }

  _eat(food) {
    super._eat(food);
    this.frenzyTimer = FRENZY_TICKS;
  }

  _moveInterval() {
    let n = super._moveInterval();
    if (this.frenzyTimer > 0) n -= 2;
    return Math.max(1, n);
  }
}
