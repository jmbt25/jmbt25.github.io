import { TYPE } from '../core/constants.js';
import { eventBus } from '../core/eventBus.js';

const MAX_PLANTS = 1200;

export class SimulationManager {
  constructor(world, registry) {
    this.world    = world;
    this.registry = registry;

    this.tick    = 0;
    this.paused  = false;
    this.speed   = 1;   // sim ticks per interval

    // Population history for the graph (ring buffer, 200 entries per series)
    this.history = {
      plant:     new Float32Array(200),
      herbivore: new Float32Array(200),
      predator:  new Float32Array(200),
      human:     new Float32Array(200),
      head:      0,
      length:    0,
    };
  }

  // Called by gameLoop at ~12hz
  update() {
    if (this.paused) return;
    for (let i = 0; i < this.speed; i++) this._tick();
  }

  _tick() {
    this.tick++;

    const toKill  = [];
    const toSpawn = [];

    for (const entity of this.registry.getAll()) {
      if (!entity.alive) continue;

      if (entity.type === TYPE.PLANT) {
        const req = entity.tick(this.world);
        if (!entity.alive) { toKill.push(entity); continue; }
        if (req) toSpawn.push(req);

      } else {
        const reqs = entity.tick(this.world, this.registry);
        if (!entity.alive) { toKill.push(entity); continue; }
        if (reqs.length) toSpawn.push(...reqs);
      }
    }

    // Apply deaths
    for (const e of toKill) this.registry.kill(e);

    // Apply births (cap plants to avoid choking the world)
    let plantCount = 0;
    for (const e of this.registry.getAll()) {
      if (e.type === TYPE.PLANT) plantCount++;
    }

    for (const req of toSpawn) {
      if (req.type === TYPE.PLANT && plantCount >= MAX_PLANTS) continue;
      const born = this.registry.spawn(req.type, req.x, req.y);
      if (born && req.type === TYPE.PLANT) plantCount++;
    }

    // Spontaneous plant growth on fertile tiles (keeps ecosystem seeded)
    if (plantCount < MAX_PLANTS && Math.random() < 0.4) {
      const x = Math.floor(Math.random() * this.world.width);
      const y = Math.floor(Math.random() * this.world.height);
      if (this.world.getFertility(x, y) > 0.5 && Math.random() < 0.12) {
        this.registry.spawn(TYPE.PLANT, x, y);
      }
    }

    // Record history every 10 ticks
    if (this.tick % 10 === 0) this._recordHistory();

    eventBus.emit('sim:tick', { tick: this.tick, speed: this.speed });
  }

  _recordHistory() {
    const counts = this.registry.countByType();
    const h = this.history;
    h.plant[h.head]     = counts.plant;
    h.herbivore[h.head] = counts.herbivore;
    h.predator[h.head]  = counts.predator;
    h.human[h.head]     = counts.human;
    h.head   = (h.head + 1) % 200;
    h.length = Math.min(h.length + 1, 200);
  }

  resetHistory() {
    this.history.plant.fill(0);
    this.history.herbivore.fill(0);
    this.history.predator.fill(0);
    this.history.human.fill(0);
    this.history.head   = 0;
    this.history.length = 0;
  }
}
