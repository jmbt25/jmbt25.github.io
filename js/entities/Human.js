import { Creature, STATE } from './Creature.js';
import { TYPE, SKILL_BASE_CHANCE, SKILL_INHERIT_CHANCE, SKILL_INHERIT_SAME_CHANCE } from '../core/constants.js';
import { rand, randInt } from '../core/rng.js';
import { pickName } from './names.js';
import { rollSkill, getSkillById } from './skills.js';
import { eventBus } from '../core/eventBus.js';

// ── Human life stages ──────────────────────────────────────────────────────
// A human's age is split into three stages as a fraction of their personal
// maxAge (so longer-lived humans get longer childhoods and elderhoods too).
//   child   — first 18%: cannot reproduce, fight, or build. Smaller.
//   adult   — middle 60%: full participation; this is the reproductive window.
//   elder   — last 22%: cannot reproduce, fight, or build. Greying.
// These come from rough demographic ratios and tune to "feels right" — not
// real-world demographics, just enough that you can see generations turning.
export const LIFE = Object.freeze({
  CHILD_END:  0.18,
  ELDER_BEGIN: 0.78,
});
export const STAGE = Object.freeze({
  CHILD: 'child',
  ADULT: 'adult',
  ELDER: 'elder',
});

/**
 * Human extends Creature with civilization behaviours:
 *   - belongs to a tribe (this.tribeId)
 *   - attacks members of hostile tribes on sight (WAR state)
 *   - returns to a tribe hut periodically to rest (SEEK_HOME state)
 *   - well-fed humans may build new huts (BUILD state)
 *   - has a name; humans named "Joshua" manifest a unique skill,
 *     and pass both their name and skill to offspring with high probability
 *
 * The CivilizationManager is injected via Human.civ (set by SimulationManager
 * before each tick). This avoids polluting the Creature signature for non-humans.
 */
export class Human extends Creature {
  constructor(tileX, tileY, parent = null) {
    super(TYPE.HUMAN, tileX, tileY);
    this.attackCooldown = 0;
    this.builtSinceTick = -9999; // last tick a hut was placed (rate limit)
    this.canFoundTribe  = this.canFoundTribe || false;
    this.buildCooldown  = 80;    // overridable by Architect skill
    this._assignIdentity(parent);
  }

  _assignIdentity(parent) {
    // Name: gender-aware first name pick. No name carries any mechanical
    // weight — "Joshua" is just one of the male names.
    this.name = pickName(this.sex);

    // Skill: independent of name. A skilled parent has a much higher chance
    // of producing a skilled child (forms lineages), and that child usually
    // inherits the parent's exact skill.
    let skill = null;
    if (parent?.skill) {
      if (rand() < SKILL_INHERIT_CHANCE) {
        skill = (rand() < SKILL_INHERIT_SAME_CHANCE)
          ? getSkillById(parent.skill.id)
          : rollSkill();
      }
    } else {
      if (rand() < SKILL_BASE_CHANCE) skill = rollSkill();
    }

    if (skill) {
      this.skill = { id: skill.id, name: skill.name, desc: skill.desc };
      skill.apply(this);
    }
  }

  /** Fraction of life lived [0, 1+]. */
  get ageRatio() {
    return this.maxAge > 0 ? this.age / this.maxAge : 0;
  }

  /** Current life stage — derived from age ratio. */
  get lifeStage() {
    const r = this.ageRatio;
    if (r < LIFE.CHILD_END)   return STAGE.CHILD;
    if (r >= LIFE.ELDER_BEGIN) return STAGE.ELDER;
    return STAGE.ADULT;
  }

  /** True if currently in the reproductive window. */
  get isAdult() { return this.lifeStage === STAGE.ADULT; }

  tick(world, registry) {
    // Ascendant: strength scales with age, capped.
    if (this.ascendant) {
      this.strength = (this.baseStrength ?? 1) + Math.min(4, this.age / 100);
    }
    return super.tick(world, registry);
  }

  // Override the base decision tree to slot in civ states.
  _decideState(world, registry) {
    const civ = this.civ;

    // 0. Thronglet awareness override — Stage 1+ pause/walk/stare. Set by
    //    js/sim/Thronglets.js. Acts as the highest priority so the human
    //    holds position regardless of hunger/threat for the duration.
    if (this._thronglet) {
      this.state    = STATE.WANDER;
      this.targetId = null;
      return;
    }

    // 1. Flee predators (life-threatening) — keep highest priority.
    if (this.cfg.fleeRadius > 0) {
      const threat = registry.findNearest(TYPE.PREDATOR, this.tileX, this.tileY, this.cfg.fleeRadius, world);
      if (threat) {
        this.state = STATE.FLEE;
        this.targetId = threat.id;
        return;
      }
    }

    // 2. Hunt enemy tribe members. Adults only — children flee, elders rest.
    //    Warriors / Champions don't need to be hungry to hunt.
    if (civ && this.tribeId != null && this.isAdult) {
      const isCombatFocused = this.trait?.id === 'warrior' || this.skill?.id === 'champion';
      const lookRadius = isCombatFocused ? this.cfg.visionRadius + 2 : this.cfg.visionRadius;
      const enemy = civ.findEnemyHumanNear(this, lookRadius);
      if (enemy) {
        this.state    = STATE.WAR;
        this.targetId = enemy.id;
        return;
      }
    }

    // 3. Seek food when hungry — every life stage needs to eat
    if (this.hunger > this.cfg.hungerThreshold) {
      this.state    = STATE.SEEK_FOOD;
      this.targetId = null;
      return;
    }

    // 4. Build a hut — adults only, with the usual fitness gates
    if (
      this.isAdult &&
      this.tribeId != null &&
      this.hunger < this.cfg.buildHungerCeiling &&
      this.energy > 0.6 &&
      this._canBuildHere(world)
    ) {
      this.state = STATE.BUILD;
      this.targetId = null;
      return;
    }

    // 5. Reproduce — adults only. This is the entire reason life stages
    //    exist; children and elders can't be the reason a tribe survives.
    if (this.isAdult && !this.gestating && this.energy >= this.cfg.reproduceThreshold) {
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

    if (this._thronglet) {
      this._thronglet_act(world);
      return;
    }

    switch (this.state) {
      case STATE.WAR:       this._attackEnemy(world, registry); break;
      case STATE.BUILD:     this._buildHut(world, registry, births); break;
      case STATE.SEEK_HOME: this._goHome(world);                break;
      case STATE.SEEK_MATE: this._seekMate(world, registry);    break;
      default:              super._act(world, registry, births);
    }
  }

  /**
   * Override the base _seekMate so humans only pair with:
   *   - other adults (no child or elder mates)
   *   - same tribe (or both unaffiliated — wandering bands can pair up)
   * This + the adult-only gate above is what turns reproduction from
   * "any two humans bumping into each other" into a kin-group event.
   */
  _seekMate(world, registry) {
    const r = this.cfg.mateRadius ?? 8;
    let best = null, bestDist = r + 1;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = this.tileX + dx, ny = this.tileY + dy;
        if (!world.inBounds(nx, ny)) continue;
        for (const id of world.getEntitiesAt(nx, ny)) {
          const e = registry.get(id);
          if (!e?.alive || e.type !== TYPE.HUMAN) continue;
          if (e.id === this.id) continue;
          if (e.sex === this.sex) continue;
          if (e.gestating) continue;
          if (!e.isAdult) continue;
          // Same tribe, or both unaffiliated. Cross-tribe pairing is rare
          // enough in real kin-groups that we forbid it outright here.
          if (this.tribeId !== e.tribeId) continue;
          const d = Math.abs(dx) + Math.abs(dy);
          if (d < bestDist) { bestDist = d; best = e; }
        }
      }
    }
    if (!best) { this._wander(world); return; }
    if (Math.abs(best.tileX - this.tileX) <= 1 && Math.abs(best.tileY - this.tileY) <= 1) {
      this._reproduce(best);
    } else {
      this._stepToward(world, best.tileX, best.tileY);
    }
  }

  // Drives Thronglet-controlled behaviour. The manager populates
  // this._thronglet with { action, ... } and clears it when done.
  _thronglet_act(world) {
    const t = this._thronglet;
    if (t.action === 'pause') {
      // Hold still; the manager set ent.heading already so the body faces camera.
      return;
    }
    if (t.action === 'stare') {
      return;
    }
    if (t.action === 'walk') {
      const dx = Math.abs(t.tileX - this.tileX);
      const dy = Math.abs(t.tileY - this.tileY);
      if (dx <= 1 && dy <= 1) return; // arrived; manager will switch to stare
      this._stepToward(world, t.tileX, t.tileY);
    }
  }

  _attackEnemy(world, registry) {
    const target = registry.get(this.targetId);
    if (!target?.alive) { this.state = STATE.WANDER; return; }

    const dist = Math.abs(target.tileX - this.tileX) + Math.abs(target.tileY - this.tileY);
    if (dist <= 1) {
      if (this.attackCooldown <= 0) {
        const dmg = (this.strength || 1) + rand() * 0.5;
        // No HP system on creatures yet — apply chance-based kill weighted by
        // relative strength. Base chance dropped from 0.55 to 0.42 so wars
        // bleed tribes over time instead of wiping them in a single skirmish.
        const targetStrength = target.strength || 1;
        const killed = rand() < 0.42 + (dmg - targetStrength) * 0.18;
        if (killed) {
          target.alive = false;
          this.hunger = Math.max(0, this.hunger - 0.15); // looting / morale
          this.energy = Math.min(1, this.energy + 0.1);
        }
        this.attackCooldown = this.cfg.huntCooldownTicks ?? 8;
        eventBus.emit('entity:attacked', { attacker: this, target, killed });
      }
    } else {
      this._stepToward(world, target.tileX, target.tileY);
    }
  }

  _canBuildHere(world) {
    // No recently built; not on water; standing on grass/dirt
    if (this.age - this.builtSinceTick < this.buildCooldown) return false;
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
