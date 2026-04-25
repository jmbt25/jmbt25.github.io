import { Creature, STATE } from './Creature.js';
import { TYPE } from '../core/constants.js';

const HERD_RADIUS = 3;
const HERD_THRESHOLD = 2; // need at least N other herbivores nearby to trigger herd-flee

/**
 * Herbivores benefit from a "Herd Instinct" species buff:
 * when fleeing, if at least HERD_THRESHOLD other herbivores are within
 * HERD_RADIUS tiles, take a second flee step (effectively double speed
 * while panicking in a group).
 */
export class Herbivore extends Creature {
  constructor(tileX, tileY) {
    super(TYPE.HERBIVORE, tileX, tileY);
  }

  _flee(world, registry) {
    super._flee(world, registry);
    if (this.state !== STATE.FLEE) return;
    if (this._countHerd(registry, world) >= HERD_THRESHOLD) {
      super._flee(world, registry); // panicked herd: extra step
    }
  }

  _countHerd(registry, world) {
    let count = 0;
    const r = HERD_RADIUS;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = this.tileX + dx, ny = this.tileY + dy;
        if (!world.inBounds(nx, ny)) continue;
        for (const id of world.getEntitiesAt(nx, ny)) {
          const e = registry.get(id);
          if (e?.alive && e.type === TYPE.HERBIVORE && e.id !== this.id) count++;
        }
      }
    }
    return count;
  }
}
