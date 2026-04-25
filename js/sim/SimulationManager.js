import { TYPE } from '../core/constants.js';
import { eventBus } from '../core/eventBus.js';

const MAX_PLANTS = 1200;

export class SimulationManager {
  constructor(world, registry, civ) {
    this.world    = world;
    this.registry = registry;
    this.civ      = civ;

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

    // Born/death wiring with civ manager
    eventBus.on('entity:born', ({ entity, parent, builder }) => {
      if (entity.type === TYPE.HUMAN) {
        // Inject civ ref so Human AI can query relations
        entity.civ = this.civ;
        this.civ.assignTribe(entity, parent ?? null);
      } else if (entity.type === TYPE.BUILDING) {
        const tribe = builder?.tribeId != null
          ? this.civ.getTribe(builder.tribeId)
          : null;
        if (tribe) this.civ.registerHut(entity, tribe);
      }
    });

    eventBus.on('entity:died', (entity) => {
      if (entity.type === TYPE.HUMAN)    this.civ.removeMember(entity);
      if (entity.type === TYPE.BUILDING) this.civ.removeHut(entity);
    });
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

      } else if (entity.type === TYPE.BUILDING) {
        entity.tick();
        if (!entity.alive) { toKill.push(entity); continue; }

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
      const opts = req.parent
        ? { parent: req.parent }
        : (req.builder ? { builder: req.builder } : undefined);
      const born = this.registry.spawn(req.type, req.x, req.y, opts);
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

    // Rescue spawning: prevents predators/humans from going fully extinct.
    if (this.tick % 5 === 0) {
      const counts = this.registry.countByType();
      if (counts.predator < 4 && Math.random() < 0.07) {
        const x = Math.floor(Math.random() * this.world.width);
        const y = Math.floor(Math.random() * this.world.height);
        if (this.world.isPassable(x, y)) this.registry.spawn(TYPE.PREDATOR, x, y);
      }
      if (counts.human < 6 && Math.random() < 0.09) {
        const x = Math.floor(Math.random() * this.world.width);
        const y = Math.floor(Math.random() * this.world.height);
        if (this.world.isPassable(x, y)) this.registry.spawn(TYPE.HUMAN, x, y);
      }
    }

    // Civilization update (centroids, war/peace)
    this.civ.update(this.tick);

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
