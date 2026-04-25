import { rand } from '../core/rng.js';
import { JOSHUA_NAME, JOSHUA_SPONTANEOUS_CHANCE } from '../core/constants.js';

const HUMAN_NAMES = [
  'Adan', 'Bea', 'Cael', 'Dara', 'Eda', 'Fenn', 'Gita', 'Hale',
  'Iri', 'Jax', 'Kira', 'Lior', 'Mira', 'Niko', 'Ola', 'Pell',
  'Quin', 'Rhea', 'Sora', 'Tavi', 'Una', 'Vex', 'Wren', 'Xan',
  'Yara', 'Zane', 'Bren', 'Cyra', 'Doran', 'Esme',
];

/** Pick a random ordinary (non-Joshua) human name. */
export function pickOrdinaryName() {
  return HUMAN_NAMES[Math.floor(rand() * HUMAN_NAMES.length)];
}

/**
 * Roll a name for a freshly-spawned human with no Joshua parent.
 * Most are ordinary; a small percentage are spontaneously named Joshua.
 */
export function rollSpontaneousName() {
  if (rand() < JOSHUA_SPONTANEOUS_CHANCE) return JOSHUA_NAME;
  return pickOrdinaryName();
}

export function isJoshua(name) {
  return name === JOSHUA_NAME;
}
