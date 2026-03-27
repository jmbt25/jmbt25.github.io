import { Creature } from './Creature.js';
import { TYPE } from '../core/constants.js';

export class Predator extends Creature {
  constructor(tileX, tileY) {
    super(TYPE.PREDATOR, tileX, tileY);
  }
}
