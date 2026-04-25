import { TYPE } from '../core/constants.js';
import { rand } from '../core/rng.js';

// A trait permanently mutates a creature's stats at birth.
// Each trait is a self-contained closure over creature.cfg / instance fields.
// `cfg` is shallow-cloned on first trait so we don't mutate the shared SPECIES config.

function ensureOwnCfg(creature) {
  if (!creature._cfgOwned) {
    creature.cfg = { ...creature.cfg };
    creature._cfgOwned = true;
  }
}

export const TRAITS = Object.freeze({
  SWIFT: {
    id:    'swift',
    name:  'Swift',
    desc:  'Moves twice as often',
    apply(c) {
      ensureOwnCfg(c);
      c.cfg.moveEveryNTicks = Math.max(1, Math.floor(c.cfg.moveEveryNTicks * 0.55));
    },
  },
  HARDY: {
    id:    'hardy',
    name:  'Hardy',
    desc:  'Hungers slowly',
    apply(c) {
      ensureOwnCfg(c);
      c.cfg.hungerPerTick *= 0.55;
      c.maxAge = Math.floor(c.maxAge * 1.2);
    },
  },
  GIANT: {
    id:    'giant',
    name:  'Giant',
    desc:  'Larger and stronger',
    apply(c) {
      c.scale    = 1.55;
      c.strength = 2.0;
    },
  },
  SHARP_EYE: {
    id:    'sharp_eye',
    name:  'Sharp Eye',
    desc:  'Sees twice as far',
    apply(c) {
      ensureOwnCfg(c);
      c.cfg.visionRadius = Math.ceil(c.cfg.visionRadius * 1.8);
      c.cfg.mateRadius   = Math.ceil((c.cfg.mateRadius ?? 8) * 1.6);
    },
  },
  FERTILE: {
    id:    'fertile',
    name:  'Fertile',
    desc:  'Reproduces rapidly',
    apply(c) {
      ensureOwnCfg(c);
      c.cfg.gestationTicks    = Math.max(8, Math.floor(c.cfg.gestationTicks * 0.55));
      c.cfg.reproduceThreshold = c.cfg.reproduceThreshold * 0.7;
    },
  },
  ALPHA: {
    id:    'alpha',
    name:  'Alpha',
    desc:  'Dominant predator',
    apply(c) {
      ensureOwnCfg(c);
      c.cfg.visionRadius += 3;
      c.scale    = 1.35;
      c.strength = 1.8;
      c.cfg.hungerPerTick *= 0.85;
    },
  },
  SAGE: {
    id:    'sage',
    name:  'Sage',
    desc:  'Wise builder, founds tribes',
    apply(c) {
      ensureOwnCfg(c);
      c.cfg.visionRadius += 2;
      c.maxAge = Math.floor(c.maxAge * 1.4);
      c.canFoundTribe = true;
      c.scale = 1.1;
    },
  },
  WARRIOR: {
    id:    'warrior',
    name:  'Warrior',
    desc:  'Lives for battle',
    apply(c) {
      ensureOwnCfg(c);
      c.strength = 2.2;
      c.cfg.fleeRadius = 0; // never flees
      c.scale = 1.2;
    },
  },
});

// Pool of traits available per type
const POOL_BY_TYPE = {
  [TYPE.HERBIVORE]: [TRAITS.SWIFT, TRAITS.HARDY, TRAITS.GIANT, TRAITS.SHARP_EYE, TRAITS.FERTILE],
  [TYPE.PREDATOR]:  [TRAITS.SWIFT, TRAITS.HARDY, TRAITS.GIANT, TRAITS.SHARP_EYE, TRAITS.ALPHA, TRAITS.WARRIOR],
  [TYPE.HUMAN]:     [TRAITS.SWIFT, TRAITS.HARDY, TRAITS.SHARP_EYE, TRAITS.FERTILE, TRAITS.SAGE, TRAITS.WARRIOR, TRAITS.GIANT],
};

/**
 * Roll a random trait from the species pool. Returns the trait or null.
 */
export function rollTraitFor(type) {
  const pool = POOL_BY_TYPE[type];
  if (!pool || !pool.length) return null;
  return pool[Math.floor(rand() * pool.length)];
}
