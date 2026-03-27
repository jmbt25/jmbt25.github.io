# CLAUDE.md — Project Memory
> Read this at the start of every new session.

---

## What this project is

A WorldBox-inspired **life simulation** running entirely in the browser (HTML5 Canvas + vanilla ES modules). No build tools, no npm, no backend. Hosted on **GitHub Pages** at `jmbt25.github.io`.

The user's intent is for this to be their GitHub Page for now, with a separate portfolio site built later.

---

## Folder structure

```
/
├── index.html                  ← Single-page app entry point
├── CLAUDE.md                   ← This file
├── README.md
├── css/
│   └── style.css               ← All styles (dark WorldBox theme, CSS Grid layout)
└── js/
    ├── main.js                 ← Wires all subsystems, starts sim + render loops
    ├── core/
    │   ├── constants.js        ← Single source of truth: TILE_SIZE, WORLD_WIDTH/HEIGHT,
    │   │                          SIM_TICK_MS, MAX_ENTITIES, TYPE enum, SPECIES configs
    │   ├── eventBus.js         ← Minimal pub/sub (on/off/emit). Decouples sim from UI.
    │   └── rng.js              ← Seeded PRNG (mulberry32). Used in WorldGen for
    │                              reproducible terrain. Also exports randInt/randFloat/
    │                              randBool/randChoice/randDir helpers.
    ├── world/
    │   ├── TerrainType.js      ← TERRAIN enum (WATER/SAND/GRASS/FOREST/DIRT/MOUNTAIN/SNOW),
    │   │                          TERRAIN_COLOR, TERRAIN_COLOR2, isPassable(), getFertility()
    │   ├── World.js            ← Grid state: Uint8Array of terrain + per-tile entity Sets.
    │   │                          Spatial index lives here (tileEntities[idx]).
    │   │                          registerEntity/unregisterEntity/moveEntityRecord.
    │   └── WorldGen.js         ← Procedural terrain: layered box-blur noise → biome lookup.
    │                              WorldGen.generate(world, seed). No external deps.
    ├── entities/
    │   ├── Entity.js           ← Base class: id (auto-increment int), type, tileX, tileY,
    │   │                          alive, age
    │   ├── Plant.js            ← Stationary. tick(world) → spawn request or null.
    │   │                          Ages, grows through 3 stages, spreads seeds nearby.
    │   ├── Creature.js         ← All mobile creature logic. Priority state machine:
    │   │                          FLEE > SEEK_FOOD > SEEK_MATE > WANDER.
    │   │                          tick(world, registry) → array of spawn requests.
    │   ├── Herbivore.js        ← Thin subclass of Creature (TYPE.HERBIVORE)
    │   ├── Predator.js         ← Thin subclass of Creature (TYPE.PREDATOR)
    │   ├── Human.js            ← Thin subclass of Creature (TYPE.HUMAN)
    │   └── EntityRegistry.js   ← Authoritative entity store (Map<id, Entity>).
    │                              spawn/kill/killById/clear/get/getAll/countByType.
    │                              findNearest(type, cx, cy, radius, world) — O(r²) scan.
    │                              queryRadius(cx, cy, radius, world) → Entity[].
    │                              kill() guards on Map membership (not entity.alive) to
    │                              handle entities marked dead by Creature._eat().
    ├── sim/
    │   └── SimulationManager.js ← Owns the tick loop (called by setInterval in main.js).
    │                               Iterates entities, collects toKill/toSpawn arrays,
    │                               flushes mutations AFTER iteration (avoids iterator bugs).
    │                               Tracks population history in Float32Array ring buffers
    │                               (200 entries per species). Emits 'sim:tick' on eventBus.
    ├── render/
    │   ├── Camera.js           ← x/y offset + zoom. pan(), zoomAt(factor, pivotX, pivotY),
    │   │                          screenToTile(), visibleTileRange(). Min zoom 0.35, max 5.
    │   ├── TileRenderer.js     ← Draws only visible tiles (viewport culled). Per-terrain
    │   │                          pixel detail using deterministic tileVariant(x,y) hash.
    │   ├── EntityRenderer.js   ← Draws pixel-art creatures/plants using canvas primitives
    │   │                          (no sprite sheet). Culls entities outside viewport.
    │   │                          drawHighlight() for selected entity.
    │   └── Renderer.js         ← Orchestrates: clearRect → camera transform → TileRenderer
    │                              → EntityRenderer → highlight → cursor overlay (screen-space).
    ├── ui/
    │   ├── ToolManager.js      ← Handles all pointer/touch/wheel events on the canvas.
    │   │                          TOOL enum, maps tools to terrain types and entity types.
    │   │                          Touch pinch-to-zoom supported.
    │   ├── StatsPanel.js       ← Listens to 'sim:tick', updates DOM text nodes for counts.
    │   │                          Throttled to every 2nd event.
    │   ├── PopulationGraph.js  ← Draws line graph on #graph-canvas from history ring buffer.
    │   │                          Redraws every 5 ticks. Series: herbivore/predator/human/plant.
    │   └── UIManager.js        ← Wires toolbar buttons, sim controls (pause/speed/regen),
    │                              inspector panel, and initial world seeding.
    │                              _seedWorld(): spawns 55 herbivores, 12 predators, 10 humans.
```

---

## Architecture & design choices

### Loops
- **Simulation**: `setInterval(() => sim.update(), SIM_TICK_MS)` — runs at ~12 ticks/sec, independent of render fps.
- **Render**: `requestAnimationFrame(renderLoop)` — runs at ~60fps, reads world state without blocking sim.
- These are intentionally decoupled. JS is single-threaded (run-to-completion), so there is no race condition.

### Spatial indexing
- `World.tileEntities` is a flat array of `Set<entityId>` indexed by `y * width + x`.
- Every entity move updates this structure via `world.moveEntityRecord(entity, newX, newY)`.
- `EntityRegistry.findNearest()` scans a bounding box of tiles — O(r²), fast enough at r=10.

### Deferred mutations
- `SimulationManager._tick()` collects `toKill[]` and `toSpawn[]` during entity iteration.
- Mutations are applied **after** the full iteration to avoid "modify during iteration" bugs.

### Entity death
- `Creature._eat()` sets `food.alive = false` directly (before registry knows about it).
- `EntityRegistry.kill()` guards on `this.entities.has(entity.id)`, **not** `entity.alive`, so eaten entities are always properly cleaned up from the map and tileEntities grid.

### No build tools
- Pure ES modules with `<script type="module">` — GitHub Pages serves `.js` as `application/javascript`.
- No webpack, vite, rollup, npm, or TypeScript.
- No CDN dependencies either — everything is self-contained.

### No circular imports
Dependency order (each file only imports from levels above it):
1. `constants.js`, `rng.js`, `eventBus.js` (import nothing from project)
2. `TerrainType.js` → constants
3. `World.js` → constants, TerrainType
4. `Entity.js` → constants
5. `Plant.js`, `Creature.js` → Entity, constants, rng
6. `Herbivore/Predator/Human.js` → Creature, constants
7. `EntityRegistry.js` → entity subclasses, constants, eventBus
8. `SimulationManager.js` → constants, eventBus
9. `Camera.js` → constants
10. `TileRenderer.js` → constants, TerrainType
11. `EntityRenderer.js` → constants
12. `Renderer.js` → Camera, TileRenderer, EntityRenderer
13. `ToolManager.js` → constants, TerrainType, world (passed by ref)
14. `StatsPanel.js`, `PopulationGraph.js` → eventBus
15. `UIManager.js` → all of the above
16. `main.js` → everything, wires instances

---

## Simulation rules

| Species    | Eats              | Flees from   | Max age | Notes                     |
|------------|-------------------|--------------|---------|---------------------------|
| Plant      | nothing (grows)   | —            | 180–420 | 3 stages; spreads seeds   |
| Herbivore  | plants            | predators    | ~400    | yellow colour             |
| Predator   | herbivores, humans| nothing      | ~500    | red; slower move rate     |
| Human      | plants, herbivores| predators    | ~700    | longest-lived; female has pink hat indicator |

All creatures: age → die, hunger ≥ 1.0 → die, gestating female gives birth after N ticks.

---

## UI layout

```
┌─────────────┬──────────────────────────────────┬──────────────┐
│  Left       │  Canvas (world sim)               │  Right       │
│  Toolbar    │                                   │  Sidebar     │
│  (56px)     │  ┌─ HUD overlay ────────────────┐ │  (220px)     │
│             │  │ Tick | Speed | ⏸ 2× ↺ Regen  │ │              │
│  Spawn:     │  └──────────────────────────────┘ │ Population   │
│  🌱 Plant   │                                   │ counts       │
│  🐑 Herb    │                                   │              │
│  🐺 Pred    │                                   │ History graph│
│  🧍 Human   │                                   │ (canvas)     │
│             │                                   │              │
│  Terrain:   │                                   │ Inspector    │
│  [swatches] │                                   │ (entity info)│
│             │                                   │              │
│  🔍 Inspect │                                   │ Legend       │
│  🗑️ Erase   │                                   │              │
└─────────────┴──────────────────────────────────┴──────────────┘
```

CSS Grid: `grid-template-columns: 56px 1fr 220px` on `#app`.

### Tools available
- **Spawn**: Plant, Herbivore, Predator, Human (click/drag on passable tiles)
- **Terrain paint**: Water, Grass, Forest, Dirt, Sand, Mountain
- **Inspect**: click entity → right sidebar shows live stats (type, age, hunger, energy, state, sex, gestating)
- **Erase**: removes all entities on clicked tile
- **Pan**: right-click drag or middle-click drag
- **Zoom**: scroll wheel or pinch-to-zoom (touch)

### Sim controls (HUD)
- **⏸ / ▶** — pause / resume
- **2×** — cycle speed 1×→2×→3×→4×→5×→1×
- **↺ Regen** — regenerate world + re-seed population, reset history

---

## Visual style (CSS variables)

| Variable         | Value     | Use                        |
|------------------|-----------|----------------------------|
| `--bg`           | `#0d1117` | Page background            |
| `--panel`        | `#161b27` | Sidebar / toolbar bg       |
| `--panel-alt`    | `#1c2333` | Hover states               |
| `--border`       | `#2a3548` | Panel dividers             |
| `--text`         | `#a8b8cc` | Normal text                |
| `--text-bright`  | `#d4e4f4` | Values / headings          |
| `--text-dim`     | `#5a6a80` | Labels / section headers   |
| `--accent`       | `#4a9eff` | Active tool border         |
| `--c-plant`      | `#50c040` | Plant colour               |
| `--c-herbivore`  | `#f0d040` | Herbivore colour           |
| `--c-predator`   | `#d04040` | Predator colour            |
| `--c-human`      | `#e09050` | Human colour               |

---

## Key constants (js/core/constants.js)

| Constant       | Value       | Meaning                              |
|----------------|-------------|--------------------------------------|
| `TILE_SIZE`    | 16 px       | Size of one world tile on canvas     |
| `WORLD_WIDTH`  | 120 tiles   | World width                          |
| `WORLD_HEIGHT` | 80 tiles    | World height                         |
| `SIM_TICK_MS`  | 80 ms       | Sim interval (~12 ticks/sec)         |
| `MAX_ENTITIES` | 2500        | Hard cap across all entity types     |
| Max plants     | 1200        | Soft cap in SimulationManager        |

---

## User preferences

- Code should be **organised, modularised, and have good project structure**.
- No build tools — pure vanilla HTML/CSS/JS ES modules only.
- This is the **entire GitHub Page for now** — no separate portfolio yet (will be a different site later).
- No TypeScript, no frameworks, no npm packages.

---

## Pages / sections

This is a **single-page app** — only `index.html`. No routing, no multiple pages.

Future plan: a separate portfolio website will be created later (different repo or subdomain). This sim will remain as the main GitHub Page.
