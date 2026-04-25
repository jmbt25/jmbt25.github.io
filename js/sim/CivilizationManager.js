import { Tribe, resetTribeCounter } from './Tribe.js';
import { TYPE } from '../core/constants.js';
import { rand, randChoice } from '../core/rng.js';

const TRIBE_NAMES = [
  'Aurelians','Brynne','Calderra','Drovaks','Eladrin','Fjorda',
  'Galdan','Helkar','Ishari','Jakkun','Kirethi','Lurien',
  'Morath','Nevoa','Ostari','Petras','Quarn','Reyvold',
];

/**
 * Owns the tribe roster and runs civilization-scale dynamics:
 *   - founding tribes
 *   - tribe membership for humans
 *   - declaring war / peace between tribes
 *   - centroid (capital) tracking
 *
 * Combat itself runs inside Human.tick() — the manager just sets up
 * the relationships humans react to.
 */
export class CivilizationManager {
  constructor(registry, world) {
    this.registry = registry;
    this.world    = world;
    this.tribes   = new Map(); // id → Tribe
    this._nameIdx = 0;
  }

  reset() {
    this.tribes.clear();
    resetTribeCounter();
    this._nameIdx = 0;
  }

  // ── Tribe lifecycle ──────────────────────────────────────────────────────

  foundTribe(human) {
    const name = TRIBE_NAMES[this._nameIdx++ % TRIBE_NAMES.length];
    const tribe = new Tribe(name, human.tileX, human.tileY);
    this.tribes.set(tribe.id, tribe);
    tribe.addMember(human);
    return tribe;
  }

  getTribe(id) {
    return this.tribes.get(id);
  }

  /** Returns the closest existing tribe within `radius` tiles, or null. */
  findNearbyTribe(x, y, radius) {
    let best = null, bestD = radius * radius + 1;
    for (const t of this.tribes.values()) {
      const dx = t.centroid.x - x;
      const dy = t.centroid.y - y;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD) { bestD = d2; best = t; }
    }
    return best;
  }

  /**
   * Place a human into a tribe. Inheritance order:
   *   1. Parent's tribe (if any)
   *   2. Nearest tribe within absorb radius
   *   3. New tribe (if Sage trait OR < 2 tribes exist OR random small chance)
   *   4. Otherwise unaffiliated
   */
  assignTribe(human, parent = null) {
    if (parent?.tribeId) {
      const t = this.tribes.get(parent.tribeId);
      if (t) { t.addMember(human); return t; }
    }

    // Adopt nearest existing tribe within range
    const nearby = this.findNearbyTribe(human.tileX, human.tileY, 18);
    if (nearby) {
      nearby.addMember(human);
      return nearby;
    }

    // Found a new tribe under certain conditions
    const canFound = human.canFoundTribe || this.tribes.size < 2 || rand() < 0.18;
    if (canFound) return this.foundTribe(human);

    return null;
  }

  removeMember(human) {
    if (human.tribeId == null) return;
    const t = this.tribes.get(human.tribeId);
    if (t) t.removeMember(human);
  }

  registerHut(building, tribe) {
    tribe.addHut(building);
  }

  removeHut(building) {
    if (building.tribeId == null) return;
    const t = this.tribes.get(building.tribeId);
    if (t) t.removeHut(building);
  }

  // ── Per-tick processing ─────────────────────────────────────────────────

  /**
   * Called once per sim tick by SimulationManager.
   * Handles centroid recompute and war/peace shifts. Cheap when nothing changes.
   */
  update(tick) {
    if (tick % 25 === 0) {
      // Recompute centroids periodically
      for (const t of this.tribes.values()) t.recomputeCentroid(this.registry);

      // Drop tribes whose membership AND huts have collapsed
      for (const [id, t] of this.tribes) {
        if (t.size() === 0) this.tribes.delete(id);
      }
    }

    if (tick % 60 === 0 && this.tribes.size >= 2) {
      this._diplomacyTick();
    }
  }

  _diplomacyTick() {
    const list = [...this.tribes.values()];
    const a = randChoice(list);
    const b = randChoice(list);
    if (!a || !b || a === b) return;

    const dx = a.centroid.x - b.centroid.x;
    const dy = a.centroid.y - b.centroid.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (a.isAtWarWith(b.id)) {
      // Distant tribes occasionally make peace
      if (dist > 35 && rand() < 0.5) a.makePeace(b);
      // Or one side wiped down small enough to surrender
      else if (a.size() < 3 || b.size() < 3) a.makePeace(b);
    } else {
      // Close, large tribes are more likely to clash
      const proximity = Math.max(0, 40 - dist) / 40;
      const ambition  = Math.min(a.size(), b.size()) / 12;
      const warChance = 0.05 + proximity * 0.45 + Math.min(0.25, ambition);
      if (rand() < warChance) a.declareWar(b);
    }
  }

  // ── Queries used by Human AI ────────────────────────────────────────────

  /** Find the nearest hut of `tribeId` to (x, y) within radius. */
  findNearestHut(tribeId, x, y, radius) {
    const t = this.tribes.get(tribeId);
    if (!t) return null;
    let best = null, bestD = radius * radius + 1;
    for (const id of t.huts) {
      const e = this.registry.get(id);
      if (!e?.alive) continue;
      const dx = e.tileX - x;
      const dy = e.tileY - y;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD) { bestD = d2; best = e; }
    }
    return best;
  }

  /**
   * Find the nearest hostile human within radius. Returns null if none.
   */
  findEnemyHumanNear(human, radius) {
    if (!human.tribeId) return null;
    const t = this.tribes.get(human.tribeId);
    if (!t || t.enemies.size === 0) return null;

    const world = this.world;
    let best = null, bestDist = radius + 1;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = human.tileX + dx, ny = human.tileY + dy;
        if (!world.inBounds(nx, ny)) continue;
        for (const id of world.getEntitiesAt(nx, ny)) {
          const e = this.registry.get(id);
          if (!e?.alive || e.type !== TYPE.HUMAN) continue;
          if (e.id === human.id) continue;
          if (!e.tribeId || !t.enemies.has(e.tribeId)) continue;
          const d = Math.abs(dx) + Math.abs(dy);
          if (d < bestDist) { bestDist = d; best = e; }
        }
      }
    }
    return best;
  }
}
