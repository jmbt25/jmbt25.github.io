import { Creature } from './Creature.js';
import { TYPE } from '../core/constants.js';

export class Human extends Creature {
  constructor(tileX, tileY) {
    super(TYPE.HUMAN, tileX, tileY);
  }
}
