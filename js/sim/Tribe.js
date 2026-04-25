import { TRIBE_COLORS } from '../core/constants.js';

let _nextTribeId = 1;

export class Tribe {
  constructor(name, founderX, founderY) {
    this.id      = _nextTribeId++;
    this.name    = name;
    // Cycle through palette, skipping the 0 slot which is the "unaffiliated" color
    this.color   = TRIBE_COLORS[1 + ((this.id - 1) % (TRIBE_COLORS.length - 1))];
    this.founded = 0;            // sim tick (set externally)
    this.capital = { x: founderX, y: founderY }; // home base coords
    this.huts    = new Set();    // building entity IDs owned by this tribe
    this.members = new Set();    // human entity IDs
    this.enemies = new Set();    // tribe IDs at war with this tribe
    // Cached centroid of huts/members for spatial queries — recomputed periodically
    this.centroid = { x: founderX, y: founderY };
  }

  isAtWarWith(tribeId) {
    return this.enemies.has(tribeId);
  }

  declareWar(other) {
    this.enemies.add(other.id);
    other.enemies.add(this.id);
  }

  makePeace(other) {
    this.enemies.delete(other.id);
    other.enemies.delete(this.id);
  }

  addMember(human) {
    this.members.add(human.id);
    human.tribeId = this.id;
  }

  removeMember(human) {
    this.members.delete(human.id);
    if (human.tribeId === this.id) human.tribeId = null;
  }

  addHut(building) {
    this.huts.add(building.id);
    building.tribeId = this.id;
  }

  removeHut(building) {
    this.huts.delete(building.id);
  }

  /** Recompute centroid from huts (preferred) or members. Cheap; call every N ticks. */
  recomputeCentroid(registry) {
    let sx = 0, sy = 0, n = 0;
    for (const id of this.huts) {
      const e = registry.get(id);
      if (e) { sx += e.tileX; sy += e.tileY; n++; }
    }
    if (n === 0) {
      for (const id of this.members) {
        const e = registry.get(id);
        if (e) { sx += e.tileX; sy += e.tileY; n++; }
      }
    }
    if (n > 0) {
      this.centroid.x = sx / n;
      this.centroid.y = sy / n;
    }
  }

  size() {
    return this.members.size + this.huts.size;
  }
}

// Used for "no tribe yet" rendering color
export const UNAFFILIATED_COLOR = TRIBE_COLORS[0];

// Reset on world regen so tribe ids don't grow forever
export function resetTribeCounter() {
  _nextTribeId = 1;
}
