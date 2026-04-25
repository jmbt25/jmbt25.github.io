import { Creature, STATE } from './Creature.js';
import { TYPE } from '../core/constants.js';
import { rand, randInt } from '../core/rng.js';

/**
 * Human extends Creature with civilization behaviours:
 *   - belongs to a tribe (this.tribeId)
 *   - attacks members of hostile tribes on sight (WAR state)
 *   - returns to a tribe hut periodically to rest (SEEK_HOME state)
 *   - well-fed humans may build new huts (BUILD state)
 *
 * The CivilizationManager is injected via Human.civ (set by SimulationManager
 * before each tick). This avoids polluting the Creature signature for non-humans.
 */
export class Human extends Creature {
  constructor(tileX, tileY) {
    super(TYPE.HUMAN, tileX, tileY);
    this.attackCooldown = 0;
    this.builtSinceTick = -9999; // last tick a hut was placed (rate limit)
    this.canFoundTribe  = this.canFoundTribe || false;
  }

  // Override the base decision tree to slot in civ states.
  _decideState(world, registry) {
    const civ = this.civ;

    // 1. Flee predators (life-threatening) — keep highest priority.
    if (this.cfg.fleeRadius > 0) {
      const threat = registry.findNearest(TYPE.PREDATOR, this.tileX, this.tileY, this.cfg.fleeRadius, world);
      if (threat) {
        this.state = STATE.FLEE;
        this.targetId = threat.id;
        return;
      }
    }

    // 2. Hunt enemy tribe members. Warriors don't need to be hungry to hunt.
    if (civ && this.tribeId != null) {
      const lookRadius = this.trait?.id === 'warrior' ? this.cfg.visionRadius + 2 : this.cfg.visionRadius;
      const enemy = civ.findEnemyHumanNear(this, lookRadius);
      if (enemy) {
        this.state    = STATE.WAR;
        this.targetId = enemy.id;
        return;
      }
    }

    // 3. Seek food when hungry
    if (this.hunger > this.cfg.hungerThreshold) {
      this.state    = STATE.SEEK_FOOD;
      this.targetId = null;
      return;
    }

    // 4. Build a hut if well-fed, energetic, in good terrain, and tribe needs one
    if (
      this.tribeId != null &&
      this.hunger < this.cfg.buildHungerCeiling &&
      this.energy > 0.6 &&
      this._canBuildHere(world)
    ) {
      this.state = STATE.BUILD;
      this.targetId = null;
      return;
    }

    // 5. Reproduce
    if (!this.gestating && this.energy >= this.cfg.reproduceThreshold) {
      this.state    = STATE.SEEK_MATE;
      this.targetId = null;
      return;
    }

    // 6. Idle: drift toward tribe centroid if far from it (gives a "home" feel)
    if (this.tribeId != null && civ) {
      const t = civ.getTribe(this.tribeId);
      if (t) {
        const dx = t.centroid.x - this.tileX;
        const dy = t.centroid.y - this.tileY;
        if (dx*dx + dy*dy > 18 * 18) {
          this.state = STATE.SEEK_HOME;
          this.targetId = null;
          return;
        }
      }
    }

    this.state    = STATE.WANDER;
    this.targetId = null;
  }

  _act(world, registry, births) {
    if (this.attackCooldown > 0) this.attackCooldown--;

    switch (this.state) {
      case STATE.WAR:       this._attackEnemy(world, registry); break;
      case STATE.BUILD:     this._buildHut(world, registry, births); break;
      case STATE.SEEK_HOME: this._goHome(world);                break;
      default:              super._act(world, registry, births);
    }
  }

  _attackEnemy(world, registry) {
    const target = registry.get(this.targetId);
    if (!target?.alive) { this.state = STATE.WANDER; return; }

    const dist = Math.abs(target.tileX - this.tileX) + Math.abs(target.tileY - this.tileY);
    if (dist <= 1) {
      if (this.attackCooldown <= 0) {
        const dmg = (this.strength || 1) + rand() * 0.5;
        // No HP system on creatures yet — apply chance-based kill weighted by relative strength
        const targetStrength = target.strength || 1;
        if (rand() < 0.55 + (dmg - targetStrength) * 0.18) {
          target.alive = false;
          this.hunger = Math.max(0, this.hunger - 0.15); // looting / morale
          this.energy = Math.min(1, this.energy + 0.1);
        }
        this.attackCooldown = this.cfg.huntCooldownTicks ?? 8;
      }
    } else {
      this._stepToward(world, target.tileX, target.tileY);
    }
  }

  _canBuildHere(world) {
    // No recently built; not on water; standing on grass/dirt
    if (this.age - this.builtSinceTick < 80) return false;
    const t = world.getTerrain(this.tileX, this.tileY);
    // 2=grass, 3=forest, 4=dirt — accept these
    return t === 2 || t === 3 || t === 4;
  }

  _buildHut(world, registry, births) {
    if (!this._canBuildHere(world)) {
      this.state = STATE.WANDER;
      this._wander(world);
      return;
    }
    // Don't stack huts on the same tile
    for (const id of world.getEntitiesAt(this.tileX, this.tileY)) {
      const e = registry.get(id);
      if (e?.type === TYPE.BUILDING) {
        this.state = STATE.WANDER;
        this._wander(world);
        return;
      }
    }
    // Pay the energy cost and request a building spawn
    this.energy = Math.max(0, this.energy - this.cfg.buildEnergyCost);
    this.builtSinceTick = this.age;
    births.push({ type: TYPE.BUILDING, x: this.tileX, y: this.tileY, builder: this });
  }

  _goHome(world) {
    const t = this.civ?.getTribe(this.tribeId);
    if (!t) { this._wander(world); return; }
    const tx = Math.round(t.centroid.x + randInt(-1, 1));
    const ty = Math.round(t.centroid.y + randInt(-1, 1));
    if (Math.abs(tx - this.tileX) <= 1 && Math.abs(ty - this.tileY) <= 1) {
      this.energy = Math.min(1, this.energy + 0.02);
      this._wander(world);
    } else {
      this._stepToward(world, tx, ty);
    }
  }
}
