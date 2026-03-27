import { TYPE, MAX_ENTITIES } from '../core/constants.js';
import { Plant }     from './Plant.js';
import { Herbivore } from './Herbivore.js';
import { Predator }  from './Predator.js';
import { Human }     from './Human.js';
import { eventBus }  from '../core/eventBus.js';

export class EntityRegistry {
  constructor(world) {
    this.world    = world;
    this.entities = new Map();   // id → Entity
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  spawn(type, x, y) {
    if (this.entities.size >= MAX_ENTITIES) return null;

    // One plant per tile
    if (type === TYPE.PLANT) {
      for (const id of this.world.getEntitiesAt(x, y)) {
        if (this.entities.get(id)?.type === TYPE.PLANT) return null;
      }
    }

    let entity;
    switch (type) {
      case TYPE.PLANT:     entity = new Plant(x, y);     break;
      case TYPE.HERBIVORE: entity = new Herbivore(x, y); break;
      case TYPE.PREDATOR:  entity = new Predator(x, y);  break;
      case TYPE.HUMAN:     entity = new Human(x, y);     break;
      default: return null;
    }

    this.entities.set(entity.id, entity);
    this.world.registerEntity(entity);
    eventBus.emit('entity:born', entity);
    return entity;
  }

  kill(entity) {
    // Guard on map membership, not entity.alive, because Creature._eat()
    // sets alive=false directly before we get here.
    if (!this.entities.has(entity.id)) return;
    entity.alive = false;
    this.entities.delete(entity.id);
    this.world.unregisterEntity(entity);
    eventBus.emit('entity:died', entity);
  }

  killById(id) {
    const e = this.entities.get(id);
    if (e) this.kill(e);
  }

  /** Remove every entity (e.g. when regenerating the world). */
  clear() {
    for (const e of this.entities.values()) {
      e.alive = false;
      this.world.unregisterEntity(e);
    }
    this.entities.clear();
    this.world.tileEntities.forEach(s => s.clear());
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  get(id) { return this.entities.get(id); }

  getAll() { return this.entities.values(); }

  countByType() {
    const counts = { plant: 0, herbivore: 0, predator: 0, human: 0 };
    for (const e of this.entities.values()) counts[e.type]++;
    return counts;
  }

  /**
   * Finds the nearest living entity of `type` within `maxRadius` tiles (Manhattan).
   * Returns null if none found.
   */
  findNearest(type, cx, cy, maxRadius, world) {
    let best = null;
    let bestDist = maxRadius + 1;

    for (let dy = -maxRadius; dy <= maxRadius; dy++) {
      for (let dx = -maxRadius; dx <= maxRadius; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (!world.inBounds(nx, ny)) continue;

        for (const id of world.getEntitiesAt(nx, ny)) {
          const e = this.entities.get(id);
          if (!e || !e.alive || e.type !== type) continue;
          const d = Math.abs(dx) + Math.abs(dy);
          if (d < bestDist && d > 0) {
            bestDist = d;
            best     = e;
          }
        }
      }
    }
    return best;
  }

  /**
   * Returns all entities within radius tiles of (cx, cy) as an array.
   */
  queryRadius(cx, cy, radius, world) {
    const result = [];
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (!world.inBounds(nx, ny)) continue;
        for (const id of world.getEntitiesAt(nx, ny)) {
          const e = this.entities.get(id);
          if (e?.alive) result.push(e);
        }
      }
    }
    return result;
  }
}
