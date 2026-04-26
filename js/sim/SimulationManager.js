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
        // Architect skill (Joshua-only): the hut starts with extra HP
        if (builder?.architectHutHp) {
          entity.maxHp = builder.architectHutHp;
          entity.hp    = builder.architectHutHp;
        }
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

    // Migration: silent low-rate respawning has been removed. The world is
    // now allowed to lose species — humans live and die on their own terms,
    // and a tribe that bleeds out is gone. The only fallback is "migration":
    // every few minutes, if a species is FULLY extinct (and the ecology
    // could plausibly support its return), a small band arrives at the
    // world edge as a story event that gets toasted/logged.
    if (this.tick % 600 === 0) this._maybeMigrate();

    // Civilization update (centroids, war/peace)
    this.civ.update(this.tick);

    // Record history every 10 ticks
    if (this.tick % 10 === 0) this._recordHistory();

    eventBus.emit('sim:tick', { tick: this.tick, speed: this.speed });
  }

  /**
   * Story-level migration. Called every 600 sim ticks (~50s). If a species
   * is fully extinct and the world could support them, drop a small band
   * at a passable tile near the world edge and emit a 'world:migration'
   * event so the UI can toast it.
   */
  _maybeMigrate() {
    const counts = this.registry.countByType();

    // Humans return only if there are no humans AND no occupied huts (truly
    // gone, not just a bad year). Need some plant cover to feed them.
    if (counts.human === 0 && counts.building === 0 && counts.plant >= 30) {
      const band = this._dropBandNearEdge(TYPE.HUMAN, 4 + Math.floor(Math.random() * 3));
      if (band > 0) {
        eventBus.emit('world:migration', { type: TYPE.HUMAN, count: band });
      }
    }

    // Predators return only if they're extinct and there's plenty of prey.
    if (counts.predator === 0 && (counts.herbivore + counts.human) >= 25) {
      const band = this._dropBandNearEdge(TYPE.PREDATOR, 2 + Math.floor(Math.random() * 2));
      if (band > 0) {
        eventBus.emit('world:migration', { type: TYPE.PREDATOR, count: band });
      }
    }
  }

  /** Place `n` of `type` on adjacent passable tiles near the world edge. */
  _dropBandNearEdge(type, n) {
    const W = this.world.width, H = this.world.height;
    // Pick an edge anchor
    const edge = Math.floor(Math.random() * 4);
    let cx, cy;
    if (edge === 0)      { cx = Math.floor(Math.random() * W); cy = 1; }
    else if (edge === 1) { cx = Math.floor(Math.random() * W); cy = H - 2; }
    else if (edge === 2) { cx = 1;     cy = Math.floor(Math.random() * H); }
    else                 { cx = W - 2; cy = Math.floor(Math.random() * H); }

    let placed = 0;
    for (let attempt = 0; attempt < 60 && placed < n; attempt++) {
      const dx = Math.floor(Math.random() * 5) - 2;
      const dy = Math.floor(Math.random() * 5) - 2;
      const x = cx + dx, y = cy + dy;
      if (!this.world.inBounds(x, y) || !this.world.isPassable(x, y)) continue;
      if (this.registry.spawn(type, x, y)) placed++;
    }
    return placed;
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
