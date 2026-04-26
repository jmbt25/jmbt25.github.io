import { Tribe, resetTribeCounter } from './Tribe.js';
import { TYPE, HUT_TIER_COSTS, UPGRADE_INTERVAL_TICKS } from '../core/constants.js';
import { rand, randChoice } from '../core/rng.js';
import { eventBus } from '../core/eventBus.js';

const TRIBE_NAMES = [
  'Aurelians','Brynne','Calderra','Drovaks','Eladrin','Fjorda',
  'Galdan','Helkar','Ishari','Jakkun','Kirethi','Lurien',
  'Morath','Nevoa','Ostari','Petras','Quarn','Reyvold',
];

// ── Civilisation thresholds ─────────────────────────────────────────────────
// Tuned for a "tiny world that feels real" rather than statistical noise.

// Hard cap on simultaneously-active tribes — keeps the world legible.
const MAX_TRIBES          = 8;
// Free first-tribe rule: until the world has this many tribes, founding
// doesn't require buddies (otherwise the very first human can never start one).
const SOLO_FOUND_LIMIT    = 1;
// Random chance any given non-Sage human spawns a new tribe (was 0.18).
const RANDOM_FOUND_CHANCE = 0.05;
// Co-founders required to organically form a tribe. Need at least 1 other
// unaffiliated human within this radius — a tribe is a band, not a person.
const FOUND_BUDDY_RADIUS  = 4;
// Newly-born humans absorb into the nearest existing tribe within this range.
const ABSORB_RADIUS       = 18;

// Living-member thresholds for war diplomacy.
//   MIN_WAR_SIZE     — tribes need this many living members to declare or
//                      maintain a war. Below this they can't fight; this is
//                      what stops "1-person tribe at war" / hut-only tribes
//                      from polluting diplomacy.
//   FORCED_PEACE_SIZE — at or below this many living members, all wars
//                      end automatically next diplomacy tick.
const MIN_WAR_SIZE        = 4;
const FORCED_PEACE_SIZE   = 3;

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
   * Same as findNearbyTribe but skips tribes with no living members. Used
   * for absorbing newly-born humans — joining a hut-only ghost tribe is
   * pointless and was producing the "tribe with no humans" UI state.
   */
  findNearbyLivingTribe(x, y, radius) {
    let best = null, bestD = radius * radius + 1;
    for (const t of this.tribes.values()) {
      if (t.livingSize() === 0) continue;
      const dx = t.centroid.x - x;
      const dy = t.centroid.y - y;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD) { bestD = d2; best = t; }
    }
    return best;
  }

  /** All unaffiliated living humans within `radius` tiles of `human`. */
  _findUnaffiliatedNear(human, radius) {
    const out = [];
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = human.tileX + dx, ny = human.tileY + dy;
        if (!this.world.inBounds(nx, ny)) continue;
        for (const id of this.world.getEntitiesAt(nx, ny)) {
          const e = this.registry.get(id);
          if (!e?.alive || e.type !== TYPE.HUMAN) continue;
          if (e.id === human.id || e.tribeId != null) continue;
          out.push(e);
        }
      }
    }
    return out;
  }

  /**
   * Place a human into a tribe. Order:
   *   1. Parent's tribe (if still alive)
   *   2. Nearest *living* tribe within ABSORB_RADIUS
   *   3. Stop if MAX_TRIBES already exists
   *   4. Sage humans (canFoundTribe) found alone — that's their whole purpose
   *   5. Otherwise need ≥1 unaffiliated buddy nearby AND pass a low random
   *      roll. A "tribe" without at least two co-founders isn't a tribe.
   *   6. Otherwise unaffiliated (will likely cluster up later)
   */
  assignTribe(human, parent = null) {
    // 1. Parent's tribe
    if (parent?.tribeId) {
      const t = this.tribes.get(parent.tribeId);
      if (t) { t.addMember(human); return t; }
    }

    // 2. Adopt nearest living tribe within range
    const nearby = this.findNearbyLivingTribe(human.tileX, human.tileY, ABSORB_RADIUS);
    if (nearby) {
      nearby.addMember(human);
      return nearby;
    }

    // 3. Cap on simultaneous tribes
    if (this.tribes.size >= MAX_TRIBES) return null;

    // 4. Sage solo founders
    if (human.canFoundTribe) return this.foundTribe(human);

    // 5. Organic founding — needs co-founders + a roll
    const canTry = this.tribes.size < SOLO_FOUND_LIMIT || rand() < RANDOM_FOUND_CHANCE;
    if (!canTry) return null;
    const buddies = this._findUnaffiliatedNear(human, FOUND_BUDDY_RADIUS);
    // After the first tribe exists, require at least one buddy. Before
    // that we allow a single founder so the world can bootstrap.
    if (buddies.length === 0 && this.tribes.size >= SOLO_FOUND_LIMIT) return null;

    const tribe = this.foundTribe(human);
    // Bring up to 3 nearby unaffiliated humans into the founding band
    for (const b of buddies.slice(0, 3)) tribe.addMember(b);
    return tribe;
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

    if (tick % UPGRADE_INTERVAL_TICKS === 0) {
      this._upgradeTick();
    }
  }

  /**
   * Each interval, every tribe checks if it can afford to upgrade one of
   * its huts. Upgrades the LOWEST-tier alive hut (so a tribe with mixed
   * stock evens up before pushing a single building to T3). One upgrade
   * per tribe per interval — keeps construction rhythm visible.
   */
  _upgradeTick() {
    for (const tribe of this.tribes.values()) {
      if (tribe.huts.size === 0) continue;
      // Find the lowest-tier alive hut owned by this tribe
      let target = null;
      let targetTier = 4;
      for (const id of tribe.huts) {
        const e = this.registry.get(id);
        if (!e?.alive) continue;
        if (e.tier < targetTier) { target = e; targetTier = e.tier; }
      }
      if (!target || target.tier >= 3) continue;

      const cost = HUT_TIER_COSTS[target.tier + 1];
      if (!cost) continue;
      if (!tribe.canAfford(cost.wood, cost.stone)) continue;

      tribe.spend(cost.wood, cost.stone);
      target.upgradeTier();
      eventBus.emit('tribe:upgrade', { tribe, building: target, tier: target.tier });
    }
  }

  _diplomacyTick() {
    const list = [...this.tribes.values()];

    // Pre-pass: any tribe whose living headcount has fallen too low is in
    // no shape to sustain a war. They auto-surrender to every enemy. This
    // also covers fully-fallen tribes (livingSize = 0): a hut-only ghost
    // tribe never declares or maintains war.
    for (const t of list) {
      if (t.livingSize() < FORCED_PEACE_SIZE && t.enemies.size > 0) {
        for (const eid of [...t.enemies]) {
          const enemy = this.tribes.get(eid);
          if (enemy) t.makePeace(enemy);
        }
      }
    }

    // Only war-capable tribes can be drawn for new diplomacy events
    const eligible = list.filter(t => t.livingSize() >= MIN_WAR_SIZE);
    if (eligible.length < 2) return;

    const a = randChoice(eligible);
    const b = randChoice(eligible);
    if (!a || !b || a === b) return;

    const dx = a.centroid.x - b.centroid.x;
    const dy = a.centroid.y - b.centroid.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (a.isAtWarWith(b.id)) {
      // Distant tribes occasionally make peace once the campaign drags on
      if (dist > 35 && rand() < 0.5) a.makePeace(b);
    } else {
      // Close, healthy tribes are more likely to clash. Ambition uses
      // living headcount only — no fighting on behalf of empty huts.
      const proximity = Math.max(0, 40 - dist) / 40;
      const ambition  = Math.min(a.livingSize(), b.livingSize()) / 12;
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
