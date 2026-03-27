import { Entity } from './Entity.js';
import { SPECIES, TYPE } from '../core/constants.js';
import { rand, randInt, randDir } from '../core/rng.js';

export const STATE = Object.freeze({
  WANDER:    'wander',
  SEEK_FOOD: 'seek_food',
  FLEE:      'flee',
  SEEK_MATE: 'seek_mate',
});

export class Creature extends Entity {
  constructor(type, tileX, tileY) {
    super(type, tileX, tileY);

    const cfg      = SPECIES[type];
    this.cfg       = cfg;
    this.maxAge    = cfg.maxAge + randInt(-cfg.maxAge * 0.15, cfg.maxAge * 0.15);
    this.hunger    = rand() * 0.25;          // 0=full → 1=starving
    this.energy    = 0.4 + rand() * 0.4;     // reproductive energy
    this.sex       = rand() < 0.5 ? 'M' : 'F';
    this.gestating = false;
    this.gestTimer = 0;
    this.moveClock = 0;
    this.state     = STATE.WANDER;
    this.targetId  = null;
  }

  /**
   * Main per-tick update. Returns an array of spawn requests (may be empty).
   * @param {import('../world/World.js').World} world
   * @param {import('./EntityRegistry.js').EntityRegistry} registry
   */
  tick(world, registry) {
    this.age++;
    this.hunger += this.cfg.hungerPerTick;

    // Die of old age or starvation
    if (this.age >= this.maxAge || this.hunger >= 1.0) {
      this.alive = false;
      return [];
    }

    // Gestation countdown
    const births = [];
    if (this.gestating) {
      this.gestTimer--;
      if (this.gestTimer <= 0) {
        this.gestating = false;
        births.push(...this._giveBirth(world));
      }
    }

    // Throttle movement to cfg.moveEveryNTicks
    this.moveClock++;
    if (this.moveClock < this.cfg.moveEveryNTicks) return births;
    this.moveClock = 0;

    this._decideState(world, registry);
    this._act(world, registry, births);
    return births;
  }

  _decideState(world, registry) {
    // Flee overrides everything for prey species
    if (this.cfg.fleeRadius > 0) {
      const threat = registry.findNearest(TYPE.PREDATOR, this.tileX, this.tileY, this.cfg.fleeRadius, world);
      if (threat) {
        this.state    = STATE.FLEE;
        this.targetId = threat.id;
        return;
      }
    }

    if (this.hunger > this.cfg.hungerThreshold) {
      this.state    = STATE.SEEK_FOOD;
      this.targetId = null;
      return;
    }

    if (!this.gestating && this.energy >= this.cfg.reproduceThreshold) {
      this.state    = STATE.SEEK_MATE;
      this.targetId = null;
      return;
    }

    this.state    = STATE.WANDER;
    this.targetId = null;
  }

  _act(world, registry, births) {
    switch (this.state) {
      case STATE.WANDER:    this._wander(world);               break;
      case STATE.SEEK_FOOD: this._seekFood(world, registry);   break;
      case STATE.FLEE:      this._flee(world, registry);       break;
      case STATE.SEEK_MATE: this._seekMate(world, registry);   break;
    }
  }

  _wander(world) {
    this.energy = Math.min(1, this.energy + 0.004);
    const [dx, dy] = randDir();
    this._tryStep(world, this.tileX + dx, this.tileY + dy);
  }

  _seekFood(world, registry) {
    let food = null;

    if (this.type === TYPE.PREDATOR) {
      food = registry.findNearest(TYPE.HERBIVORE, this.tileX, this.tileY, this.cfg.visionRadius, world)
          ?? registry.findNearest(TYPE.HUMAN,     this.tileX, this.tileY, this.cfg.visionRadius, world);
    } else {
      food = registry.findNearest(TYPE.PLANT, this.tileX, this.tileY, this.cfg.visionRadius, world);
      if (!food && this.type === TYPE.HUMAN) {
        food = registry.findNearest(TYPE.HERBIVORE, this.tileX, this.tileY, this.cfg.visionRadius, world);
      }
    }

    if (!food) { this._wander(world); return; }

    if (Math.abs(food.tileX - this.tileX) <= 1 && Math.abs(food.tileY - this.tileY) <= 1) {
      this._eat(food);
    } else {
      this._stepToward(world, food.tileX, food.tileY);
    }
  }

  _eat(food) {
    if (!food.alive) return;
    food.alive = false;

    const nutrition = food.nutrition ?? 0.55;
    this.hunger = Math.max(0, this.hunger - nutrition);
    this.energy = Math.min(1, this.energy + nutrition * 0.4);
  }

  _flee(world, registry) {
    const threat = registry.get(this.targetId);
    if (!threat?.alive) { this.state = STATE.WANDER; return; }

    const dx = this.tileX - threat.tileX;
    const dy = this.tileY - threat.tileY;
    const nx = this.tileX + Math.sign(dx) + (rand() < 0.35 ? randInt(-1, 1) : 0);
    const ny = this.tileY + Math.sign(dy) + (rand() < 0.35 ? randInt(-1, 1) : 0);
    if (!this._tryStep(world, nx, ny)) {
      const [rdx, rdy] = randDir();
      this._tryStep(world, this.tileX + rdx, this.tileY + rdy);
    }
  }

  _seekMate(world, registry) {
    const mate = registry.findNearest(this.type, this.tileX, this.tileY, this.cfg.mateRadius ?? 8, world);
    if (!mate || mate.id === this.id || mate.sex === this.sex || mate.gestating) {
      this._wander(world); return;
    }

    if (Math.abs(mate.tileX - this.tileX) <= 1 && Math.abs(mate.tileY - this.tileY) <= 1) {
      this._reproduce(mate);
    } else {
      this._stepToward(world, mate.tileX, mate.tileY);
    }
  }

  _reproduce(mate) {
    if (this.sex !== 'F') return;           // only female gestates
    if (this.gestating || mate.gestating) return;
    this.gestating = true;
    this.gestTimer = this.cfg.gestationTicks;
    this.energy   -= this.cfg.reproduceEnergyCost;
    mate.energy   -= this.cfg.reproduceEnergyCost * 0.4;
  }

  _giveBirth(world) {
    const ox = this.tileX + randInt(-1, 1);
    const oy = this.tileY + randInt(-1, 1);
    if (!world.inBounds(ox, oy) || !world.isPassable(ox, oy)) return [];
    return [{ type: this.type, x: ox, y: oy }];
  }

  _stepToward(world, tx, ty) {
    const dx = Math.sign(tx - this.tileX);
    const dy = Math.sign(ty - this.tileY);
    const moves = [[dx, dy], [dx, 0], [0, dy], [-dy, dx], [dy, -dx]];
    for (const [mx, my] of moves) {
      if (mx === 0 && my === 0) continue;
      if (this._tryStep(world, this.tileX + mx, this.tileY + my)) return;
    }
  }

  _tryStep(world, nx, ny) {
    if (!world.inBounds(nx, ny) || !world.isPassable(nx, ny)) return false;
    world.moveEntityRecord(this, nx, ny);
    return true;
  }
}
