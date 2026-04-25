import { rand } from '../core/rng.js';

// A skill is a more powerful, Joshua-only mutation. It mutates the creature's
// per-instance cfg clone the same way a trait does, plus may set instance fields
// the AI / renderer / sim manager react to.

function ensureOwnCfg(c) {
  if (!c._cfgOwned) {
    c.cfg = { ...c.cfg };
    c._cfgOwned = true;
  }
}

export const SKILLS = Object.freeze({
  PATHFINDER: {
    id:   'pathfinder',
    name: 'Pathfinder',
    desc: 'Sees far and travels swiftly',
    apply(c) {
      ensureOwnCfg(c);
      c.cfg.visionRadius += 5;
      c.cfg.mateRadius   = (c.cfg.mateRadius ?? 8) + 4;
      c.cfg.moveEveryNTicks = Math.max(1, c.cfg.moveEveryNTicks - 1);
    },
  },
  ARCHITECT: {
    id:   'architect',
    name: 'Architect',
    desc: 'Builds huts faster, sturdier',
    apply(c) {
      ensureOwnCfg(c);
      c.buildCooldown = 30;       // shorter than the 80 default
      c.architectHutHp = 200;     // SimulationManager reads this on entity:born for new huts
      c.cfg.buildEnergyCost = (c.cfg.buildEnergyCost ?? 0.45) * 0.6;
    },
  },
  ASCENDANT: {
    id:   'ascendant',
    name: 'Ascendant',
    desc: 'Grows mightier with age',
    apply(c) {
      // Strength is recomputed per-tick from age in Human.tick.
      c.ascendant      = true;
      c.baseStrength   = c.strength || 1;
      c.maxAge         = Math.floor(c.maxAge * 1.25);
    },
  },
  PATRIARCH: {
    id:   'patriarch',
    name: 'Patriarch',
    desc: 'Founds tribes, breeds quickly',
    apply(c) {
      ensureOwnCfg(c);
      c.cfg.gestationTicks     = Math.max(8, Math.floor(c.cfg.gestationTicks * 0.55));
      c.cfg.reproduceThreshold = c.cfg.reproduceThreshold * 0.7;
      c.canFoundTribe          = true;
    },
  },
  CHAMPION: {
    id:   'champion',
    name: 'Champion',
    desc: 'Lord of battle, never flees',
    apply(c) {
      ensureOwnCfg(c);
      c.strength            = 3.0;
      c.cfg.huntCooldownTicks = Math.max(2, Math.floor((c.cfg.huntCooldownTicks ?? 8) * 0.5));
      c.cfg.fleeRadius      = 0;
      c.cfg.visionRadius   += 3;
      c.scale               = Math.max(c.scale ?? 1, 1.2);
    },
  },
});

const SKILL_LIST = Object.values(SKILLS);

/** Roll a uniformly random skill. */
export function rollSkill() {
  return SKILL_LIST[Math.floor(rand() * SKILL_LIST.length)];
}

/** Look up a skill by its id (for inheritance). Returns null if not found. */
export function getSkillById(id) {
  return SKILL_LIST.find(s => s.id === id) ?? null;
}
