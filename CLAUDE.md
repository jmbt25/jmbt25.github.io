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
    │   │                          SIM_TICK_MS, MAX_ENTITIES, SPECIAL_CHANCE, TYPE enum
    │   │                          (incl. BUILDING), SPECIES configs, TRIBE_COLORS palette
    │   ├── eventBus.js         ← Minimal pub/sub (on/off/emit). Decouples sim from UI.
    │   └── rng.js              ← Seeded PRNG (mulberry32). rand/randInt/randFloat/randBool
    │                              /randChoice/randDir helpers.
    ├── world/
    │   ├── TerrainType.js      ← TERRAIN enum, color tables, isPassable(), getFertility()
    │   ├── World.js            ← Grid state + per-tile entity Sets (spatial index).
    │   └── WorldGen.js         ← Procedural terrain (layered box-blur noise → biomes).
    ├── entities/
    │   ├── Entity.js           ← Base: id, type, tileX/Y, alive, age, prevTileX/Y,
    │   │                          moveStartedAt, moveDurationMs, heading, scale,
    │   │                          strength, trait, tribeId.
    │   ├── traits.js           ← TRAITS table (Swift, Hardy, Giant, Sharp Eye, Fertile,
    │   │                          Alpha, Sage, Warrior) + rollTraitFor(type). Each trait
    │   │                          has apply(creature) which mutates a per-instance cfg
    │   │                          clone (ensureOwnCfg) and/or instance fields.
    │   ├── Plant.js            ← Stationary. Ages, grows through 3 stages, spreads seeds.
    │   ├── Creature.js         ← Mobile creature base. Priority states:
    │   │                          FLEE > SEEK_FOOD > SEEK_MATE > WANDER. _tryStep()
    │   │                          records prev tile + heading + move time so the renderer
    │   │                          can interpolate motion smoothly between tiles.
    │   │                          Constructor rolls SPECIAL_CHANCE for a trait.
    │   ├── Herbivore.js        ← Thin subclass of Creature.
    │   ├── Predator.js         ← Thin subclass of Creature.
    │   ├── Human.js            ← Extends Creature with civ behaviours: WAR (attack
    │   │                          enemy-tribe humans), BUILD (place hut), SEEK_HOME
    │   │                          (drift toward tribe centroid). civ ref injected at
    │   │                          birth by SimulationManager via 'entity:born' event.
    │   ├── Building.js         ← Static entity (huts). Has hp/maxHp + slow age decay.
    │   │                          Owned by a tribe (tribeId).
    │   └── EntityRegistry.js   ← Authoritative entity store (Map<id, Entity>).
    │                              spawn(type,x,y,opts) emits 'entity:born' with parent +
    │                              builder. countByType includes building. Plant + building
    │                              are deduped per tile.
    ├── sim/
    │   ├── SimulationManager.js ← Owns the tick loop. Iterates entities (plants,
    │   │                           buildings, creatures), collects toKill/toSpawn,
    │   │                           flushes after iteration. Subscribes to entity:born
    │   │                           to wire humans/buildings into the civ manager.
    │   │                           Calls civ.update(tick) each tick.
    │   ├── Tribe.js            ← {id, name, color, capital, huts(Set), members(Set),
    │   │                          enemies(Set), centroid}. declareWar/makePeace/
    │   │                          recomputeCentroid.
    │   └── CivilizationManager.js ← Owns the tribe roster. assignTribe(human, parent?)
    │                                handles: parent inheritance, nearest-tribe absorb
    │                                (radius 18), founding new tribes (Sage trait, <2
    │                                tribes existing, or 18% chance). Periodic diplomacy
    │                                tick (every 60 sim ticks): pairs of tribes randomly
    │                                roll for war/peace based on proximity + size. Centroid
    │                                recompute every 25 ticks. Empty tribes are pruned.
    │                                findEnemyHumanNear(human, radius) used by Human AI.
    ├── render/                  ← All Three.js code. Imports via importmap.
    │   ├── Camera3D.js         ← THREE.PerspectiveCamera + OrbitControls. Left-click +
    │   │                          single-finger touch are reserved for ToolManager.
    │   ├── TileRenderer3D.js   ← Single BufferGeometry mesh for terrain. Vertex Y is
    │   │                          biome elevation; vertex colors averaged from up to 4
    │   │                          adjacent tiles. flatShading for low-poly look.
    │   │                          Owns the cursor mesh and getElevationAt(tx,ty).
    │   ├── EntityRenderer3D.js ← One InstancedMesh per BODY PART per type — creatures
    │   │                          are composite (e.g. herbivore = body+legs+tail merged
    │   │                          via BufferGeometryUtils.mergeGeometries, plus a head
    │   │                          mesh). Per frame, each entity gets ONE shared transform
    │   │                          matrix applied to all its parts. Position interpolated
    │   │                          smoothly between prevTile and current tile using a
    │   │                          smoothstep curve over moveDurationMs. Rotation is
    │   │                          rotation.y = -entity.heading (atan2(dz, dx)). Bob
    │   │                          while moving. Humans tinted by tribe color (huts get
    │   │                          a tribe-coloured roof). Special creatures get a slight
    │   │                          gold tint + spinning octahedron marker above their head.
    │   │                          Highlight = white torus ring. allMeshes flat list for
    │   │                          scene.add().
    │   └── Renderer3D.js       ← Owns WebGLRenderer, Scene, fog, lights (ambient + warm
    │                              directional sun + sky/ground hemisphere). Owns Camera3D
    │                              and the two sub-renderers. Holds a `civ` ref injected
    │                              by main.js so the entity renderer can look up tribe
    │                              colors. Exposes render(), resize(w,h), rebuildTerrain(),
    │                              setCursorTile/clearCursor, raycastTile(screenX, screenY).
    ├── ui/
    │   ├── ToolManager.js      ← Pointer events on the canvas for left-click tools.
    │   │                          Uses renderer.raycastTile() for tile picking.
    │   ├── StatsPanel.js       ← Listens to 'sim:tick', updates DOM count nodes.
    │   ├── PopulationGraph.js  ← Line graph from sim.history ring buffer.
    │   ├── TribesPanel.js      ← Renders top tribes (name, color dot, member/hut count,
    │   │                          ⚔ enemy badge). Throttled to every 4th sim:tick.
    │   └── UIManager.js        ← Wires toolbar, sim controls (pause/speed/regen),
    │                              inspector (now shows tribe + trait), and seeds the
    │                              starting population. Regen also calls civ.reset().
```

---

## Architecture & design choices

### Loops
- **Simulation**: `setInterval(() => sim.update(), SIM_TICK_MS)` — runs at ~12 ticks/sec, independent of render fps.
- **Render**: `requestAnimationFrame(renderLoop)` — runs at ~60fps, reads world state without blocking sim.

### Motion is decoupled from ticks (smooth visual movement)
- Sim ticks are still discrete tile-by-tile moves. But every `Creature._tryStep()` records `prevTileX/Y`, `moveStartedAt = performance.now()`, and `moveDurationMs = SIM_TICK_MS * cfg.moveEveryNTicks`.
- The renderer reads this and interpolates with smoothstep: `pos = lerp(prev, current, smoothstep(t))`. Combined with a heading rotation around Y, creatures slide and pivot rather than teleporting.
- A small per-entity `bob` adds vertical hop while moving (`abs(sin(now*0.012 + ent.id)) * 0.05`).
- `moveEveryNTicks` was bumped (herb 2→3, predator 3→5, human 2→3) so creatures cover the world more slowly and interactions are easier to watch.

### Composite creature visuals
- Each creature type renders as MULTIPLE InstancedMeshes (one per body part), sharing the same instance index per logical entity.
- Currently 2 parts per type: body (merged: torso/legs/tail/ears via `BufferGeometryUtils.mergeGeometries`) + head (merged: skull/snout/ears).
- All parts of one entity reuse the same world matrix (position + Y rotation + scale), built once per entity per frame from a `THREE.Object3D` dummy.
- Local frame convention: **+X is forward**. World heading is `atan2(dz, dx)`; rotation applied is `rotation.y = -heading` (Three.js right-handed RY rotation maps +X local toward -Z world for positive angles).
- Per-instance `instanceColor` carries:
  - body color (species or tribe)
  - head color (always species-specific)
  - trait gold tint (lerp 0.18) on body if entity has a trait
  - hungry/gestating tints on body

### Civilization system
- Humans are the only civ-aware species. Each human has `tribeId` (or null if unaffiliated).
- `Tribe` holds members, huts, enemies, capital, and a periodically-recomputed centroid.
- Tribe assignment at birth (parent inherits → nearest tribe within 18 → roll for new tribe). The `Sage` trait guarantees a new tribe.
- `Human._decideState` priority: FLEE > WAR (find enemy from civ) > SEEK_FOOD > BUILD (well-fed + suitable terrain) > SEEK_MATE > SEEK_HOME (drift toward centroid if far) > WANDER.
- Hut placement: humans on grass/forest/dirt with energy > 0.6 and hunger < 0.45 emit a `BUILDING` spawn request (passed into SimulationManager via the births array).
- War: every 60 ticks, two random tribes roll for war/peace. Close, populous tribes are more likely to declare war. Distant or shrunken tribes make peace. Warriors continue hunting enemies even when not hungry.
- Combat: humans in WAR state step toward target; on adjacent tile they roll a strength-weighted kill. Cooldown via `attackCooldown` (default 8 sim ticks).

### Special creatures (traits)
- On Creature construction, `rand() < SPECIAL_CHANCE` (5%) rolls a trait from `POOL_BY_TYPE[creature.type]`.
- Trait `apply(c)` mutates a per-instance `cfg` clone (`ensureOwnCfg`) and/or instance fields like `scale`, `strength`, `canFoundTribe`.
- Inspector shows the trait. Renderer shows a spinning gold octahedron above the head and a slight gold body tint.
- Pools:
  - Herbivore: Swift, Hardy, Giant, Sharp Eye, Fertile
  - Predator: Swift, Hardy, Giant, Sharp Eye, Alpha, Warrior
  - Human: Swift, Hardy, Sharp Eye, Fertile, Sage, Warrior, Giant

### Spatial indexing
- `World.tileEntities[idx(x,y)]` is `Set<entityId>`. Every move updates this via `world.moveEntityRecord(entity, nx, ny)`.
- `EntityRegistry.findNearest()` and `CivilizationManager.findEnemyHumanNear()` scan a bounding box of tiles — O(r²).

### Deferred mutations
- `SimulationManager._tick()` collects `toKill[]` and `toSpawn[]` during iteration; flushes after.

### Entity death
- `Creature._eat()` and `Human._attackEnemy()` set `target.alive = false` directly (before registry knows).
- `EntityRegistry.kill()` guards on Map membership (not `entity.alive`) so eaten entities are properly cleaned up. `kill()` emits `entity:died`, which CivilizationManager listens to for tribe/hut bookkeeping.

### No build tools
- Pure ES modules. Three.js + addons (incl. `BufferGeometryUtils`) loaded via importmap from jsDelivr, pinned to `0.170.0`.

### No circular imports
Dependency order:
1. `constants.js`, `rng.js`, `eventBus.js`
2. `TerrainType.js`, `World.js`, `WorldGen.js`
3. `Entity.js` → constants
4. `traits.js` → constants, rng
5. `Plant.js` → Entity, constants, rng
6. `Creature.js` → Entity, constants, rng, traits
7. `Herbivore/Predator/Human.js` → Creature, constants
8. `Building.js` → Entity, constants, rng
9. `EntityRegistry.js` → entity subclasses, constants, eventBus
10. `Tribe.js` → constants
11. `CivilizationManager.js` → Tribe, constants, rng
12. `SimulationManager.js` → constants, eventBus
13. `Camera3D.js`, `TileRenderer3D.js`, `EntityRenderer3D.js` → three, three/addons, constants, Tribe (for color fallback)
14. `Renderer3D.js` → three, sub-renderers, constants
15. `ToolManager.js`, `StatsPanel.js`, `PopulationGraph.js`, `TribesPanel.js` → constants/eventBus
16. `UIManager.js` → all UI modules + WorldGen
17. `main.js` → everything

---

## Simulation rules

| Species    | Eats              | Flees from   | Max age | Notes                             |
|------------|-------------------|--------------|---------|-----------------------------------|
| Plant      | nothing (grows)   | —            | 180–420 | 3 stages; spreads seeds           |
| Herbivore  | plants            | predators    | ~400    | yellow body                       |
| Predator   | herbivores, humans| nothing      | ~500    | red body; longer snout            |
| Human      | plants, herbivores| predators    | ~700    | tribe-tinted body; builds + wars  |
| Building   | —                 | —            | decays  | hut owned by a tribe              |

All creatures: age → die, hunger ≥ 1.0 → die, gestating female gives birth.

### Population stability mechanisms
- **Spontaneous plant growth** on fertile tiles every tick.
- **Rescue spawning** every 5 ticks: if predator < 4 (~7%) or human < 6 (~9%), spawn one. Simulates migration.
- **Mate radius** species-tunable (predators 14, humans 12, herbivores 8). Sharp Eye trait extends it further.

---

## UI layout

```
┌─────────────┬──────────────────────────────────┬──────────────┐
│  Toolbar    │  WebGL canvas (3D world)          │  Sidebar     │
│  (56px)     │  HUD: tick / speed / ⏸ / 2× / ↺   │  Population  │
│             │                                   │  History     │
│  Spawn      │                                   │  Tribes      │
│  Terrain    │                                   │  Inspector   │
│  Tools      │                                   │  Legend      │
└─────────────┴──────────────────────────────────┴──────────────┘
```

### Tools
- **Spawn**: Plant, Herbivore, Predator, Human (left-click/drag on passable tiles)
- **Terrain paint**: Water, Grass, Forest, Dirt, Sand, Mountain
- **Inspect**: click entity → right sidebar shows live stats incl. tribe + trait
- **Erase**: removes all entities on clicked tile
- **Camera**: right-drag rotate, middle-drag pan, scroll zoom

### Sim controls (HUD)
- ⏸ / ▶ pause; 2× cycle speed 1×→5×; ↺ Regen world (also calls civ.reset() to wipe tribes)

---

## Visual style (CSS variables)

| Variable         | Value     | Use                        |
|------------------|-----------|----------------------------|
| `--bg`           | `#0d1117` | Page bg + Three clear color + fog |
| `--panel`        | `#161b27` | Sidebar / toolbar bg       |
| `--panel-alt`    | `#1c2333` | Hover states               |
| `--border`       | `#2a3548` | Panel dividers             |
| `--text`         | `#a8b8cc` | Normal text                |
| `--text-bright`  | `#d4e4f4` | Values / headings          |
| `--text-dim`     | `#5a6a80` | Labels                     |
| `--accent`       | `#4a9eff` | Active tool border         |
| `--c-plant`      | `#50c040` | Plant accent (legend)      |
| `--c-herbivore`  | `#f0d040` | Herbivore accent           |
| `--c-predator`   | `#d04040` | Predator accent            |
| `--c-human`      | `#e09050` | Human accent (unaffiliated) |

Tribe colors come from `TRIBE_COLORS` in `constants.js` (8 distinct hues, slot 0 reserved for "unaffiliated"). Trait markers use gold `#ffd34d`.

---

## Key constants (js/core/constants.js)

| Constant            | Value     | Meaning                                                |
|---------------------|-----------|--------------------------------------------------------|
| `WORLD_WIDTH`       | 120 tiles | World width                                            |
| `WORLD_HEIGHT`      | 80 tiles  | World height                                           |
| `SIM_TICK_MS`       | 80 ms     | Sim interval (~12 ticks/sec)                           |
| `MAX_ENTITIES`      | 2500      | Hard cap; also InstancedMesh capacity per part         |
| `SPECIAL_CHANCE`    | 0.05      | Probability of any newborn being a special trait holder |
| Max plants          | 1200      | Soft cap in SimulationManager                          |
| Predator rescue     | < 4       | Rescue spawn kicks in below this count                 |
| Human rescue        | < 6       | Rescue spawn kicks in below this count                 |
| Tribe absorb radius | 18        | New human joins nearest tribe within this range        |
| Diplomacy interval  | 60 ticks  | Random tribe pair rolls for war/peace                  |
| Hut build cooldown  | 80 ticks  | Per-human spacing between consecutive builds           |

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
- No build tools — pure vanilla HTML/CSS/JS ES modules. Three.js (incl. addons) is the only external dep, loaded via importmap CDN.
- This is the **entire GitHub Page for now** — no separate portfolio yet (will be a different site later).
- No TypeScript, no frameworks, no npm packages.

---

## Pages / sections

This is a **single-page app** — only `index.html`. No routing, no multiple pages.

Future plan: a separate portfolio website will be created later (different repo or subdomain). This sim will remain as the main GitHub Page.
