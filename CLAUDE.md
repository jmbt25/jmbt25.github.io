# CLAUDE.md — Project Memory
> Read this at the start of every new session.

---

## What this project is

A WorldBox-inspired **3D life simulation** running entirely in the browser. The simulation logic is vanilla ES modules; rendering uses **Three.js** loaded from a CDN via importmap. No build tools, no npm, no backend. Hosted on **GitHub Pages** at `jmbt25.github.io`.

The user's intent is for this to be their GitHub Page for now, with a separate portfolio site built later.

---

## Folder structure

```
/
├── index.html                  ← Single-page app entry point. Imports Three.js
│                                  via <script type="importmap"> from jsDelivr.
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
    ├── render/                  ← All Three.js code lives here. Imports `three` and
    │   │                          `three/addons/controls/OrbitControls.js` from importmap.
    │   ├── Camera3D.js         ← Wraps THREE.PerspectiveCamera + OrbitControls.
    │   │                          Configures left-click as null (reserved for tools),
    │   │                          right-drag = rotate, middle-drag = pan, scroll = zoom.
    │   │                          Single-finger touch = null, two-finger = dolly/pan.
    │   ├── TileRenderer3D.js   ← Single BufferGeometry mesh for all terrain.
    │   │                          (W+1)×(H+1) shared vertices. Vertex Y displaced by
    │   │                          biome elevation (water -1.5 → snow +4.5). Vertex
    │   │                          colors averaged from up to 4 adjacent tiles, with
    │   │                          deterministic tileVariant(x,y) hash for color2 jitter.
    │   │                          Material: MeshStandardMaterial({ vertexColors, flatShading }).
    │   │                          Exports getTerrainElevation(t). Owns the cursor mesh
    │   │                          (translucent white plane) and getElevationAt(tx,ty).
    │   │                          rebuild(world) regenerates positions+colors+normals.
    │   ├── EntityRenderer3D.js ← One THREE.InstancedMesh per type (cone=plant, sphere=
    │   │                          herbivore, box=predator, capsule=human). Capacity =
    │   │                          MAX_ENTITIES. Per-frame update(registry, tileRenderer3d)
    │   │                          rewrites instance matrices and per-instance colors.
    │   │                          Plants scale by stage (0.45 → 1.15). Hungry/gestating
    │   │                          tinting via Color.lerp. Highlight = white torus ring.
    │   └── Renderer3D.js       ← Owns the WebGLRenderer, Scene, fog, lights (ambient +
    │                              warm directional sun + sky/ground hemisphere). Owns
    │                              Camera3D and the two sub-renderers. Exposes:
    │                              render(), resize(w,h), rebuildTerrain(), highlighted,
    │                              setCursorTile(tx,ty), clearCursor(),
    │                              raycastTile(screenX,screenY) → {x,y} | null.
    ├── ui/
    │   ├── ToolManager.js      ← Pointer events on the canvas for left-click tool
    │   │                          application. Uses renderer.raycastTile() for tile
    │   │                          picking. Pan/zoom/pinch are NOT handled here —
    │   │                          OrbitControls owns all camera movement.
    │   ├── StatsPanel.js       ← Listens to 'sim:tick', updates DOM text nodes for counts.
    │   │                          Throttled to every 2nd event.
    │   ├── PopulationGraph.js  ← Draws line graph on #graph-canvas from history ring buffer.
    │   │                          Redraws every 5 ticks. Series: herbivore/predator/human/plant.
    │   └── UIManager.js        ← Wires toolbar buttons, sim controls (pause/speed/regen),
    │                              inspector panel, and initial world seeding.
    │                              Regen handler calls renderer.rebuildTerrain() after
    │                              WorldGen.generate(). _seedWorld(): 55 herb / 12 pred / 10 human.
```

---

## Architecture & design choices

### Loops
- **Simulation**: `setInterval(() => sim.update(), SIM_TICK_MS)` — runs at ~12 ticks/sec, independent of render fps.
- **Render**: `requestAnimationFrame(renderLoop)` — runs at ~60fps, reads world state without blocking sim.
- These are intentionally decoupled. JS is single-threaded (run-to-completion), so there is no race condition.

### 3D rendering pipeline
- **One Three.js Scene** owned by `Renderer3D`. World axes: X = tile column, Z = tile row, Y = elevation.
- **Tile (tx, ty)** is centred at world position `(tx + 0.5, surface_elevation, ty + 0.5)`.
- **Terrain mesh** is a single indexed `BufferGeometry` with shared vertices. Vertex Y is the average elevation of up to 4 adjacent tiles, vertex color is the average of those tiles' colors. This blends biome boundaries instead of stepping. Flat shading gives the low-poly look.
- **Entities** are rendered via 4 `InstancedMesh`es (one per type) with `MAX_ENTITIES` capacity. Each frame, `EntityRenderer3D.update()` walks the registry, sets `setMatrixAt`/`setColorAt` for each living entity, and assigns `mesh.count = livingCount`. Older slots get reused naturally.
- **Tile picking** uses `THREE.Raycaster` against the terrain mesh. Hit point is floored to integer (tx, ty). This replaces the old 2D `screenToTile()`.
- **Lighting**: `AmbientLight(#6688aa, 0.55)` + `DirectionalLight(#fff4e0, 1.2)` from upper-left + `HemisphereLight(skyBlue/groundGreen, 0.35)`. No shadow maps.
- **Fog** matches the page bg (`#0d1117`) so the world fades cleanly at the far edge.

### Camera input split (important)
- `OrbitControls` owns **all** camera manipulation: right-drag rotate, middle-drag pan, scroll zoom, two-finger touch.
- `ToolManager` owns **only** left-click and single-finger touch for tool application (spawning, painting, erasing, inspecting).
- Conflict avoidance: `controls.mouseButtons.LEFT = null` and `controls.touches.ONE = null` so OrbitControls ignores those gestures, leaving them for ToolManager.

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
- Three.js is loaded via `<script type="importmap">` from jsDelivr. The importmap maps `"three"` and `"three/addons/"` to specific CDN URLs (pinned to `0.170.0`). This is the only external dependency.

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
9. `Camera3D.js` → three, three/addons, constants
10. `TileRenderer3D.js` → three, constants, TerrainType
11. `EntityRenderer3D.js` → three, constants
12. `Renderer3D.js` → three, Camera3D, TileRenderer3D, EntityRenderer3D, constants
13. `ToolManager.js` → constants, TerrainType (uses renderer by ref)
14. `StatsPanel.js`, `PopulationGraph.js` → eventBus
15. `UIManager.js` → all of the above
16. `main.js` → everything, wires instances

---

## Simulation rules

| Species    | Eats              | Flees from   | Max age | Notes                     |
|------------|-------------------|--------------|---------|---------------------------|
| Plant      | nothing (grows)   | —            | 180–420 | 3 stages; spreads seeds   |
| Herbivore  | plants            | predators    | ~400    | yellow sphere             |
| Predator   | herbivores, humans| nothing      | ~500    | red box; slower move rate |
| Human      | plants, herbivores| predators    | ~700    | tan capsule; longest-lived |

All creatures: age → die, hunger ≥ 1.0 → die, gestating female gives birth after N ticks.

### Population stability mechanisms
- **Spontaneous plant growth**: every tick, random fertile tile has a chance to grow a new plant (keeps herbivores fed).
- **Rescue spawning** (SimulationManager): checked every 5 ticks. If predators < 4, ~7% chance to spawn one; if humans < 6, ~9% chance to spawn one. Simulates migration from off-world. Prevents permanent extinction from low-population mate-finding failure.
- **Mate search radius** is species-configurable (`mateRadius` in SPECIES config). Predators use 14, humans use 12, herbivores default 8. Larger radius compensates for naturally sparser populations.

---

## UI layout

```
┌─────────────┬──────────────────────────────────┬──────────────┐
│  Left       │  WebGL canvas (3D world)          │  Right       │
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

CSS Grid: `grid-template-columns: 56px 1fr 220px` on `#app`. The `#world-canvas` is a single `<canvas>` element passed directly to `THREE.WebGLRenderer`.

### Tools available
- **Spawn**: Plant, Herbivore, Predator, Human (left-click/drag on passable tiles)
- **Terrain paint**: Water, Grass, Forest, Dirt, Sand, Mountain (rebuilds terrain mesh on each click)
- **Inspect**: click entity → right sidebar shows live stats (type, age, hunger, energy, state, sex, gestating). White torus ring marks the selected entity.
- **Erase**: removes all entities on clicked tile
- **Rotate camera**: right-click drag
- **Pan camera**: middle-click drag (or two-finger touch)
- **Zoom**: scroll wheel (or pinch)

### Sim controls (HUD)
- **⏸ / ▶** — pause / resume
- **2×** — cycle speed 1×→2×→3×→4×→5×→1×
- **↺ Regen** — regenerate world + re-seed population, reset history, rebuild terrain mesh

---

## Visual style (CSS variables)

| Variable         | Value     | Use                        |
|------------------|-----------|----------------------------|
| `--bg`           | `#0d1117` | Page background (also Three.js clear color & fog) |
| `--panel`        | `#161b27` | Sidebar / toolbar bg       |
| `--panel-alt`    | `#1c2333` | Hover states               |
| `--border`       | `#2a3548` | Panel dividers             |
| `--text`         | `#a8b8cc` | Normal text                |
| `--text-bright`  | `#d4e4f4` | Values / headings          |
| `--text-dim`     | `#5a6a80` | Labels / section headers   |
| `--accent`       | `#4a9eff` | Active tool border         |
| `--c-plant`      | `#50c040` | Plant colour (cones)       |
| `--c-herbivore`  | `#f0d040` | Herbivore colour (spheres) |
| `--c-predator`   | `#d04040` | Predator colour (boxes)    |
| `--c-human`      | `#e09050` | Human colour (capsules)    |

---

## Key constants (js/core/constants.js)

| Constant       | Value       | Meaning                              |
|----------------|-------------|--------------------------------------|
| `TILE_SIZE`    | 16 px       | Legacy 2D constant; no longer used by the renderer (1 tile = 1 world unit in 3D), but still imported by some modules |
| `WORLD_WIDTH`  | 120 tiles   | World width                          |
| `WORLD_HEIGHT` | 80 tiles    | World height                         |
| `SIM_TICK_MS`  | 80 ms       | Sim interval (~12 ticks/sec)         |
| `MAX_ENTITIES` | 2500        | Hard cap, also InstancedMesh capacity per type |
| Max plants     | 1200        | Soft cap in SimulationManager        |
| Predator rescue threshold | < 4 | Rescue spawn kicks in below this count |
| Human rescue threshold    | < 6 | Rescue spawn kicks in below this count |

### Terrain elevation table (TileRenderer3D.js)
| Terrain  | Y elevation |
|----------|-------------|
| WATER    | -1.5        |
| SAND     |  0.0        |
| DIRT     |  0.3        |
| GRASS    |  0.5        |
| FOREST   |  1.0        |
| MOUNTAIN |  3.5        |
| SNOW     |  4.5        |

---

## User preferences

- Code should be **organised, modularised, and have good project structure**.
- No build tools — pure vanilla HTML/CSS/JS ES modules. Three.js is the only external dep, loaded via importmap CDN.
- This is the **entire GitHub Page for now** — no separate portfolio yet (will be a different site later).
- No TypeScript, no frameworks, no npm packages.

---

## Pages / sections

This is a **single-page app** — only `index.html`. No routing, no multiple pages.

Future plan: a separate portfolio website will be created later (different repo or subdomain). This sim will remain as the main GitHub Page.
