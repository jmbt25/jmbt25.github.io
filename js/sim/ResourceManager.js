/**
 * ResourceManager — derives 5 world-level resource values (0..1) from the
 * live sim state and writes them to the bottom-center HUD bars.
 *
 *  ENERGY    — average creature energy across living humans (their work pool)
 *  FOOD      — plant + herbivore stock vs human population (carrying capacity)
 *  WOOD      — forested tile fraction
 *  STONE     — mountain/rock tile fraction
 *  HAPPINESS — peace prevalence × tribe stability × food sufficiency
 *
 * Each resource is smoothed with a low-pass filter so the bars don't jitter
 * every tick. Values are written every ~250ms by tickHud().
 */

import { TYPE } from '../core/constants.js';
import { TERRAIN } from '../world/TerrainType.js';

const SMOOTHING = 0.15; // 0..1 — higher = more responsive, lower = smoother

export class ResourceManager {
  constructor({ world, registry, civ, sim }) {
    this.world = world;
    this.registry = registry;
    this.civ = civ;
    this.sim = sim;

    // Smoothed values 0..1
    this.energy = 0.7;
    this.food = 0.5;
    this.wood = 0.4;
    this.stone = 0.6;
    this.happiness = 0.7;

    this._terrainCounts = null;
    this._cacheTerrain();
  }

  _cacheTerrain() {
    const counts = { wood: 0, stone: 0, total: 0 };
    const w = this.world.width, h = this.world.height;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = this.world.getTerrain(x, y);
        counts.total++;
        if (t === TERRAIN.FOREST) counts.wood++;
        else if (t === TERRAIN.MOUNTAIN) counts.stone++;
      }
    }
    this._terrainCounts = counts;
  }

  refreshTerrain() { this._cacheTerrain(); }

  /** Recompute targets and ease toward them. Returns the smoothed values. */
  update() {
    const counts = this.registry.countByType();
    const humans = counts.human ?? 0;
    const herbivores = counts.herbivore ?? 0;
    const plants = counts.plant ?? 0;

    // ── ENERGY: average human energy (their work pool). Default 0.5 if empty.
    let energySum = 0, energyCount = 0;
    if (humans > 0) {
      for (const e of this.registry.getAll()) {
        if (e.type === TYPE.HUMAN && e.alive && typeof e.energy === 'number') {
          energySum += e.energy;
          energyCount++;
        }
      }
    }
    const energyT = energyCount > 0 ? energySum / energyCount : 0.5;

    // ── FOOD: plants + herbivores vs human demand. Carrying capacity model.
    //    target = clamp((plants*0.3 + herbivores*1.5) / max(humans*4, 20))
    const supply = plants * 0.3 + herbivores * 1.5;
    const demand = Math.max(humans * 4, 20);
    const foodT = Math.min(1, supply / demand);

    // ── WOOD: fraction of forest tiles in the world. Static-ish.
    const tc = this._terrainCounts;
    const woodT = tc ? tc.wood / tc.total * 3.5 : 0.4; // scale up — typical maps have ~25% forest
    const woodTClamped = Math.min(1, Math.max(0, woodT));

    // ── STONE: fraction of mountain tiles, scaled.
    const stoneT = tc ? tc.stone / tc.total * 5.0 : 0.5;
    const stoneTClamped = Math.min(1, Math.max(0, stoneT));

    // ── HAPPINESS: peace × food sufficiency × tribe stability
    let warTribes = 0, totalTribes = 0;
    if (this.civ?.tribes) {
      for (const t of this.civ.tribes.values()) {
        totalTribes++;
        if (t.enemies && t.enemies.size > 0) warTribes++;
      }
    }
    const peace = totalTribes === 0 ? 1 : 1 - (warTribes / totalTribes);
    const foodFactor = foodT;          // hungry tribes are unhappy
    const stability = humans > 0 ? Math.min(1, humans / 20) : 0.5;
    const happinessT = peace * 0.5 + foodFactor * 0.3 + stability * 0.2;

    // ── Low-pass smoothing
    this.energy    += (energyT       - this.energy)    * SMOOTHING;
    this.food      += (foodT         - this.food)      * SMOOTHING;
    this.wood      += (woodTClamped  - this.wood)      * SMOOTHING;
    this.stone     += (stoneTClamped - this.stone)     * SMOOTHING;
    this.happiness += (happinessT    - this.happiness) * SMOOTHING;

    return {
      energy: this.energy,
      food: this.food,
      wood: this.wood,
      stone: this.stone,
      happiness: this.happiness,
    };
  }
}
