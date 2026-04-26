import { rand } from '../core/rng.js';

/**
 * Human first names, split by sex. "Joshua" is just one of the male names —
 * no special status, no automatic skill. Skills are rolled independently
 * (see SKILL_BASE_CHANCE in constants.js + Human._assignIdentity).
 */
const MALE_NAMES = [
  'Adan', 'Bren', 'Cael', 'Doran', 'Fenn', 'Hale', 'Jax', 'Joshua',
  'Lior', 'Niko', 'Pell', 'Quin', 'Tavi', 'Vex', 'Xan', 'Zane',
];

const FEMALE_NAMES = [
  'Bea', 'Cyra', 'Dara', 'Eda', 'Esme', 'Gita', 'Iri', 'Kira',
  'Mira', 'Ola', 'Rhea', 'Sora', 'Una', 'Wren', 'Yara',
];

/** Pick a random first name appropriate to the given sex ('M' | 'F'). */
export function pickName(sex) {
  const pool = sex === 'F' ? FEMALE_NAMES : MALE_NAMES;
  return pool[Math.floor(rand() * pool.length)];
}
