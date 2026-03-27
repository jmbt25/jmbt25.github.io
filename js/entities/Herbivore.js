import { Creature } from './Creature.js';
import { TYPE } from '../core/constants.js';

export class Herbivore extends Creature {
  constructor(tileX, tileY) {
    super(TYPE.HERBIVORE, tileX, tileY);
  }
}
