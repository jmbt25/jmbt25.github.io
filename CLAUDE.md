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
    │   ├── names.js            ← Human name pool. rollSpontaneousName() returns a random
    │   │                          ordinary name OR (small chance) "Joshua". isJoshua().
    │   ├── skills.js           ← SKILLS table (Pathfinder, Architect, Ascendant,
    │   │                          Patriarch, Champion). Joshua-only. Same apply(creature)
    │   │                          contract as traits but with stronger effects.
    │   │                          getSkillById(id) used for genetic inheritance.
    │   ├── Plant.js            ← Stationary. Ages, grows through 3 stages, spreads seeds.
    │   │                          Bloom buff: ages 40% slower on FOREST tiles, spreads
    │   │                          ~75% more often on GRASS tiles.
    │   ├── Creature.js         ← Mobile creature base. Priority states:
    │   │                          FLEE > SEEK_FOOD > SEEK_MATE > WANDER. _tryStep()
    │   │                          records prev tile + heading + move time so the renderer
    │   │                          can interpolate motion smoothly between tiles.
    │   │                          Constructor rolls SPECIAL_CHANCE for a trait.
    │   │                          Subclasses can override _moveInterval() for transient
    │   │                          speed buffs (used by Predator's blood frenzy).
    │   ├── Herbivore.js        ← Subclass of Creature with "Herd Instinct" species
    │   │                          buff: when in FLEE state with ≥2 herbivores within
    │   │                          3 tiles, takes a second flee step that tick.
    │   ├── Predator.js         ← Subclass of Creature with "Blood Frenzy" species
    │   │                          buff: after a successful kill, frenzyTimer = 40,
    │   │                          which reduces _moveInterval() by 2 ticks until it
    │   │                          decays. Renderer tints the body red while active.
    │   ├── Human.js            ← Extends Creature with civ behaviours: WAR (attack
    │   │                          enemy-tribe humans), BUILD (place hut), SEEK_HOME
    │   │                          (drift toward tribe centroid). civ ref injected at
    │   │                          birth by SimulationManager via 'entity:born' event.
    │   │                          Constructor takes optional parent — _assignIdentity()
    │   │                          rolls a name (with Joshua inheritance/spontaneous
    │   │                          chance) and applies a Joshua-only skill if applicable.
    │   │                          tick() recomputes strength each tick if Ascendant.
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
    │   │                          single-finger touch reserved for ToolManager. Exposes
    │   │                          resetToDefault() (animated lerp back) and panTo(x,z)
    │   │                          (smooth pan target — used by minimap click).
    │   ├── TileRenderer3D.js   ← Terrain BufferGeometry; vertex Y = biome elevation
    │   │                          + a deterministic per-vertex hash jitter (small on
    │   │                          grass/sand, dramatic on mountain/snow for jagged peaks).
    │   │                          Lateral X/Z jitter on interior vertices breaks the
    │   │                          grid look. A second pass blends snow-cap white into
    │   │                          the highest peak vertices. Mesh casts + receives
    │   │                          shadows. Cursor is plane + EdgesGeometry outline;
    │   │                          setCursorTile accepts a brushSize.
    │   ├── TerrainDecorations.js ← Static InstancedMesh scatter system. Per-tile plan
    │   │                          per terrain emits trees (pine, broadleaf), bushes,
    │   │                          grass tufts, wildflowers, rocks, boulders, pebbles,
    │   │                          driftwood, ice spikes, and shoreline reeds. ~10
    │   │                          decoration kinds, ~30 k total instances on a default
    │   │                          120×80 world. All placement/scale/yaw/colour is
    │   │                          deterministic per (tile, slot) hash so rebuild after
    │   │                          edits gives identical output. Casts shadows on tall
    │   │                          decorations.
    │   ├── EntityRenderer3D.js ← One InstancedMesh per BODY PART per type. Composite
    │   │                          parts: herbivore = body (with wool bobbles) + head
    │   │                          + sclera + dark pupils; predator = body (with
    │   │                          shoulder ruff + bushy tail) + head + sclera +
    │   │                          amber-red pupils; human = body (with belt) + head
    │   │                          + cap-style hair (id-keyed colour) + sclera + pupils;
    │   │                          hut = stone foundation + walls + tribe-coloured
    │   │                          roof + door + chimney. Per-instance HSL jitter on
    │   │                          body + head colours so a herd reads as individuals.
    │   │                          Walking sway (Z roll) + bigger bob while moving;
    │   │                          breathing while idle. Trait octahedron and Joshua
    │   │                          skill ring pulse. Highlight torus pulses too. All
    │   │                          parts share one transform per entity per frame.
    │   ├── SkySystem.js        ← Procedural day/night cycle (~120s wall-time per day).
    │   │                          Vertex-coloured sphere sky dome interpolated through 9
    │   │                          phase stops (night → dawn → midday → dusk). Drives the
    │   │                          DirectionalLight sun position/colour, sun-disc Sprite,
    │   │                          ambient + hemisphere lights, scene fog colour, and a
    │   │                          star Points field that fades in at night. Tracks
    │   │                          dayCount; getTimeLabel() yields "Morning"/"Dusk"/etc.
    │   │                          for the HUD.
    │   ├── WaterPlane.js       ← Animated translucent ShaderMaterial plane at y = -1.05
    │   │                          (just above the terrain WATER dip). Vertex shader
    │   │                          generates sin-wave displacement; fragment paints
    │   │                          depth-blended base + animated specular streaks +
    │   │                          shoreline foam (sampled from a DataTexture built by
    │   │                          setShoreFromWorld(): water tiles bordering land get
    │   │                          full foam, blurred for soft falloff). receiveShadow.
    │   ├── ParticleSystem.js   ← Pool of 480 GPU points drifting up as smoke from every
    │   │                          alive Building. Soft-disc shader, fade in/out by
    │   │                          life ratio, allocation-free per frame. setColor() lets
    │   │                          renderer match smoke to sky colour.
    │   ├── Fireflies.js        ← 280 glowing additively-blended Points that drift in
    │   │                          lazy figure-8 paths over grass/forest tiles. Visible
    │   │                          only at night; the main render loop feeds the
    │   │                          SkySystem phase to fade them in at dusk and out at
    │   │                          dawn. scatter() places them on suitable tiles after
    │   │                          worldgen / regen.
    │   ├── StatusBubbles.js    ← Camera-facing glyph badges (! ♥ ⚔ ⚒ + … z) that float
    │   │                          above every creature whose AI state warrants one.
    │   │                          One InstancedMesh per glyph kind with a custom
    │   │                          billboard shader (vertex shader puts the plane in
    │   │                          view space and offsets in screen XY). Mirrors the
    │   │                          entity renderer's prevTile→tile lerp so bubbles
    │   │                          track sliding bodies.
    │   ├── EffectsSystem.js    ← Short-lived particle bursts driven by eventBus
    │   │                          subscriptions: entity:born → green life sparkles,
    │   │                          entity:died → grey puff, entity:ate → green leaves
    │   │                          (plant) or red splatter (meat), entity:attacked
    │   │                          → yellow combat sparks. Continuously emits brown
    │   │                          footstep dust for sprinting creatures (flee /
    │   │                          frenzy). Single GPU Points with per-particle
    │   │                          colour, allocation-free per frame.
    │   └── Renderer3D.js       ← Owns WebGLRenderer (ACES tonemap, sRGB output, PCF
    │                              soft shadows enabled), Scene (with fog), Camera3D,
    │                              SkySystem, TerrainDecorations, WaterPlane,
    │                              ParticleSystem, Fireflies, and the terrain/entity
    │                              sub-renderers. The SkySystem's sun is configured here
    │                              with a 2048² shadow map and a world-sized ortho
    │                              shadow frustum. Each frame: skySystem.update →
    │                              propagate sky colour to water highlight + smoke tint
    │                              → re-aim sun shadow target → entity update → water
    │                              update → particle update → fireflies update →
    │                              render. rebuildTerrain() refreshes terrain mesh,
    │                              decoration scatter, shore foam texture, and firefly
    │                              positions in one call.
    ├── ui/
    │   ├── ToolManager.js      ← Pointer events on the canvas. Brush size (1, 2, 3, or 5)
    │   │                          only applies to terrain tools. Inspect prefers creatures
    │   │                          over plants when entities share a tile. Sets canvas
    │   │                          cursor style per tool (crosshair / pointer / cell).
    │   ├── StatsPanel.js       ← Listens to 'sim:tick'. Updates count nodes, total
    │   │                          population, and per-species "stretch bars" using
    │   │                          POP_SCALE so a single big herd doesn't crush other bars.
    │   ├── PopulationGraph.js  ← DPR-aware Canvas2D graph. Filled areas + line per series,
    │   │                          shared Y-axis, latest values printed top-right.
    │   ├── TribesPanel.js      ← Top-6 tribes by size. Header meta shows total tribe
    │   │                          count + active wars; war row lists enemies coloured
    │   │                          with each enemy tribe's colour.
    │   ├── Toaster.js          ← Ephemeral notifications top-right of the canvas. Surfaces:
    │   │                          spontaneous Joshuas, predator/human trait births, tribe
    │   │                          foundings, war declarations, peace, world regen. Per-key
    │   │                          coalescing window prevents floods. Pre-seeds known
    │   │                          tribes/wars on construct + reset() so existing state
    │   │                          never re-toasts on world boot.
    │   ├── Minimap.js          ← 180×120 Canvas2D overhead view. Caches terrain into an
    │   │                          off-screen ImageData buffer (rebuilt via
    │   │                          invalidateTerrain() on terrain edit/regen), redraws
    │   │                          entity dots every 3rd sim:tick. Clicking the minimap
    │   │                          calls onPan(tx,ty) which UIManager wires to
    │   │                          renderer.panTo().
    │   ├── Modals.js           ← Welcome modal (first-time hero + 3-card pitch + Begin /
    │   │                          View controls; persists `mw.seen.welcome.v2` in
    │   │                          localStorage) and Help modal (keybinds, mouse, badges).
    │   │                          Esc closes. Help also opened via the toolbar `?` button
    │   │                          or the H key.
    │   ├── FpsMeter.js         ← Smooths requestAnimationFrame timings; updates the HUD
    │   │                          FPS readout every ~500ms.
    │   └── UIManager.js        ← Wires toolbar, HUD (pause + speed +/- + camera reset +
    │                              regen), inspector card layout (HP/Hunger/Energy/Age
    │                              progress bars + tribe/trait/skill chips), brush slider
    │                              visibility, and global keyboard shortcuts: 1–4 spawn
    │                              tools, Q inspect, E erase, Space pause, [/] speed,
    │                              F camera reset, R regen, H help. tickFrame() drives
    │                              the FPS meter and a throttled inspector refresh.
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

### Joshua skills (Joshua-only, genetic)
- Every newly-spawned human gets a `name`. Names come from `names.js`. Most are ordinary; humans named exactly `Joshua` are the only ones who manifest a `skill`.
- **Spontaneous Joshuas**: any human born without a Joshua parent has a 4% chance of being named Joshua and rolling a random skill.
- **Inherited Joshuas**: humans born to a Joshua parent have a 65% chance of also being named Joshua. If named Joshua, they have an 80% chance to inherit the parent's exact skill (otherwise reroll). This produces "Joshua dynasties" that drift skills slowly across generations.
- Skills (`js/entities/skills.js`):
  - **Pathfinder** — vision +5, mate radius +4, moves one tick faster.
  - **Architect** — `buildCooldown 30` (vs 80) + `architectHutHp = 200` so SimulationManager doubles the new hut's HP on `entity:born`. Build energy cost halved.
  - **Ascendant** — `Human.tick()` recomputes `strength = baseStrength + min(4, age/100)` each tick, plus +25% max age.
  - **Patriarch** — fast gestation, low reproduce threshold, `canFoundTribe = true`.
  - **Champion** — strength = 3, halved hunt cooldown, `fleeRadius = 0`, +3 vision, scale 1.2+.
- Skills stack with traits — a Joshua may also be Sage/Warrior/etc.
- Renderer: Joshuas get a slow-spinning cyan torus ring at their feet (`skillMarker`) plus a cyan body tint. The trait octahedron above the head is unchanged so the two systems don't clash.
- Inspector shows `Name` for all humans and `Skill` for Joshuas.

### Species specialties (always-on per species)
- **Plants** — Bloom: forest-tile plants age 40% slower; grass-tile plants spread seeds 75% more often.
- **Herbivores** — Herd Instinct: in FLEE state, with ≥2 other herbivores within 3 tiles, take a second flee step that tick.
- **Predators** — Blood Frenzy: 40-tick speed buff (move every `n-2` ticks instead of `n`) after every successful `_eat()`. Body tinted red while active.
- **Humans** — Joshua skill system (above) + tribes/diplomacy.

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

### Movement urgency (Creature._moveInterval)
Sprint physics is built into the base move interval rather than per-state code:
- FLEE → -2 ticks (panic burst)
- SEEK_FOOD as a predator → -1 (stalk pace)
- WAR (humans) → -1 (charge)
- Predator's Blood Frenzy stacks an additional -2 on top after a kill
The renderer reads `state` and `frenzyTimer` to pick a "sprinting" sway/bob magnitude, and EffectsSystem emits dust at the feet of any creature whose state qualifies as a sprint.

### Sim → render event surface
Renderer-side effects subscribe to:
- `entity:born`     ({ entity, parent, builder })
- `entity:died`     (entity)
- `entity:ate`      ({ eater, food })          — emitted in Creature._eat
- `entity:attacked` ({ attacker, target, killed })  — emitted in Human._attackEnemy

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
| `JOSHUA_SPONTANEOUS_CHANCE`   | 0.04 | Chance any human born without a Joshua parent is named Joshua |
| `JOSHUA_INHERIT_NAME_CHANCE`  | 0.65 | Chance a Joshua's offspring is also named Joshua |
| `JOSHUA_INHERIT_SKILL_CHANCE` | 0.80 | If the offspring is Joshua, chance their skill matches the parent's |
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
